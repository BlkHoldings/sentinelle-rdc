'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Live Source Store
   ═══════════════════════════════════════════════════════════════════════

   Owns every keyless real-time feed and, just as importantly, their
   health. Nothing here throws: a source that fails records why and the
   rest carry on. A monitoring tool whose whole screen dies because one
   upstream returned a 502 is worse than no tool, because the failure is
   invisible at exactly the moment it matters.

   Refresh cadences are matched to how fast each upstream actually
   changes, not to a single global timer. Polling a monthly seismic
   catalogue every minute wastes the analyst's bandwidth and the
   provider's goodwill in equal measure.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand';
import { emptyResult, type FetchResult, type LiveSourceMeta } from '@/lib/live/client';
import { fetchWeather, WEATHER_META, type WeatherPoint } from '@/lib/live/weather';
import {
  fetchSeismic, fetchGdacs, SEISMIC_META, GDACS_META,
  type SeismicEvent, type GdacsAlert,
} from '@/lib/live/geophysical';
import {
  fetchReliefWeb, toRawReports, RELIEFWEB_META, type ReliefWebReport,
} from '@/lib/live/reliefweb';
import { fetchOsmInfrastructure, OSM_META, type OsmFeature } from '@/lib/live/osm';
import { getPipeline } from '@/lib/fusion/pipeline';
import { TOPICS } from '@/lib/fusion/bus';

/** Refresh intervals, in ms, matched to each upstream's real cadence. */
const CADENCE = {
  weather:    10 * 60_000,
  seismic:     5 * 60_000,
  gdacs:      15 * 60_000,
  reliefweb:  10 * 60_000,
} as const;

export interface LiveState {
  weather:   FetchResult<WeatherPoint[]>;
  seismic:   FetchResult<SeismicEvent[]>;
  gdacs:     FetchResult<GdacsAlert[]>;
  reliefweb: FetchResult<ReliefWebReport[]>;
  osm:       FetchResult<OsmFeature[]>;

  /** True while any source is in flight. */
  busy: boolean;
  autoRefresh: boolean;
  /** ReliefWeb ids already pushed into fusion, so refresh doesn't duplicate. */
  ingestedIds: Set<string>;

  meta: LiveSourceMeta[];

  refreshWeather:   () => Promise<void>;
  refreshSeismic:   () => Promise<void>;
  refreshGdacs:     () => Promise<void>;
  refreshReliefWeb: () => Promise<void>;
  queryOsm:         (bbox: [number, number, number, number]) => Promise<void>;
  refreshAll:       () => Promise<void>;
  startAuto:        () => void;
  stopAuto:         () => void;
}

let timers: ReturnType<typeof setInterval>[] = [];

export const useLiveStore = create<LiveState>((set, get) => ({
  weather:   emptyResult<WeatherPoint[]>(),
  seismic:   emptyResult<SeismicEvent[]>(),
  gdacs:     emptyResult<GdacsAlert[]>(),
  reliefweb: emptyResult<ReliefWebReport[]>(),
  osm:       emptyResult<OsmFeature[]>(),

  busy: false,
  autoRefresh: false,
  ingestedIds: new Set<string>(),

  meta: [WEATHER_META, SEISMIC_META, RELIEFWEB_META, GDACS_META, OSM_META],

  async refreshWeather() {
    set((s) => ({ weather: { ...s.weather, health: 'loading' } }));
    set({ weather: await fetchWeather() });
  },

  async refreshSeismic() {
    set((s) => ({ seismic: { ...s.seismic, health: 'loading' } }));
    set({ seismic: await fetchSeismic('month', 2.5) });
  },

  async refreshGdacs() {
    set((s) => ({ gdacs: { ...s.gdacs, health: 'loading' } }));
    set({ gdacs: await fetchGdacs() });
  },

  /* ReliefWeb is the one source that feeds the fusion pipeline rather
     than just a panel, so it does double duty here. */
  async refreshReliefWeb() {
    set((s) => ({ reliefweb: { ...s.reliefweb, health: 'loading' } }));
    const res = await fetchReliefWeb(40);
    set({ reliefweb: res });

    if (!res.ok || !res.data?.length) return;
    const seen = get().ingestedIds;
    const fresh = res.data.filter((r) => !seen.has(r.id));
    if (!fresh.length) return;

    try {
      const pipe = getPipeline();
      for (const raw of toRawReports(fresh)) {
        pipe.ingest(raw, TOPICS.RAW_FIELD);
      }
      pipe.flush(true);
      const next = new Set(seen);
      for (const r of fresh) next.add(r.id);
      set({ ingestedIds: next });
    } catch {
      // The pipeline may not be seeded yet if the operator opened the data
      // view first. The reports are still shown; they just miss this pass.
    }
  },

  async queryOsm(bbox) {
    set((s) => ({ osm: { ...s.osm, health: 'loading' } }));
    set({ osm: await fetchOsmInfrastructure(bbox) });
  },

  async refreshAll() {
    set({ busy: true });
    // Parallel: these are independent upstreams and the slowest should
    // not gate the rest. Overpass is excluded — it is viewport-scoped and
    // strictly on demand.
    await Promise.allSettled([
      get().refreshWeather(),
      get().refreshSeismic(),
      get().refreshReliefWeb(),
      get().refreshGdacs(),
    ]);
    set({ busy: false });
  },

  startAuto() {
    if (get().autoRefresh) return;
    timers.push(setInterval(() => { void get().refreshWeather(); },   CADENCE.weather));
    timers.push(setInterval(() => { void get().refreshSeismic(); },   CADENCE.seismic));
    timers.push(setInterval(() => { void get().refreshReliefWeb(); }, CADENCE.reliefweb));
    timers.push(setInterval(() => { void get().refreshGdacs(); },     CADENCE.gdacs));
    set({ autoRefresh: true });
  },

  stopAuto() {
    for (const t of timers) clearInterval(t);
    timers = [];
    set({ autoRefresh: false });
  },
}));
