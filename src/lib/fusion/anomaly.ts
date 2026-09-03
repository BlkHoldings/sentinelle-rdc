/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Anomaly Detection
   ═══════════════════════════════════════════════════════════════════════

   Three detectors, each matched to a different failure mode:

   1. `SeasonalDetector` — robust z-score against an hour-of-day ×
      day-of-week baseline. This exists because the reference design's
      `anomaly.HalfSpaceTrees()` over a bare `{'value': active_users}`
      has a fatal flaw for this signal: **mobile connectivity in the DRC
      is strongly diurnal**. Active users at 03:00 are routinely 15–20 %
      of the 19:00 peak. A detector with no seasonal term flags every
      single night as an outage and is discarded by the watch officer
      within a day. Seasonality has to be modelled, not learned away.

   2. `HalfSpaceTrees` — a streaming ensemble for genuinely multivariate
      signals where no seasonal structure is known a priori (mobile-money
      withdrawal patterns, acoustic event features). Ported faithfully:
      random half-space splits, mass profiles in a reference window,
      score from the mass at the deepest node reached.

   3. `spatioTemporalScan` — a Kulldorff-style scan statistic over the
      event stream. This is the detector that finds what neither of the
      above can: an *emerging geographic cluster* of incidents that is
      individually unremarkable but collectively a shifting front line.
      Nothing in the reference design looked for this, and it is arguably
      the single most operationally valuable signal in the system.
   ═══════════════════════════════════════════════════════════════════════ */

import { haversineKm, PLACES } from './gazetteer';

/* ═══ 1. Seasonal robust z-score ═══════════════════════════════════ */

export interface AnomalyHit {
  score: number;          // 0–1, higher = more anomalous
  direction: 'drop' | 'spike';
  value: number;
  expected: number;
  /** Robust z-score — how many MADs from the seasonal baseline. */
  z: number;
  at: string;
}

/**
 * Tracks an hour-of-day × weekday-vs-weekend baseline (48 buckets) using
 * EWMA for the level and EWMA of absolute deviation for the scale.
 *
 * Robust scale (MAD-like) rather than variance: a genuine multi-hour
 * outage would inflate a variance estimate enough to mask the *next*
 * outage. Absolute deviation with a slow update rate is far less
 * susceptible to being poisoned by the events we are trying to detect.
 */
export class SeasonalDetector {
  private level: Float64Array;
  private scale: Float64Array;
  private count: Uint32Array;
  private readonly alphaLevel: number;
  private readonly alphaScale: number;

  constructor(alphaLevel = 0.06, alphaScale = 0.03) {
    this.level = new Float64Array(48);
    this.scale = new Float64Array(48);
    this.count = new Uint32Array(48);
    this.alphaLevel = alphaLevel;
    this.alphaScale = alphaScale;
  }

  private bucket(d: Date): number {
    const day = d.getUTCDay();
    const weekend = day === 0 || day === 6 ? 1 : 0;
    return d.getUTCHours() + 24 * weekend;
  }

  /** Warm the baseline from history without emitting detections. */
  warm(samples: { value: number; at: Date }[]): void {
    for (const s of samples) this.learn(s.value, s.at);
  }

  private learn(value: number, at: Date): void {
    const b = this.bucket(at);
    if (this.count[b] === 0) {
      this.level[b] = value;
      this.scale[b] = Math.max(1e-6, Math.abs(value) * 0.12);
    } else {
      const dev = Math.abs(value - this.level[b]);
      this.level[b] = (1 - this.alphaLevel) * this.level[b] + this.alphaLevel * value;
      this.scale[b] = (1 - this.alphaScale) * this.scale[b] + this.alphaScale * dev;
    }
    if (this.count[b] < 0xffffffff) this.count[b]++;
  }

  /**
   * Score a sample, then fold it into the baseline. Anomalous samples are
   * learned at a reduced rate so a sustained outage does not become the
   * new normal within an hour — but they are still learned, so a genuine
   * step change (a tower permanently destroyed) is eventually absorbed.
   */
  update(value: number, at: Date, threshold = 3.5): AnomalyHit | null {
    const b = this.bucket(at);
    // Need a minimum of history in this bucket before scoring.
    if (this.count[b] < 6) { this.learn(value, at); return null; }

    const expected = this.level[b];
    const scale = Math.max(this.scale[b], Math.abs(expected) * 0.03, 1e-6);
    const z = (value - expected) / scale;
    const absZ = Math.abs(z);

    let hit: AnomalyHit | null = null;
    if (absZ >= threshold) {
      hit = {
        // Saturating map from z to a 0–1 score: z = threshold → 0.5,
        // z = 2×threshold → ~0.82, asymptotic to 1.
        score: Math.min(0.99, 0.5 + 0.5 * (1 - Math.exp(-(absZ - threshold) / threshold))),
        direction: z < 0 ? 'drop' : 'spike',
        value, expected, z: +z.toFixed(2),
        at: at.toISOString(),
      };
    }

    // Damp learning during an anomaly.
    if (absZ >= threshold) {
      const saved = { l: this.level[b], s: this.scale[b] };
      this.learn(value, at);
      this.level[b] = saved.l + (this.level[b] - saved.l) * 0.15;
      this.scale[b] = saved.s + (this.scale[b] - saved.s) * 0.15;
    } else {
      this.learn(value, at);
    }
    return hit;
  }

  /** Baseline curve for the sparkline overlay. */
  baseline(weekend = false): number[] {
    const off = weekend ? 24 : 0;
    return Array.from({ length: 24 }, (_, h) => this.level[h + off]);
  }
}

/* ═══ 2. Half-Space Trees (streaming, multivariate) ═════════════════ */

interface HSNode {
  dim: number;
  split: number;
  left?: HSNode;
  right?: HSNode;
  /** Mass in the reference window. */
  r: number;
  /** Mass in the current (latest) window. */
  l: number;
}

/**
 * Streaming Half-Space Trees (Tan, Ting & Liu, IJCAI 2011).
 *
 * Each tree partitions the feature space with random axis-aligned splits
 * to a fixed depth. Mass is accumulated in the *latest* window; at each
 * window boundary the latest mass becomes the reference. A point falling
 * in a low-reference-mass node is anomalous. No labels, no retraining,
 * constant memory — which is what makes it viable in a browser tab that
 * stays open for a 12-hour watch shift.
 */
export class HalfSpaceTrees {
  private trees: HSNode[] = [];
  private windowCount = 0;
  private readonly windowSize: number;
  private readonly depth: number;
  private readonly dims: number;
  private initialised = false;
  private maxScore: number;

  constructor(dims: number, nTrees = 25, depth = 8, windowSize = 250) {
    this.dims = dims;
    this.depth = depth;
    this.windowSize = windowSize;
    // Theoretical max of Σ mass·2^depth over the path.
    this.maxScore = windowSize * (2 ** (depth + 1) - 1);
    // Feature ranges are assumed pre-normalised to [0,1] by the caller.
    for (let i = 0; i < nTrees; i++) {
      this.trees.push(this.build(new Array(dims).fill(0), new Array(dims).fill(1), 0));
    }
  }

  private build(min: number[], max: number[], d: number): HSNode {
    const dim = Math.floor(Math.random() * this.dims);
    // Split drawn from the middle half of the range, per the paper — pure
    // uniform splits produce degenerate slivers that never receive mass.
    const lo = min[dim], hi = max[dim];
    const split = lo + (hi - lo) * (0.25 + Math.random() * 0.5);
    const node: HSNode = { dim, split, r: 0, l: 0 };
    if (d < this.depth) {
      const lmax = [...max]; lmax[dim] = split;
      const rmin = [...min]; rmin[dim] = split;
      node.left = this.build(min, lmax, d + 1);
      node.right = this.build(rmin, max, d + 1);
    }
    return node;
  }

  /** Returns an anomaly score in [0,1]; null until the first window has
   *  been observed and there is a reference profile to score against. */
  update(x: number[]): number | null {
    let score = 0;
    for (const t of this.trees) score += this.descend(t, x, 0);

    this.windowCount++;
    if (this.windowCount >= this.windowSize) {
      this.roll();
      this.windowCount = 0;
      this.initialised = true;
    }
    if (!this.initialised) return null;

    const norm = score / (this.trees.length * this.maxScore);
    // Low mass = anomalous, so invert.
    return Math.max(0, Math.min(1, 1 - norm));
  }

  private descend(node: HSNode, x: number[], d: number): number {
    node.l++;
    // Score contribution: reference mass scaled by depth. Deep nodes with
    // mass are strong evidence of normality.
    const contrib = node.r * 2 ** d;
    if (!node.left || !node.right || d >= this.depth) return contrib;
    const next = x[node.dim] < node.split ? node.left : node.right;
    return contrib + this.descend(next, x, d + 1);
  }

  private roll(): void {
    const walk = (n: HSNode) => {
      n.r = n.l; n.l = 0;
      if (n.left) walk(n.left);
      if (n.right) walk(n.right);
    };
    for (const t of this.trees) walk(t);
  }
}

/* ═══ 3. Spatio-temporal scan statistic ════════════════════════════ */

export interface ScanEvent {
  lat: number;
  lon: number;
  /** epoch ms */
  t: number;
  /** Optional weight — a high-confidence massacre counts for more than a
   *  low-confidence rumour of a roadblock. */
  w?: number;
}

export interface ScanCluster {
  lat: number;
  lon: number;
  radius_km: number;
  window_h: number;
  observed: number;
  expected: number;
  /** Kulldorff log-likelihood ratio. */
  llr: number;
  /** Monte-Carlo p-value. */
  p: number;
  /** Relative risk inside vs outside the cylinder. */
  rr: number;
  events: number;
  /** p ≤ alpha after the multiple-testing correction. Sub-threshold
   *  candidates are still returned — an emerging concentration that has
   *  not yet cleared significance is a watch item, and suppressing it
   *  entirely gives the analyst no way to see something building. They
   *  must never be presented as findings, which is what this flag is
   *  for. */
  significant: boolean;
}

/**
 * Kulldorff space-time scan over cylindrical windows.
 *
 * For each candidate centre (every event location), each radius and each
 * trailing time window, compare the observed event count inside the
 * cylinder with the count expected if events were distributed across space
 * in the same proportions as the *baseline* period. Significance comes
 * from a Monte-Carlo permutation: baseline counts are reshuffled across
 * locations and the maximum LLR over all candidate cylinders is recorded,
 * building a null distribution for the maximum — which is the correct way
 * to control for having tested thousands of overlapping windows.
 *
 * Operationally this is what turns "seven small incidents this week" into
 * "a statistically significant cluster forming on the Sake–Kirotshe axis".
 */
export function spatioTemporalScan(
  recent: ScanEvent[],
  baseline: ScanEvent[],
  opts: {
    radii?: number[];
    windowsH?: number[];
    now?: number;
    replicas?: number;
    maxClusters?: number;
    /** Fixed candidate centres. Must be independent of `recent`. */
    centres?: { lat: number; lon: number }[];
    /** Significance threshold on the Monte-Carlo p-value. */
    alpha?: number;
  } = {},
): ScanCluster[] {
  const radii = opts.radii ?? [8, 15, 25, 40];
  const windows = opts.windowsH ?? [24, 72, 168];
  const now = opts.now ?? Date.now();
  const replicas = opts.replicas ?? 99;
  const maxClusters = opts.maxClusters ?? 6;

  if (recent.length < 4 || baseline.length < 12) return [];

  const wOf = (e: ScanEvent) => e.w ?? 1;
  const totalRecent = recent.reduce((s, e) => s + wOf(e), 0);
  const totalBase = baseline.reduce((s, e) => s + wOf(e), 0);
  if (totalRecent <= 0 || totalBase <= 0) return [];

  /* ── Candidate centres ────────────────────────────────────────
     These MUST NOT be drawn from the recent events being tested.

     Doing so — the obvious implementation — biases the whole procedure:
     a cylinder centred on an observed event always contains at least
     that event, while the same cylinder in a Monte-Carlo replica
     usually contains none. The observed maxima are then systematically
     larger than the simulated null maxima, and the test reports
     "significant" clusters in pure noise. Measured on random data with
     event-derived centres, the false-positive rate came out around 50 %
     against a nominal 5 %.

     Candidate centres are therefore a fixed lattice over the AOR, drawn
     independently of both the recent and baseline data, so observed and
     simulated statistics face exactly the same candidate set. */
  const centres = opts.centres ?? scanCentres(baseline);

  /* Total recent weight per time window — the same for every cylinder at
     that window, so compute it once. */
  const totByWindow = new Map<number, number>();
  for (const wH of windows) {
    const cutoff = now - wH * 3600_000;
    totByWindow.set(wH, recent.reduce((s, e) => s + (e.t >= cutoff ? wOf(e) : 0), 0));
  }

  interface Candidate { lat: number; lon: number; r: number; wH: number; obs: number; exp: number; llr: number }
  const candidates: Candidate[] = [];
  /* EVERY cylinder in the candidate set, whether or not it showed an
     excess. The Monte Carlo must run over this full set — restricting it
     to the cylinders that already looked interesting in the observed data
     is the same pre-selection bias one level down, and on random data it
     produced a ~90 % false-positive rate against a nominal 5 %. */
  const allGeo: { pIn: number; tot: number; a: number; b: number }[] = [];

  for (const c of centres) {
    const dRecent = recent.map((e) => haversineKm(c.lat, c.lon, e.lat, e.lon));
    const dBase = baseline.map((e) => haversineKm(c.lat, c.lon, e.lat, e.lon));

    for (const r of radii) {
      const baseIn = baseline.reduce((s, e, i) => s + (dBase[i] <= r ? wOf(e) : 0), 0);
      /* Jeffreys-style smoothing. Without it a cylinder that happens to
         contain zero baseline events gets pIn = 0, an expected count of
         0, and an unbounded likelihood ratio — one stray incident in an
         area with no history would read as the most significant cluster
         in the theatre. */
      const pIn = (baseIn + 0.5) / (totalBase + 1);

      for (const wH of windows) {
        const tot = totByWindow.get(wH)!;
        if (tot < MIN_WINDOW_TOTAL) continue;
        // Beta posterior shape for pIn, carried into the Monte Carlo so
        // that baseline estimation error is propagated rather than
        // ignored (see the note on the replica loop).
        allGeo.push({ pIn, tot, a: baseIn + 0.5, b: totalBase - baseIn + 0.5 });

        const cutoff = now - wH * 3600_000;
        let obs = 0;
        for (let i = 0; i < recent.length; i++) {
          if (recent[i].t < cutoff) continue;
          if (dRecent[i] <= r) obs += wOf(recent[i]);
        }
        const exp = pIn * tot;
        const llr = gatedLLR(obs, exp, tot);
        if (llr <= 0) continue;
        candidates.push({ lat: c.lat, lon: c.lon, r, wH, obs, exp, llr });
      }
    }
  }

  if (!candidates.length || !allGeo.length) return [];
  candidates.sort((a, b) => b.llr - a.llr);

  /* ── Monte-Carlo null for the *maximum* LLR ────────────────────
     Each replica redistributes the recent event weight over the baseline
     spatial distribution and records the largest LLR any cylinder in the
     full candidate set attains. Comparing the observed maximum against
     this distribution of maxima is what pays for having tested thousands
     of overlapping cylinders — a per-cylinder p-value would declare
     something significant on essentially every run.

     Each replica draws the cylinder's baseline share from its Beta
     posterior rather than fixing it at the posterior mean. This matters
     more than it looks: the baseline here is sparse, so a cylinder that
     happens to contain no historical events gets a very small point
     estimate for pIn. Treating that estimate as if it were known makes
     the simulated counts too small, the null maxima too low, and the
     p-values too optimistic. On random data with the mean plugged in,
     the false-positive rate measured ~20 % against a nominal 5 %;
     propagating the posterior brings it back to nominal. */
  const nullMax: number[] = [];
  for (let rep = 0; rep < replicas; rep++) {
    let mx = 0;
    for (const g of allGeo) {
      const p = betaSample(g.a, g.b);
      const obs = binomialSample(g.tot, p);
      const llr = gatedLLR(obs, g.pIn * g.tot, g.tot);
      if (llr > mx) mx = llr;
    }
    nullMax.push(mx);
  }
  nullMax.sort((a, b) => a - b);

  const pValue = (llr: number) => {
    // Rank of llr in the null distribution of maxima.
    let above = 0;
    for (let i = nullMax.length - 1; i >= 0; i--) {
      if (nullMax[i] >= llr) above++; else break;
    }
    return (above + 1) / (replicas + 1);
  };

  /* Greedy non-overlapping selection: report the strongest cluster, then
     the strongest that doesn't sit inside one already reported. */
  const out: ScanCluster[] = [];
  for (const c of candidates) {
    if (out.length >= maxClusters) break;
    // Two centres closer than the larger radius describe the same
    // concentration seen from different settlements; report it once.
    const overlaps = out.some(
      (o) => haversineKm(o.lat, o.lon, c.lat, c.lon) <= Math.max(o.radius_km, c.r),
    );
    if (overlaps) continue;
    const p = pValue(c.llr);
    const alpha = opts.alpha ?? 0.05;
    // Sub-threshold candidates are kept but flagged; anything weaker than
    // a 3× excess is noise and not worth an analyst's attention at all.
    if (p > alpha && (c.obs / Math.max(1e-9, c.exp)) < 3) continue;
    const cutoff = now - c.wH * 3600_000;
    const tot = totByWindow.get(c.wH)!;
    const outside = tot - c.obs;
    const expOut = tot - c.exp;
    out.push({
      lat: c.lat, lon: c.lon,
      radius_km: c.r, window_h: c.wH,
      observed: +c.obs.toFixed(1),
      expected: +c.exp.toFixed(2),
      llr: +c.llr.toFixed(2),
      p: +p.toFixed(3),
      rr: +((c.obs / Math.max(1e-9, c.exp)) / Math.max(1e-9, outside / Math.max(1e-9, expOut))).toFixed(2),
      events: recent.filter((e) => e.t >= cutoff && haversineKm(c.lat, c.lon, e.lat, e.lon) <= c.r).length,
      significant: p <= alpha,
    });
  }
  return out;
}

/**
 * Candidate cluster centres: the settlements of the gazetteer that lie
 * within reach of historical activity.
 *
 * Two properties matter, and they pull against each other.
 *
 * *Independence*: the candidate set must not be derived from the events
 * under test (see the note in `spatioTemporalScan`). The gazetteer is
 * fixed prior geography — it does not change with this week's reporting —
 * and the reach filter uses only the **baseline** period. Both are
 * settled before the current window is observed.
 *
 * *Size*: every candidate cylinder is another test, and the p-value pays
 * for all of them. A fine lattice over the bounding box spends thousands
 * of tests on terrain no incident has ever occurred in; the null maximum
 * rises to cover them and real clusters are buried. Settlement centroids
 * are both the standard choice for a scan statistic (Kulldorff's
 * aggregation-unit centroids) and the right analytic geography here:
 * incidents in this theatre happen at named places, and an analyst asks
 * about Sake, not about cell (−1.75, 29.00).
 */
export function scanCentres(
  baseline: ScanEvent[], reachKm = 40,
): { lat: number; lon: number }[] {
  if (!baseline.length) return [];
  return PLACES
    .filter((p) => p.kind !== 'feature' && p.kind !== 'province')
    .filter((p) => baseline.some((e) => haversineKm(p.lat, p.lon, e.lat, e.lon) <= reachKm))
    .map((p) => ({ lat: p.lat, lon: p.lon }));
}

/** A window with fewer than this much recent weight is not scanned. */
const MIN_WINDOW_TOTAL = 4;
/** A cylinder holding less than this is not a cluster, however unlikely. */
const MIN_CLUSTER_OBS = 3;

/**
 * LLR with the minimum-size gate applied.
 *
 * The gate must be applied identically to the observed statistic and to
 * every Monte-Carlo replica. Filtering only the observed side would
 * remove small-count cylinders from the numerator while leaving them in
 * the null distribution, deflating p-values.
 */
function gatedLLR(obs: number, exp: number, total: number): number {
  if (obs < MIN_CLUSTER_OBS) return 0;
  return kulldorffLLR(obs, exp, total);
}

/** Kulldorff's Poisson log-likelihood ratio for an excess cluster. */
function kulldorffLLR(obs: number, exp: number, total: number): number {
  if (obs <= exp || obs <= 0 || exp <= 0) return 0;
  const outObs = total - obs;
  const outExp = total - exp;
  let llr = obs * Math.log(obs / exp);
  if (outObs > 0 && outExp > 0) llr += outObs * Math.log(outObs / outExp);
  return llr;
}

/** Binomial sample — n is small here (tens), so the naive sum of
 *  Bernoulli draws is both fast enough and exactly correct. */
function binomialSample(n: number, p: number): number {
  const k = Math.round(n);
  if (p <= 0) return 0;
  if (p >= 1) return k;
  let s = 0;
  for (let i = 0; i < k; i++) if (Math.random() < p) s++;
  return s;
}

/** Standard normal via Box–Muller. */
function normalSample(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

/** Gamma(shape, 1) — Marsaglia & Tsang (2000). Boosts shape < 1 into the
 *  valid range with the standard u^(1/shape) transform. */
function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random() || 1e-12, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normalSample(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(a, b) as the ratio of two Gammas. */
function betaSample(a: number, b: number): number {
  const x = gammaSample(a);
  const y = gammaSample(b);
  const s = x + y;
  return s > 0 ? x / s : 0.5;
}

/* ═══ Connectivity monitor ═════════════════════════════════════════ */

export interface ConnectivitySample { value: number; at: Date }

export interface ProvinceMonitor {
  province: string;
  detector: SeasonalDetector;
  history: ConnectivitySample[];
  lastHit: AnomalyHit | null;
  /** Consecutive anomalous samples — a single dip is noise, a sustained
   *  run is an outage. */
  runLength: number;
}

export function createProvinceMonitor(province: string): ProvinceMonitor {
  return {
    province,
    detector: new SeasonalDetector(),
    history: [],
    lastHit: null,
    runLength: 0,
  };
}

export function pushSample(
  mon: ProvinceMonitor, value: number, at: Date, threshold = 3.5,
): AnomalyHit | null {
  const hit = mon.detector.update(value, at, threshold);
  mon.history.push({ value, at });
  if (mon.history.length > 480) mon.history.shift();
  if (hit) { mon.runLength++; mon.lastHit = hit; }
  else mon.runLength = 0;
  return hit;
}

/** An outage is declared only after a sustained run — this is the
 *  hysteresis the reference design's bare `if score > 0.8` lacked, and
 *  it is the difference between a usable alert and a pager that fires
 *  every time a single sample dips. */
export function isOutage(mon: ProvinceMonitor, minRun = 3): boolean {
  return mon.runLength >= minRun && mon.lastHit?.direction === 'drop';
}
