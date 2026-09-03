/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Deduplication & Clustering
   ═══════════════════════════════════════════════════════════════════════

   The reference implementation had three defects worth naming, because
   fixing them is most of what this file is:

     1. `deduplicate_events` returned an undefined name (`merged_events`)
        — it never worked.
     2. It re-instantiated and re-trained the deduper on every batch, so
        the learned weights were discarded between calls.
     3. Blocking on an exact hash of (timestamp | location | type) means
        two reports of the *same* event 11 km apart, or either side of a
        6-hour bucket boundary, land in different blocks and are never
        compared. Cross-boundary misses are the dominant dedup failure in
        practice, and an exact-hash blocker is maximally exposed to them.

   Here: each record is indexed under one canonical block key, but
   *queried* against the 3×3 spatial neighbourhood and the adjacent time
   buckets, so boundary pairs are always considered. Pairwise scoring is
   an explicit weighted model (auditable, tunable by an analyst) rather
   than a learned black box that has no DRC training set behind it.
   Clusters come from union-find with a merge threshold.
   ═══════════════════════════════════════════════════════════════════════ */

import type { EventType } from './schema';
import { haversineKm } from './gazetteer';
import { foldKey } from './gazetteer';

export interface DedupeRecord {
  id: string;
  timestamp: string;
  time_uncertainty_min: number;
  lat: number | null;
  lon: number | null;
  radius_km: number;
  event_type: EventType;
  actors: string[];
  description: string;
  /** Same source id ⇒ literally the same report, always a duplicate. */
  source_key: string;
  fatalities?: number;
}

export interface PairScore {
  a: string;
  b: string;
  score: number;
  breakdown: Record<string, number>;
}

/* ── Similarity components ───────────────────────────────────────── */

/* Trigram sets are rebuilt on every pairwise comparison, and each record
   participates in dozens of comparisons per flush. Profiling a full
   window put 432 ms of a 447 ms flush inside this one function: ~15 000
   comparisons × two ~200-element set constructions is six million set
   insertions per flush, for perhaps a few hundred distinct strings.

   Memoising on the description string removes essentially all of it. The
   cache is bounded because descriptions churn as the window slides. */
const gramCache = new Map<string, Set<string>>();
const GRAM_CACHE_MAX = 6000;

function trigrams(s: string): Set<string> {
  const hit = gramCache.get(s);
  if (hit) return hit;

  const t = ` ${foldKey(s)} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));

  if (gramCache.size >= GRAM_CACHE_MAX) {
    let n = GRAM_CACHE_MAX / 4;
    for (const k of gramCache.keys()) {
      gramCache.delete(k);
      if (--n <= 0) break;
    }
  }
  gramCache.set(s, set);
  return set;
}

/** Character-trigram Dice coefficient. Robust to the word-order and
 *  inflection differences between a French wire lede and a Swahili
 *  social post describing the same incident. */
export function triDice(a: string, b: string): number {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return 0;
  // Iterate the smaller set — halves the work on lopsided pairs, which
  // is the common case (a one-line tweet against a wire paragraph).
  const [small, large] = A.size <= B.size ? [A, B] : [B, A];
  let inter = 0;
  for (const g of small) if (large.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/** Temporal agreement, accounting for each record's own uncertainty.
 *  Two reports whose stated times differ by 4 h but which both carry
 *  ±8 h uncertainty are entirely compatible; two reports with ±30 min
 *  uncertainty and a 4 h gap are not. */
function timeSim(a: DedupeRecord, b: DedupeRecord): number {
  const ta = new Date(a.timestamp).getTime();
  const tb = new Date(b.timestamp).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  const gapMin = Math.abs(ta - tb) / 60_000;
  // Combined σ, floored so exact-timestamp records still tolerate minutes.
  const sigma = Math.max(30, Math.hypot(a.time_uncertainty_min, b.time_uncertainty_min));
  return Math.exp(-0.5 * (gapMin / sigma) ** 2);
}

/** Spatial agreement against the combined positional uncertainty. */
function geoSim(a: DedupeRecord, b: DedupeRecord): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
  const tol = Math.max(3, Math.hypot(a.radius_km, b.radius_km));
  return Math.exp(-0.5 * (d / tol) ** 2);
}

/** Casualty figures rarely match exactly across sources; what matters is
 *  whether they are the same order of magnitude. 12 vs 15 is the same
 *  event; 12 vs 200 probably is not. */
function casualtySim(a: DedupeRecord, b: DedupeRecord): number | null {
  if (a.fatalities == null || b.fatalities == null) return null;
  if (a.fatalities === 0 && b.fatalities === 0) return 1;
  const hi = Math.max(a.fatalities, b.fatalities);
  const lo = Math.min(a.fatalities, b.fatalities);
  if (hi === 0) return 1;
  const ratio = lo / hi;
  return ratio > 0.5 ? 1 : ratio > 0.25 ? 0.6 : ratio > 0.1 ? 0.25 : 0;
}

/* ── Pairwise model ──────────────────────────────────────────────── */

const WEIGHTS = {
  time: 0.26,
  geo: 0.30,
  type: 0.16,
  actors: 0.14,
  text: 0.14,
};

/** Score in [0,1]. Weights of components that are unavailable for a pair
 *  (no coordinates, no casualty figures) are redistributed over the
 *  components that *are* available, rather than counting as zero — a
 *  missing field is not evidence of difference. */
export function scorePair(a: DedupeRecord, b: DedupeRecord): PairScore {
  // Identical source report — unambiguous duplicate, short-circuit.
  if (a.source_key && a.source_key === b.source_key) {
    return { a: a.id, b: b.id, score: 1, breakdown: { identical_source: 1 } };
  }

  const parts: { key: string; w: number; v: number }[] = [];
  parts.push({ key: 'time', w: WEIGHTS.time, v: timeSim(a, b) });

  const g = geoSim(a, b);
  if (g != null) parts.push({ key: 'geo', w: WEIGHTS.geo, v: g });

  parts.push({ key: 'type', w: WEIGHTS.type, v: a.event_type === b.event_type ? 1 : compatibleTypes(a.event_type, b.event_type) ? 0.5 : 0 });

  const aj = jaccard(a.actors, b.actors);
  if (a.actors.length && b.actors.length) parts.push({ key: 'actors', w: WEIGHTS.actors, v: aj });

  parts.push({ key: 'text', w: WEIGHTS.text, v: triDice(a.description, b.description) });

  const totalW = parts.reduce((s, p) => s + p.w, 0);
  let score = parts.reduce((s, p) => s + (p.w / totalW) * p.v, 0);

  const cs = casualtySim(a, b);
  const breakdown: Record<string, number> = Object.fromEntries(parts.map((p) => [p.key, +p.v.toFixed(3)]));

  // Casualty magnitude acts as a multiplicative gate rather than an
  // additive term: wildly different death tolls should veto a merge even
  // when everything else lines up.
  if (cs != null) {
    score *= 0.55 + 0.45 * cs;
    breakdown.casualties = +cs.toFixed(3);
  }

  // Hard veto: coordinates that are definitively far apart cannot be the
  // same event no matter how similar the prose.
  if (a.lat != null && b.lat != null && a.lon != null && b.lon != null) {
    const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (d > Math.max(60, a.radius_km + b.radius_km + 25)) {
      score = Math.min(score, 0.2);
      breakdown.geo_veto = 1;
    }
  }

  return { a: a.id, b: b.id, score, breakdown };
}

/** Types that describe the same underlying incident seen differently —
 *  a shelling reported as a clash, a massacre reported as a clash. */
const TYPE_AFFINITY: [EventType, EventType][] = [
  ['armed_clash', 'shelling'],
  ['armed_clash', 'massacre'],
  ['armed_clash', 'troop_movement'],
  ['massacre', 'arson'],
  ['shelling', 'airstrike'],
  ['airstrike', 'drone_strike'],
  ['ied', 'shelling'],
  ['looting', 'arson'],
  ['displacement', 'armed_clash'],
  ['abduction', 'armed_clash'],
  ['thermal_anomaly', 'arson'],
  ['thermal_anomaly', 'shelling'],
];

function compatibleTypes(a: EventType, b: EventType): boolean {
  return TYPE_AFFINITY.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/* ── Blocking ────────────────────────────────────────────────────── */

const CELL_DEG = 0.1;             // ≈ 11 km
const TIME_BUCKET_MS = 6 * 3600_000;

function cellOf(lat: number, lon: number): [number, number] {
  return [Math.floor(lat / CELL_DEG), Math.floor(lon / CELL_DEG)];
}

/** Keys under which a record is *indexed* (one, its own cell/bucket). */
function indexKeys(r: DedupeRecord): string[] {
  const bucket = Math.floor(new Date(r.timestamp).getTime() / TIME_BUCKET_MS);
  if (r.lat == null || r.lon == null) {
    // Records without coordinates block on actor+type instead, so a
    // geo-less tweet can still merge with a located wire report.
    const actorKey = [...r.actors].sort().join('|') || 'noactor';
    return [`t:${bucket}|a:${foldKey(actorKey)}`, `t:${bucket}|y:${r.event_type}`];
  }
  const [cy, cx] = cellOf(r.lat, r.lon);
  return [`t:${bucket}|c:${cy}:${cx}`];
}

/** Keys a record *queries* — its own neighbourhood in space and time.
 *  This is what fixes the boundary-miss defect in the reference design.
 *  A record 200 m from a cell edge still sees the neighbours across it. */
function queryKeys(r: DedupeRecord): string[] {
  const t0 = new Date(r.timestamp).getTime();
  const bucket = Math.floor(t0 / TIME_BUCKET_MS);
  /* Neighbouring buckets only. A ±1 bucket window already spans 18 h,
     which is exactly MAX_CLUSTER_SPAN_H — anything further apart cannot
     be merged regardless, so probing wider buckets costs index scans to
     find pairs the extent limits would refuse. */
  const span = 1;
  const buckets: number[] = [];
  for (let d = -span; d <= span; d++) buckets.push(bucket + d);

  if (r.lat == null || r.lon == null) {
    const actorKey = [...r.actors].sort().join('|') || 'noactor';
    const out: string[] = [];
    for (const b of buckets) {
      out.push(`t:${b}|a:${foldKey(actorKey)}`, `t:${b}|y:${r.event_type}`);
    }
    return out;
  }

  const [cy, cx] = cellOf(r.lat, r.lon);
  /* Widen the neighbourhood for records with large positional
     uncertainty ("quelque part dans le Masisi") — but cap it hard.

     The key count per record is (2·span+1) · (2·ring+1)², which explodes:
     a ring of 4 over 5 time buckets is 405 lookups for one record, and at
     2 000 records that is 800 000 map probes per flush. Capping the ring
     at 2 costs almost nothing in recall — a merge across more than ~35 km
     is refused by the cluster extent limits anyway — and cuts the probe
     count by a factor of three. */
  const ring = Math.max(1, Math.min(2, Math.ceil(r.radius_km / 11)));
  const out: string[] = [];
  for (const b of buckets) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        out.push(`t:${b}|c:${cy + dy}:${cx + dx}`);
      }
    }
    // Reach the geo-less bucket too, so a located wire report can still
    // absorb an unlocatable social post about the same incident.
    out.push(`t:${b}|y:${r.event_type}`);
  }
  return out;
}

/* ── Constrained agglomerative clustering ────────────────────────
   Plain union-find over "score ≥ threshold" is single-linkage, and
   single-linkage chains: A merges with B, B with C, C with D, until an
   incident on Monday and a different incident on Thursday at the same
   locality are one cluster because a chain of pairwise-similar reports
   connects them. Observed directly during development — a simulated
   offensive on one axis produced a single 122-report "event" spanning
   four days, which is not an event, it is a campaign.

   So merges are applied greedily in descending score order, and only
   when the *resulting cluster* would still satisfy hard extent limits.
   That keeps genuinely distinct incidents apart while still collapsing
   the reports of any one of them. */

/** Reports of one incident essentially all land within a day: the
 *  slowest routine contributor here (a curated wire record) files at
 *  ~30 h, but the *incident time* those reports carry still agrees. Two
 *  clashes at the same locality on consecutive days are two clashes, and
 *  merging them destroys exactly the signal the spatio-temporal scan
 *  exists to find. */
const MAX_CLUSTER_SPAN_H = 18;
/** An incident happens at a place. Anything wider is an axis or a
 *  campaign — a valid analytic object, but not one event. */
const MAX_CLUSTER_DIAMETER_KM = 35;

interface ClusterAgg {
  tMin: number;
  tMax: number;
  /** Members' coordinates, for the diameter test. */
  pts: { lat: number; lon: number }[];
  size: number;
}

class ConstrainedClusterer {
  private parent = new Map<string, string>();
  private agg = new Map<string, ClusterAgg>();

  add(r: DedupeRecord): void {
    this.parent.set(r.id, r.id);
    const t = new Date(r.timestamp).getTime();
    this.agg.set(r.id, {
      tMin: Number.isFinite(t) ? t : 0,
      tMax: Number.isFinite(t) ? t : 0,
      pts: r.lat != null && r.lon != null ? [{ lat: r.lat, lon: r.lon }] : [],
      size: 1,
    });
  }

  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) { this.parent.set(x, x); return x; }
    if (p !== x) { p = this.find(p); this.parent.set(x, p); }
    return p;
  }

  /** Attempts a merge; returns false when the extent limits forbid it. */
  tryUnion(a: string, b: string): boolean {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    const A = this.agg.get(ra)!, B = this.agg.get(rb)!;

    const tMin = Math.min(A.tMin, B.tMin);
    const tMax = Math.max(A.tMax, B.tMax);
    if ((tMax - tMin) / 3600_000 > MAX_CLUSTER_SPAN_H) return false;

    const pts = [...A.pts, ...B.pts];
    // Diameter check only against the other cluster's points — within a
    // cluster the invariant already holds, so cross-pairs are sufficient.
    for (const p of A.pts) {
      for (const q of B.pts) {
        if (haversineKm(p.lat, p.lon, q.lat, q.lon) > MAX_CLUSTER_DIAMETER_KM) return false;
      }
    }

    // Merge smaller into larger to keep the tree shallow.
    const [big, small] = A.size >= B.size ? [ra, rb] : [rb, ra];
    this.parent.set(small, big);
    this.agg.set(big, {
      tMin, tMax,
      // Cap retained points: the diameter test is O(|A|·|B|), and a
      // cluster of 30 near-identical coordinates adds nothing to it.
      pts: pts.length > 24 ? pts.slice(0, 24) : pts,
      size: A.size + B.size,
    });
    this.agg.delete(small);
    return true;
  }
}

/* ── Public API ──────────────────────────────────────────────────── */

export const MERGE_THRESHOLD = 0.62;
/** Between REVIEW and MERGE the pair is surfaced to an analyst rather
 *  than merged automatically — the human-in-the-loop hook. */
export const REVIEW_THRESHOLD = 0.46;

/**
 * Upper bound on candidates compared against any single record.
 *
 * Blocking bounds the *average* comparison count, not the worst case. A
 * busy locality during an offensive puts hundreds of reports in one
 * space-time block, and every one of them then compares against every
 * other — quadratic, in the exact conditions where the pipeline most
 * needs to keep up. Measured during development: a block-degenerate
 * window drove 4.1 million comparisons and a 167-second flush.
 *
 * Candidates are ranked by temporal proximity before truncation, so the
 * ones dropped are those least likely to merge anyway.
 */
const MAX_CANDIDATES_PER_RECORD = 80;

export interface ClusterResult {
  /** cluster id → member record ids. */
  clusters: Map<string, string[]>;
  /** Pairs in the ambiguous band, for analyst adjudication. */
  reviewPairs: PairScore[];
  /** Every pair that was actually scored — fusion-console telemetry. */
  comparisons: number;
}

export function clusterRecords(records: DedupeRecord[]): ClusterResult {
  const index = new Map<string, DedupeRecord[]>();
  for (const r of records) {
    for (const k of indexKeys(r)) {
      const arr = index.get(k);
      if (arr) arr.push(r); else index.set(k, [r]);
    }
  }

  const uf = new ConstrainedClusterer();
  for (const r of records) uf.add(r);

  const seen = new Set<string>();
  const reviewPairs: PairScore[] = [];
  const mergeable: PairScore[] = [];
  let comparisons = 0;

  for (const r of records) {
    const candidates = new Set<DedupeRecord>();
    for (const k of queryKeys(r)) {
      for (const c of index.get(k) ?? []) if (c.id !== r.id) candidates.add(c);
    }

    let pool: Iterable<DedupeRecord> = candidates;
    if (candidates.size > MAX_CANDIDATES_PER_RECORD) {
      const rt = new Date(r.timestamp).getTime();
      pool = [...candidates]
        .sort((a, b) =>
          Math.abs(new Date(a.timestamp).getTime() - rt) -
          Math.abs(new Date(b.timestamp).getTime() - rt))
        .slice(0, MAX_CANDIDATES_PER_RECORD);
    }

    for (const c of pool) {
      const pk = r.id < c.id ? `${r.id}|${c.id}` : `${c.id}|${r.id}`;
      if (seen.has(pk)) continue;
      seen.add(pk);
      comparisons++;

      const ps = scorePair(r, c);
      if (ps.score >= MERGE_THRESHOLD) mergeable.push(ps);
      else if (ps.score >= REVIEW_THRESHOLD) reviewPairs.push(ps);
    }
  }

  /* Strongest evidence first, so a marginal pair can never pre-empt a
     near-certain one by consuming the cluster's extent budget. */
  mergeable.sort((a, b) => b.score - a.score);
  for (const p of mergeable) {
    if (!uf.tryUnion(p.a, p.b)) {
      // A confident pair the extent limits refused is exactly the case an
      // analyst should see: probably one incident, possibly two.
      if (p.score >= MERGE_THRESHOLD) reviewPairs.push(p);
    }
  }

  const clusters = new Map<string, string[]>();
  for (const r of records) {
    const root = uf.find(r.id);
    const arr = clusters.get(root);
    if (arr) arr.push(r.id); else clusters.set(root, [r.id]);
  }

  // Drop review pairs that ended up merged transitively anyway.
  const filtered = reviewPairs.filter((p) => {
    const ra = uf.find(p.a), rb = uf.find(p.b);
    return ra !== rb;
  }).sort((x, y) => y.score - x.score);

  return { clusters, reviewPairs: filtered.slice(0, 50), comparisons };
}
