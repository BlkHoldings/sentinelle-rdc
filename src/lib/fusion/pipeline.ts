/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Fusion Pipeline
   ═══════════════════════════════════════════════════════════════════════

   Topology (mirrors the reference Kafka Streams design):

     raw.drc.{social_media,news,field_reports,sensors}
              │
              ├─ normalise ─────────────────────────────────────┐
              │   extract entities → classify → geolocate       │
              │   grade source → build FusedEvent               │
              ▼                                                 │
     normalized.drc.events ────────────────────────────────────┘
              │
              ├─ windowed dedupe + cluster merge
              ├─ geospatial enrichment
              ├─ Bayesian confidence fusion
              ▼
     enriched.drc.events ──┬─→ alerts.drc     (priority ≥ threshold)
                           └─→ triage.drc.pending (ambiguous pairs,
                                                   low-confidence, or
                                                   high-impact unverified)
              ▲
              │
     feedback.drc.adjudications ─→ reliability posterior update

   Deduplication is *windowed and repeated*, not one-shot: a report that
   arrives an hour after the cluster it belongs to must still be able to
   join it, so the pipeline re-clusters an active window on every flush
   rather than only comparing new arrivals against a frozen set.

   That window is bounded in both time and count. Events older than the
   grace period — and any event an analyst has adjudicated — are frozen:
   still retained, still shown, but no longer candidates for
   re-clustering. Without that, flush cost grows with ingest rate without
   limit; measured at 167 s per flush after four hours of stream before
   the bound was added.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  ulid, blockKey, EVENT_TYPE_SEVERITY,
  type FusedEvent, type RawReport, type SourceRef, type ProvenanceEntry,
  type EventStatus, type GeoPoint, type Adjudication, type EventType,
} from './schema';
import { extract, resolveLocation, type Extraction } from './extract';
import { classifyEvent } from './classify';
import {
  clusterRecords, type DedupeRecord, type PairScore,
} from './dedupe';
import { enrichLocation } from './geo';
import { fuseConfidence, computePriority } from './confidence';
import {
  profileOf, credibilityFor, posteriorFor, observe, gradeFor,
  emptyReliability, type ReliabilityState,
} from './reliability';
import { getBus, TOPICS, type StreamBus } from './bus';
import { reverseGeocode } from './gazetteer';

/* ── Normalisation ───────────────────────────────────────────────── */

export interface NormalizedRecord {
  event: FusedEvent;
  extraction: Extraction;
}

export function normalizeReport(
  raw: RawReport,
  reliability: ReliabilityState,
  now = Date.now(),
): NormalizedRecord {
  const t0 = performance.now();
  const ex = extract(raw.text, raw.created_at);
  const tExtract = performance.now();

  const cls = classifyEvent(raw.text, ex);
  const tClassify = performance.now();

  /* Location: an explicit coordinate on the report always beats a
     gazetteer inference — a geotagged post or a sensor hit knows better
     than our toponym matcher. */
  let location: GeoPoint | null = null;
  let province: string | undefined;
  let territory: string | undefined;

  if (raw.geo) {
    const near = reverseGeocode(raw.geo.lat, raw.geo.lon, 30);
    location = {
      lat: raw.geo.lat, lon: raw.geo.lon,
      place_name: near?.name ?? 'Coordonnées brutes',
      radius_km: raw.geo.radius_km ?? 1,
      method: 'exact',
    };
    province = near?.province;
    territory = near?.territory;
  } else {
    const resolved = resolveLocation(ex);
    if (resolved) {
      location = {
        lat: resolved.lat, lon: resolved.lon,
        place_name: resolved.place_name,
        radius_km: resolved.radius_km,
        method: resolved.method,
      };
      province = resolved.province;
      territory = resolved.territory;
    }
  }

  const timestamp = ex.when?.iso ?? raw.created_at;
  const timeUnc = ex.when?.uncertainty_min ?? 120;

  const prof = profileOf(raw.source_type);
  const post = posteriorFor(reliability, raw.source_type, raw.handle, now);
  const credibility = credibilityFor(
    ex.certainty,
    location != null,
    ex.actors.length > 0,
    ex.when != null,
  );

  const source: SourceRef = {
    type: raw.source_type,
    family: prof.family,
    id: raw.source_id,
    handle: raw.handle,
    url: raw.url,
    grade: gradeFor(post.mean),
    credibility,
    prior: +post.mean.toFixed(3),
    published_at: raw.created_at,
    ingested_at: new Date(now).toISOString(),
    language: raw.lang ?? ex.lang,
  };

  const actors = [...new Set(ex.actors.map((a) => a.actor.name))];

  const provenance: ProvenanceEntry = {
    source,
    raw_text: raw.text,
    matched_span: ex.places[0]?.text ?? ex.actors[0]?.text,
    report_confidence: +(post.mean * (cls.score || 0.4)).toFixed(3),
    agreement: ex.certainty === 'denied' ? 'contradict' : 'agree',
  };

  const event: FusedEvent = {
    event_id: ulid(now),
    block_key: blockKey(timestamp, location?.lat ?? null, location?.lon ?? null, cls.type),
    timestamp,
    time_uncertainty_min: timeUnc,
    location,
    event_type: cls.type,
    event_type_alts: cls.alts,
    actors,
    description: summarise(raw.text),
    casualties: {
      fatalities: ex.casualties.fatalities,
      injured: ex.casualties.injured,
      abducted: ex.casualties.abducted,
      displaced: ex.casualties.displaced,
    },
    source,
    raw_text: raw.text,
    confidence: 0,       // filled by the fusion stage
    confidence_factors: [],
    status: 'unverified',
    independent_sources: 1,
    provenance: [provenance],
    priority: 0,
    adjudications: [],
    trace: {
      extract_us: Math.round((tExtract - t0) * 1000),
      classify_us: Math.round((tClassify - tExtract) * 1000),
    },
  };

  // Attach admin context now; full enrichment happens post-clustering so
  // it runs once per cluster rather than once per report.
  if (location) {
    event.geo = { admin: { province, territory } };
  }

  return { event, extraction: ex };
}

/** A short, neutral description. Prefers the first sentence; falls back
 *  to a hard truncation on a word boundary. */
function summarise(text: string, maxLen = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const firstStop = clean.search(/[.!?](\s|$)/);
  if (firstStop > 40 && firstStop < maxLen) return clean.slice(0, firstStop + 1);
  if (clean.length <= maxLen) return clean;
  const cut = clean.lastIndexOf(' ', maxLen);
  return clean.slice(0, cut > 60 ? cut : maxLen) + '…';
}

/* ── Cluster merge ───────────────────────────────────────────────── */

/** Folds a set of normalised events describing the same incident into one
 *  canonical FusedEvent, retaining every contributing report. */
export function mergeCluster(members: FusedEvent[], reliability: ReliabilityState): FusedEvent {
  if (members.length === 1) return members[0];

  // Canonical member: the one whose source has the strongest prior, then
  // the most specific location, then the earliest report.
  const ranked = [...members].sort((a, b) =>
    (b.source.prior - a.source.prior) ||
    ((a.location?.radius_km ?? 999) - (b.location?.radius_km ?? 999)) ||
    a.timestamp.localeCompare(b.timestamp),
  );
  const base = ranked[0];

  const provenance = members.flatMap((m) => m.provenance);

  /* Consensus event type: weight each member's vote by its source prior,
     so a wire report outvotes three anonymous posts. */
  const typeVotes = new Map<EventType, number>();
  for (const m of members) {
    typeVotes.set(m.event_type, (typeVotes.get(m.event_type) ?? 0) + m.source.prior);
  }
  const consensusType = [...typeVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];

  /* Mark reports that disagree with the consensus — this feeds directly
     into the confidence model as a negative term, and it is what surfaces
     genuinely disputed events to the analyst instead of averaging the
     disagreement away. */
  for (const p of provenance) {
    const owner = members.find((m) => m.provenance.includes(p));
    if (!owner) continue;
    if (p.agreement === 'contradict') continue;
    if (owner.event_type === consensusType) p.agreement = 'agree';
    else p.agreement = 'partial';
  }

  /* Position: inverse-variance weighted mean of members that have one.
     A 1 km-uncertainty UAS fix should dominate a 25 km "quelque part dans
     le Masisi" — a plain centroid would let the vague report drag the
     position into an empty valley. */
  const located = members.filter((m) => m.location);
  let location: GeoPoint | null = null;
  if (located.length) {
    let wLat = 0, wLon = 0, wSum = 0;
    for (const m of located) {
      const w = 1 / Math.max(0.5, m.location!.radius_km) ** 2;
      wLat += m.location!.lat * w;
      wLon += m.location!.lon * w;
      wSum += w;
    }
    const best = located.reduce((a, b) =>
      a.location!.radius_km <= b.location!.radius_km ? a : b);
    location = {
      lat: wLat / wSum,
      lon: wLon / wSum,
      place_name: best.location!.place_name,
      // Combined uncertainty shrinks with corroboration but never below
      // the best single fix.
      radius_km: Math.max(
        best.location!.radius_km * 0.75,
        Math.sqrt(1 / wSum),
      ),
      method: located.some((m) => m.location!.method === 'exact') ? 'exact' : 'gazetteer',
    };
  }

  /* Time: earliest credible report, since an incident starts when it
     starts — later reports are describing the same beginning. */
  const times = members.map((m) => new Date(m.timestamp).getTime()).filter(Number.isFinite);
  const timestamp = new Date(Math.min(...times)).toISOString();
  const timeUnc = Math.min(...members.map((m) => m.time_uncertainty_min));

  /* Casualties: sources disagree, so keep the spread rather than a mean.
     Reporting "12–40 tués" is honest; reporting "26" is not. */
  const fat = members.map((m) => m.casualties.fatalities).filter((n): n is number => n != null);
  const casualties = {
    fatalities: fat.length ? Math.round(median(fat)) : undefined,
    fatalities_range: fat.length > 1
      ? [Math.min(...fat), Math.max(...fat)] as [number, number]
      : undefined,
    injured:   maxOf(members.map((m) => m.casualties.injured)),
    abducted:  maxOf(members.map((m) => m.casualties.abducted)),
    displaced: maxOf(members.map((m) => m.casualties.displaced)),
  };

  const actors = [...new Set(members.flatMap((m) => m.actors))];

  // Longest description wins — it carries the most detail for the analyst.
  const description = members
    .map((m) => m.description)
    .sort((a, b) => b.length - a.length)[0];

  return {
    ...base,
    event_id: base.event_id,
    block_key: blockKey(timestamp, location?.lat ?? null, location?.lon ?? null, consensusType),
    timestamp,
    time_uncertainty_min: timeUnc,
    location,
    event_type: consensusType,
    event_type_alts: base.event_type_alts,
    actors,
    description,
    casualties,
    provenance,
    independent_sources: new Set(provenance.map((p) => p.source.family)).size,
    adjudications: members.flatMap((m) => m.adjudications),
    geo: base.geo,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function maxOf(xs: (number | undefined)[]): number | undefined {
  const v = xs.filter((n): n is number => n != null);
  return v.length ? Math.max(...v) : undefined;
}

/* ── Status derivation ───────────────────────────────────────────── */

function deriveStatus(e: FusedEvent): EventStatus {
  const adj = [...e.adjudications].reverse().find((a) =>
    a.action === 'confirm' || a.action === 'reject');
  if (adj?.action === 'confirm') return 'confirmed';
  if (adj?.action === 'reject') return 'rejected';

  const contradicting = e.provenance.filter((p) => p.agreement === 'contradict').length;
  const agreeing = e.provenance.filter((p) => p.agreement === 'agree').length;
  if (contradicting > 0 && contradicting >= agreeing * 0.5) return 'disputed';
  if (e.independent_sources >= 2 && e.confidence >= 0.6) return 'corroborated';
  return 'unverified';
}

/* ── The pipeline ────────────────────────────────────────────────── */

export interface PipelineOptions {
  /** Events older than this fall out of the dedupe window. */
  windowHours?: number;
  /** Priority at or above which an event is published to alerts.drc. */
  alertPriority?: number;
  /** Hard cap on retained events — bounds memory across a long watch. */
  maxEvents?: number;
  /** Grace period before an event's reporting window closes and it stops
   *  being re-clustered. */
  graceHours?: number;
  /** Hard cap on events still open for re-clustering. Bounds the flush
   *  cost independently of ingest rate. */
  maxActive?: number;
  bus?: StreamBus;
}

export interface PipelineSnapshot {
  events: FusedEvent[];
  reviewPairs: PairScore[];
  reliability: ReliabilityState;
  stats: {
    ingested: number;
    normalized: number;
    /** Distinct events currently retained — active window plus frozen.
     *  Must be the number the UI reports, since it is the population every
     *  other published figure is drawn from. Reporting only the active
     *  window here (as an earlier revision did) produced a console that
     *  claimed 60 events while listing 1 087 single-source ones. */
    clusters: number;
    /** Reports absorbed into multi-report clusters, across everything
     *  retained — not just this flush's active window. */
    duplicatesCollapsed: number;
    /** Retained reports, i.e. the sum of every cluster's provenance. */
    reports: number;
    comparisons: number;
    alerts: number;
    lastFlushMs: number;
  };
}

export class FusionPipeline {
  private bus: StreamBus;
  private window: FusedEvent[] = [];
  /* Events whose reporting window has closed. Re-clustering the entire
     retained set on every flush is O(window) per flush and the window
     only grows — measured at ~300 ms per flush after 2 000 reports, on a
     4 s timer, which saturates the main thread and makes the UI
     unresponsive within an hour of a watch.

     Kafka Streams solves this with windowing plus a grace period, and the
     same applies here: incidents older than the grace period are settled.
     New reports about a three-day-old clash are rare, and when one does
     arrive it starts its own cluster rather than silently rewriting
     history an analyst has already adjudicated. So closed events are
     frozen and excluded from re-clustering entirely. */
  private frozen: FusedEvent[] = [];
  private reliability: ReliabilityState = emptyReliability();
  private reviewPairs: PairScore[] = [];
  /** Active + frozen, priority-sorted — what the UI reads. */
  private published: FusedEvent[] = [];
  private dirty = false;
  private unsubs: (() => void)[] = [];
  private listeners = new Set<(s: PipelineSnapshot) => void>();
  private readonly windowMs: number;
  private readonly alertPriority: number;
  private readonly maxEvents: number;
  private readonly graceMs: number;
  private readonly maxActive: number;

  private stats = {
    ingested: 0, normalized: 0, clusters: 0, duplicatesCollapsed: 0,
    reports: 0, comparisons: 0, alerts: 0, lastFlushMs: 0,
  };

  constructor(opts: PipelineOptions = {}) {
    this.bus = opts.bus ?? getBus();
    // 30 days: long enough that the spatio-temporal scan has a baseline
    // period to test the recent week against. Blocking keeps the dedupe
    // cost proportional to events-per-time-bucket, not to window length,
    // so a longer window is cheap.
    this.windowMs = (opts.windowHours ?? 720) * 3600_000;
    this.alertPriority = opts.alertPriority ?? 55;
    this.maxEvents = opts.maxEvents ?? 1500;
    // 48 h: comfortably longer than the slowest routine contributor's
    // filing latency, so a late wire record still joins its cluster.
    this.graceMs = (opts.graceHours ?? 48) * 3600_000;
    this.maxActive = opts.maxActive ?? 400;
  }

  start(): void {
    if (this.unsubs.length) return;

    const rawTopics = [
      TOPICS.RAW_SOCIAL, TOPICS.RAW_NEWS,
      TOPICS.RAW_FIELD, TOPICS.RAW_SENSORS,
    ] as const;

    for (const topic of rawTopics) {
      this.unsubs.push(
        this.bus.subscribe<RawReport>('normaliser', topic, (msg) => {
          this.stats.ingested++;
          const { event } = normalizeReport(msg.value, this.reliability);
          // Reports we cannot place *and* cannot type carry no usable
          // signal; drop them here rather than polluting the window.
          if (!event.location && event.event_type === 'unknown') return;
          this.bus.produce(TOPICS.NORMALIZED, event.event_id, event, 'normaliser');
        }),
      );
    }

    this.unsubs.push(
      this.bus.subscribe<FusedEvent>('aggregator', TOPICS.NORMALIZED, (msg) => {
        this.stats.normalized++;
        this.window.push(msg.value);
        this.dirty = true;
      }),
    );

    this.unsubs.push(
      this.bus.subscribe<Adjudication & { event_id: string; source_type: string; handle?: string }>(
        'reliability-learner', TOPICS.FEEDBACK,
        (msg) => { this.applyFeedback(msg.value); },
      ),
    );
  }

  stop(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  /** Ingest a raw report. Producing onto the bus rather than calling the
   *  normaliser directly keeps the console's throughput numbers real. */
  ingest(raw: RawReport, topic: typeof TOPICS.RAW_SOCIAL | typeof TOPICS.RAW_NEWS | typeof TOPICS.RAW_FIELD | typeof TOPICS.RAW_SENSORS): void {
    this.bus.produce(topic, raw.source_id, raw, `adapter:${raw.source_type}`);
  }

  /** Re-cluster, enrich and re-score the trailing window. Idempotent —
   *  safe to call on a timer whether or not anything changed. */
  flush(force = false): PipelineSnapshot {
    if (!this.dirty && !force) return this.snapshot();
    const t0 = performance.now();
    const now = Date.now();

    // Drop everything outside the retention window, but keep
    // analyst-touched events regardless of age — a confirmed event is a
    // record, not a transient.
    this.window = this.window.filter((e) =>
      e.adjudications.length > 0 ||
      now - new Date(e.timestamp).getTime() <= this.windowMs,
    );
    this.frozen = this.frozen.filter((e) =>
      e.adjudications.length > 0 ||
      now - new Date(e.timestamp).getTime() <= this.windowMs,
    );

    /* Close the window on settled events. Anything an analyst has already
       adjudicated is frozen immediately — re-clustering it could move
       reports in or out of a cluster whose disposition is already on the
       record, which would silently invalidate that decision. */
    const graceCutoff = now - this.graceMs;
    let stillActive: FusedEvent[] = [];
    for (const e of this.window) {
      const settled =
        e.adjudications.length > 0 ||
        new Date(e.timestamp).getTime() < graceCutoff;
      if (settled) this.frozen.push(e); else stillActive.push(e);
    }

    /* A time-based grace period alone does not bound the active set —
       at any sustained ingest rate the number of events inside a 48 h
       window grows with the rate, and the re-clustering cost grows with
       it. So the active set is *also* bounded by count: past the cap, the
       oldest events close early. They are still retained and still shown;
       they simply stop being candidates for re-clustering. */
    if (stillActive.length > this.maxActive) {
      stillActive.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      this.frozen.push(...stillActive.slice(this.maxActive));
      stillActive = stillActive.slice(0, this.maxActive);
    }
    this.window = stillActive;

    /* Flatten: re-clustering must start from the *individual reports*,
       not from previously merged clusters, or the merge becomes
       order-dependent and unstable across flushes. */
    const atoms: FusedEvent[] = [];
    for (const e of this.window) {
      if (e.provenance.length <= 1) { atoms.push(e); continue; }
      /* Re-expanding a cluster with 200 provenance entries into 200 atoms
         every flush is how a single busy locality poisons the whole
         window. Past this many reports the cluster's composition is
         settled; keep it whole. */
      if (e.provenance.length > 40) { atoms.push(e); continue; }
      for (const p of e.provenance) {
        atoms.push({
          ...e,
          event_id: `${e.event_id}#${p.source.id}`,
          provenance: [p],
          source: p.source,
          raw_text: p.raw_text,
          independent_sources: 1,
        });
      }
    }

    const records: DedupeRecord[] = atoms.map((e) => ({
      id: e.event_id,
      timestamp: e.timestamp,
      time_uncertainty_min: e.time_uncertainty_min,
      lat: e.location?.lat ?? null,
      lon: e.location?.lon ?? null,
      radius_km: e.location?.radius_km ?? 30,
      event_type: e.event_type,
      actors: e.actors,
      description: e.description,
      source_key: `${e.source.type}:${e.source.id}`,
      fatalities: e.casualties.fatalities,
    }));

    const byId = new Map(atoms.map((e) => [e.event_id, e]));
    const { clusters, reviewPairs, comparisons } = clusterRecords(records);
    this.reviewPairs = reviewPairs;
    this.stats.comparisons = comparisons;

    const out: FusedEvent[] = [];

    for (const [, memberIds] of clusters) {
      const members = memberIds
        .map((id) => byId.get(id))
        .filter((e): e is FusedEvent => !!e);
      if (!members.length) continue;

      // Deduplicate identical source reports inside a cluster — the same
      // article picked up twice by two adapters is one report.
      const seenSource = new Set<string>();
      const unique = members.filter((m) => {
        const k = `${m.source.type}:${m.source.id}`;
        if (seenSource.has(k)) return false;
        seenSource.add(k);
        return true;
      });

      const merged = mergeCluster(unique, this.reliability);
      // Restore the stable id: a cluster keeps the id of its earliest
      // member so map selection and analyst notes survive re-clustering.
      merged.event_id = stableId(unique);

      /* Enrichment runs once per cluster. */
      if (merged.location) {
        merged.geo = enrichLocation(merged.location.lat, merged.location.lon, {
          knownAdmin: merged.geo?.admin,
          radiusKm: merged.location.radius_km,
        });
      }

      /* Confidence fusion. */
      const adjudicated = lastDecision(merged);
      const fused = fuseConfidence({
        provenance: merged.provenance,
        members: unique.map((m) => ({
          lat: m.location?.lat, lon: m.location?.lon, timestamp: m.timestamp,
        })),
        adjudicated,
        reliability: this.reliability,
        now,
      });
      merged.confidence = +fused.confidence.toFixed(3);
      merged.confidence_factors = fused.factors;
      merged.independent_sources = fused.independentSources;
      merged.status = deriveStatus(merged);
      merged.priority = computePriority(merged, EVENT_TYPE_SEVERITY[merged.event_type]);

      out.push(merged);
      this.bus.produce(TOPICS.ENRICHED, merged.event_id, merged, 'enricher');

      if (merged.priority >= this.alertPriority && merged.status !== 'rejected') {
        this.bus.produce(TOPICS.ALERTS, merged.event_id, merged, 'alerter');
      }

      /* Triage routing. An event goes to the analyst when it is
         consequential but not yet believable — high potential impact with
         low confidence is exactly the case where a human must look. */
      const needsReview =
        merged.status === 'disputed' ||
        (merged.priority >= 45 && merged.confidence < 0.55) ||
        (merged.independent_sources === 1 && (merged.casualties.fatalities ?? 0) >= 5);
      if (needsReview && !merged.adjudications.length) {
        this.bus.produce(TOPICS.TRIAGE, merged.event_id, merged, 'router');
      }
    }

    for (const pair of reviewPairs.slice(0, 20)) {
      this.bus.produce(TOPICS.TRIAGE, `pair:${pair.a}|${pair.b}`, pair, 'router');
    }

    this.window = out;

    // Priority order for the UI; cap by dropping the least urgent, but
    // never an event an analyst has already touched.
    const all = [...out, ...this.frozen].sort((a, b) => b.priority - a.priority);
    this.published = all.length > this.maxEvents
      ? [...all.filter((e) => e.adjudications.length > 0),
         ...all.filter((e) => !e.adjudications.length).slice(0, this.maxEvents)]
      : all;
    /* Session-wide figures over everything retained, so every number the
       console shows is drawn from the same population. */
    this.stats.clusters = this.published.length;
    this.stats.reports = this.published.reduce((n, e) => n + e.provenance.length, 0);
    this.stats.duplicatesCollapsed = this.stats.reports - this.published.length;
    this.stats.alerts = this.published.filter(
      (e) => e.priority >= this.alertPriority && e.status !== 'rejected',
    ).length;
    this.stats.lastFlushMs = +(performance.now() - t0).toFixed(1);
    this.dirty = false;

    const snap = this.snapshot();
    for (const fn of this.listeners) { try { fn(snap); } catch { /* ignore */ } }
    return snap;
  }

  /* ── Analyst actions ──────────────────────────────────────────── */

  adjudicate(
    eventId: string,
    action: Adjudication['action'],
    analyst: string,
    notes?: string,
    mergeWith?: string[],
  ): void {
    const e = this.published.find((x) => x.event_id === eventId);
    if (!e) return;

    const adj: Adjudication = {
      analyst, action, at: new Date().toISOString(), notes, merged_with: mergeWith,
    };
    e.adjudications.push(adj);

    /* Feedback to the reliability model: every contributing source is
       credited or debited for this event. Sources that dissented from a
       cluster that turned out true are debited, and vice versa — which is
       how a source that consistently inflates casualty figures gets
       downgraded without anyone maintaining a list by hand. */
    if (action === 'confirm' || action === 'reject') {
      const correct = action === 'confirm';
      for (const p of e.provenance) {
        const dissented = p.agreement === 'contradict';
        this.reliability = observe(
          this.reliability,
          p.source.type,
          dissented ? !correct : correct,
          p.source.handle,
          p.agreement === 'partial' ? 0.5 : 1,
        );
      }
      this.bus.produce(TOPICS.FEEDBACK, eventId, {
        ...adj, event_id: eventId, source_type: e.source.type, handle: e.source.handle,
      }, 'analyst');
    }

    if (action === 'merge' && mergeWith?.length) {
      for (const otherId of mergeWith) {
        const other = this.published.find((x) => x.event_id === otherId);
        if (!other || other.event_id === e.event_id) continue;
        e.provenance.push(...other.provenance);
        other.status = 'merged';
        other.merged_into = e.event_id;
      }
      this.window = this.window.filter((x) => x.status !== 'merged');
      this.frozen = this.frozen.filter((x) => x.status !== 'merged');
    }

    this.dirty = true;
    this.flush(true);
  }

  /** Analyst dismisses a suggested duplicate pair without merging. */
  dismissPair(a: string, b: string): void {
    this.reviewPairs = this.reviewPairs.filter(
      (p) => !((p.a === a && p.b === b) || (p.a === b && p.b === a)),
    );
    for (const fn of this.listeners) { try { fn(this.snapshot()); } catch { /* ignore */ } }
  }

  private applyFeedback(_v: unknown): void {
    // Feedback is applied synchronously in `adjudicate`; the topic exists
    // so the decision trail is auditable and replayable, and so a future
    // server deployment can consume it without changing this class.
  }

  /* ── Access ───────────────────────────────────────────────────── */

  snapshot(): PipelineSnapshot {
    return {
      events: this.published,
      reviewPairs: this.reviewPairs,
      reliability: this.reliability,
      stats: { ...this.stats },
    };
  }

  onUpdate(fn: (s: PipelineSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  getReliability(): ReliabilityState { return this.reliability; }

  /** Seed the reliability model from a prior session. */
  setReliability(r: ReliabilityState): void { this.reliability = r; }
}

function lastDecision(e: FusedEvent): 'confirm' | 'reject' | null {
  for (let i = e.adjudications.length - 1; i >= 0; i--) {
    const a = e.adjudications[i].action;
    if (a === 'confirm' || a === 'reject') return a;
  }
  return null;
}

/** Deterministic cluster id: the ULID of the earliest-created atom, with
 *  any `#source` suffix stripped. Stable across re-clustering as long as
 *  the cluster's membership does not lose its founding report. */
function stableId(members: FusedEvent[]): string {
  return members
    .map((m) => m.event_id.split('#')[0])
    .sort()[0];
}

/* ── Singleton ───────────────────────────────────────────────────── */

let pipelineSingleton: FusionPipeline | null = null;

export function getPipeline(): FusionPipeline {
  if (!pipelineSingleton) {
    pipelineSingleton = new FusionPipeline();
    pipelineSingleton.start();
  }
  return pipelineSingleton;
}
