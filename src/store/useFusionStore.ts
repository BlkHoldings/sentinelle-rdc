'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Fusion Store
   ═══════════════════════════════════════════════════════════════════════

   Owns the pipeline instance and drives it from React. Deliberately thin:
   all analytic logic lives in `@/lib/fusion` (pure, testable, no React),
   and this layer only schedules work and mirrors results into component
   state.

   Two scheduling rules worth stating, because getting them wrong makes
   the whole thing feel broken:

   • The pipeline re-clusters on a *timer*, not on every ingest. A flush
     re-scores the whole trailing window; doing that per arriving report
     would burn the main thread and produce a UI that flickers as
     clusters form and reform mid-batch.

   • The spatio-temporal scan is the single most expensive operation in
     the system (~200 ms for a Monte Carlo over the full candidate set).
     It runs on its own, much slower cadence, and never inside a flush.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand';
import {
  FusionPipeline, type PipelineSnapshot,
} from '@/lib/fusion/pipeline';
import { getBus, TOPICS, type TopicStats } from '@/lib/fusion/bus';
import {
  SyntheticStream, TelecomTelemetry, MONITORED_PROVINCES,
  bridgeIntelEvents, fetchNewsFeeds, type FeedResult,
} from '@/lib/fusion/sources';
import {
  createProvinceMonitor, pushSample, spatioTemporalScan,
  type ProvinceMonitor, type ScanCluster,
} from '@/lib/fusion/anomaly';
import { EVENT_TYPE_SEVERITY, type FusedEvent, type Adjudication } from '@/lib/fusion/schema';
import { type ReliabilityState, emptyReliability } from '@/lib/fusion/reliability';
import type { PairScore } from '@/lib/fusion/dedupe';
import type { IntelEvent } from '@/types/intel';

const RELIABILITY_KEY = 'sentinelle.reliability.v1';

/* Reliability posteriors are the one piece of state worth surviving a
   reload: they encode every adjudication the analyst has ever made, and
   losing them silently resets the system's learned judgement. */
function loadReliability(): ReliabilityState {
  if (typeof window === 'undefined') return emptyReliability();
  try {
    const raw = window.localStorage.getItem(RELIABILITY_KEY);
    if (!raw) return emptyReliability();
    const parsed = JSON.parse(raw) as ReliabilityState;
    return parsed?.observations ? parsed : emptyReliability();
  } catch {
    return emptyReliability();
  }
}

function saveReliability(r: ReliabilityState): void {
  try { window.localStorage.setItem(RELIABILITY_KEY, JSON.stringify(r)); }
  catch { /* private mode / quota — the model still works in-session */ }
}

export interface FusionState {
  running: boolean;
  seeded: boolean;
  events: FusedEvent[];
  reviewPairs: PairScore[];
  stats: PipelineSnapshot['stats'];
  topics: TopicStats[];
  monitors: ProvinceMonitor[];
  clusters: ScanCluster[];
  feeds: FeedResult[];
  /** Currently selected event in the triage queue. */
  selectedId: string | null;
  /** Analyst identity used for the adjudication trail. */
  analyst: string;
  lastScanMs: number;

  seed: (intelEvents: IntelEvent[], analyst: string) => void;
  start: () => void;
  stop: () => void;
  select: (id: string | null) => void;
  adjudicate: (id: string, action: Adjudication['action'], notes?: string, mergeWith?: string[]) => void;
  dismissPair: (a: string, b: string) => void;
  runScan: () => void;
  pullFeeds: () => Promise<void>;
  injectOutage: (province: string) => void;
  reliability: () => ReliabilityState;
}

/* Module-scope singletons — these are engine objects, not render state,
   and must not be recreated when a component remounts. */
let pipeline: FusionPipeline | null = null;
let stream: SyntheticStream | null = null;
let telecom: TelecomTelemetry | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let telemetryTimer: ReturnType<typeof setInterval> | null = null;
let scanTimer: ReturnType<typeof setInterval> | null = null;

const STREAM_TICK_MS = 6_000;
const FLUSH_MS = 4_000;
const TELEMETRY_MS = 5_000;
const SCAN_MS = 45_000;

export const useFusionStore = create<FusionState>((set, get) => ({
  running: false,
  seeded: false,
  events: [],
  reviewPairs: [],
  stats: {
    ingested: 0, normalized: 0, clusters: 0, duplicatesCollapsed: 0,
    reports: 0, comparisons: 0, alerts: 0, lastFlushMs: 0,
  },
  topics: [],
  monitors: [],
  clusters: [],
  feeds: [],
  selectedId: null,
  analyst: 'ANALYSTE',
  lastScanMs: 0,

  /* ── Seeding ────────────────────────────────────────────────────
     Runs once per session: builds the pipeline, replays a synthetic
     history so the analyst opens onto a populated theatre rather than an
     empty queue, and folds in whatever the real ACLED/FIRMS/UAS feeds
     returned so both paths share one fusion layer. */
  seed(intelEvents, analyst) {
    if (get().seeded) return;

    pipeline = new FusionPipeline();
    pipeline.setReliability(loadReliability());
    pipeline.start();

    stream = new SyntheticStream(Date.now() % 1_000_000);
    telecom = new TelecomTelemetry();

    // Warm the connectivity baselines on 14 days of history so the
    // detector has a seasonal profile before the first live sample.
    const monitors = MONITORED_PROVINCES.map((p) => createProvinceMonitor(p));
    const t0 = Date.now() - 14 * 86_400_000;
    for (const m of monitors) {
      for (let h = 0; h < 14 * 24; h++) {
        const at = new Date(t0 + h * 3_600_000);
        pushSample(m, telecom.sample(m.province, at), at);
      }
    }

    for (const { report, topic } of stream.backfill(240, 45)) {
      pipeline.ingest(report, topic as typeof TOPICS.RAW_NEWS);
    }
    for (const { report, topic } of bridgeIntelEvents(intelEvents)) {
      pipeline.ingest(report, topic as typeof TOPICS.RAW_NEWS);
    }

    pipeline.onUpdate((snap) => {
      set({
        events: snap.events,
        reviewPairs: snap.reviewPairs,
        stats: snap.stats,
        topics: getBus().stats(),
      });
    });

    const snap = pipeline.flush(true);
    set({
      seeded: true, analyst,
      monitors,
      events: snap.events,
      reviewPairs: snap.reviewPairs,
      stats: snap.stats,
      topics: getBus().stats(),
    });

    get().runScan();
    get().start();
  },

  start() {
    if (get().running || !pipeline || !stream || !telecom) return;

    tickTimer = setInterval(() => {
      if (!pipeline || !stream) return;
      for (const { report, topic } of stream.tick()) {
        pipeline.ingest(report, topic as typeof TOPICS.RAW_NEWS);
      }
    }, STREAM_TICK_MS);

    flushTimer = setInterval(() => {
      pipeline?.flush();
      set({ topics: getBus().stats() });
    }, FLUSH_MS);

    telemetryTimer = setInterval(() => {
      const { monitors } = get();
      if (!telecom || !monitors.length) return;
      const at = new Date();
      for (const m of monitors) {
        const v = telecom.sample(m.province, at);
        pushSample(m, v, at);
        // Sensor telemetry enters the same pipeline as every other
        // source, so a connectivity collapse can corroborate a reported
        // offensive rather than living in a separate silo.
        pipeline?.ingest(telecom.report(m.province, v, at), TOPICS.RAW_SENSORS);
      }
      set({ monitors: [...monitors] });
    }, TELEMETRY_MS);

    scanTimer = setInterval(() => { get().runScan(); }, SCAN_MS);

    set({ running: true });
  },

  stop() {
    for (const t of [tickTimer, flushTimer, telemetryTimer, scanTimer]) {
      if (t) clearInterval(t);
    }
    tickTimer = flushTimer = telemetryTimer = scanTimer = null;
    set({ running: false });
  },

  select(id) { set({ selectedId: id }); },

  adjudicate(id, action, notes, mergeWith) {
    if (!pipeline) return;
    pipeline.adjudicate(id, action, get().analyst, notes, mergeWith);
    saveReliability(pipeline.getReliability());
    const snap = pipeline.snapshot();
    set({
      events: snap.events,
      reviewPairs: snap.reviewPairs,
      stats: snap.stats,
      topics: getBus().stats(),
    });
  },

  dismissPair(a, b) {
    pipeline?.dismissPair(a, b);
    const snap = pipeline?.snapshot();
    if (snap) set({ reviewPairs: snap.reviewPairs });
  },

  /* The expensive one. Kept off the flush path deliberately. */
  runScan() {
    const { events } = get();
    const now = Date.now();
    const geo = events.filter((e) => e.location && e.status !== 'rejected');
    const t0 = performance.now();
    const clusters = spatioTemporalScan(
      geo.filter((e) => new Date(e.timestamp).getTime() >= now - 7 * 86_400_000)
         .map((e) => ({
           lat: e.location!.lat, lon: e.location!.lon,
           t: new Date(e.timestamp).getTime(),
           w: e.confidence * (0.5 + EVENT_TYPE_SEVERITY[e.event_type]),
         })),
      geo.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t < now - 7 * 86_400_000 && t >= now - 60 * 86_400_000;
      }).map((e) => ({ lat: e.location!.lat, lon: e.location!.lon, t: new Date(e.timestamp).getTime() })),
      { now, replicas: 99, maxClusters: 5 },
    );
    set({ clusters, lastScanMs: +(performance.now() - t0).toFixed(0) });
  },

  async pullFeeds() {
    const results = await fetchNewsFeeds();
    set({ feeds: results });
    if (!pipeline) return;
    for (const r of results) {
      for (const report of r.reports) pipeline.ingest(report, TOPICS.RAW_NEWS);
    }
    pipeline.flush(true);
  },

  injectOutage(province) {
    telecom?.injectOutage(province, 6, 0.72);
  },

  reliability() {
    return pipeline?.getReliability() ?? emptyReliability();
  },
}));

/** Direct pipeline access for components that need it (rare). */
export function getFusionPipeline(): FusionPipeline | null { return pipeline; }
