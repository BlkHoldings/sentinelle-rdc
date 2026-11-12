'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Open data store
   ═══════════════════════════════════════════════════════════════════════

   The institutional and press feeds added on top of the original four.
   Same contract as the live store: nothing throws, every source carries
   its own health, and each refreshes at the pace its publisher updates.

   GDELT is the one that feeds the fusion engine. Its articles are handed
   over once each — the set of ids already ingested is kept here so a
   refresh adds the new headlines and never duplicates the old.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand';
import { emptyResult, type FetchResult, type LiveSourceMeta } from '@/lib/live/client';
import { fetchGdelt, gdeltToRawReports, GDELT_META, type GdeltArticle } from '@/lib/live/gdelt';
import {
  fetchWho, fetchDisplacement, fetchEonet, fetchHydro,
  WHO_META, DISPLACEMENT_META, EONET_META, HYDRO_META,
  type OutbreakNotice, type DisplacementYear, type NaturalEvent, type RiverReading,
} from '@/lib/live/opendata';
import { useFusionStore } from '@/store/useFusionStore';
import { asset } from '@/lib/asset';

const MIN = 60_000;
const CADENCE = { gdelt: 15 * MIN, eonet: 60 * MIN, hydro: 180 * MIN, who: 180 * MIN } as const;

export interface OpenDataState {
  gdelt: FetchResult<GdeltArticle[]>;
  who: FetchResult<OutbreakNotice[]>;
  displacement: FetchResult<DisplacementYear[]>;
  eonet: FetchResult<NaturalEvent[]>;
  hydro: FetchResult<RiverReading[]>;
  ingested: Set<string>;
  started: boolean;

  refreshGdelt: () => Promise<void>;
  refreshWho: () => Promise<void>;
  refreshDisplacement: () => Promise<void>;
  refreshEonet: () => Promise<void>;
  refreshHydro: () => Promise<void>;
  refreshAll: () => Promise<void>;
  startAuto: () => void;
  stopAuto: () => void;
}

export const OPEN_META: Record<'gdelt' | 'who' | 'displacement' | 'eonet' | 'hydro', LiveSourceMeta> = {
  gdelt: GDELT_META, who: WHO_META, displacement: DISPLACEMENT_META,
  eonet: EONET_META, hydro: HYDRO_META,
};

let timers: ReturnType<typeof setInterval>[] = [];

/** Outer rings of the national boundary, from the build's own static file. */
let borderCache: number[][][] | null = null;
async function nationalBorder(): Promise<number[][][] | undefined> {
  if (borderCache) return borderCache;
  try {
    const r = await fetch(asset('/geo/cod-adm0.json'));
    if (!r.ok) return undefined;
    const fc = await r.json() as { features: { geometry: { coordinates: number[][][][] } }[] };
    borderCache = fc.features.flatMap((f) => f.geometry.coordinates.map((poly) => poly[0]));
    return borderCache;
  } catch { return undefined; }
}

/** Mark loading without discarding what is already on screen. */
const loading = <T,>(r: FetchResult<T>): FetchResult<T> => ({ ...r, health: 'loading' });
/** A failed refresh keeps the last good data, flagged with the error. */
const settle = <T,>(prev: FetchResult<T>, next: FetchResult<T>): FetchResult<T> =>
  next.ok || !prev.data ? next : { ...next, data: prev.data, count: prev.count, newestRecordAt: prev.newestRecordAt };

export const useOpenDataStore = create<OpenDataState>((set, get) => ({
  gdelt: emptyResult<GdeltArticle[]>(),
  who: emptyResult<OutbreakNotice[]>(),
  displacement: emptyResult<DisplacementYear[]>(),
  eonet: emptyResult<NaturalEvent[]>(),
  hydro: emptyResult<RiverReading[]>(),
  ingested: new Set<string>(),
  started: false,

  async refreshGdelt() {
    set((s) => ({ gdelt: loading(s.gdelt) }));
    const res = await fetchGdelt();
    set((s) => ({ gdelt: settle(s.gdelt, res) }));
    if (!res.ok || !res.data?.length) return;
    const seen = get().ingested;
    const fresh = res.data.filter((a) => !seen.has(a.url));
    if (!fresh.length) return;
    useFusionStore.getState().ingestReports(gdeltToRawReports(fresh), 'news');
    const next = new Set(seen);
    for (const a of fresh) next.add(a.url);
    set({ ingested: next });
  },

  async refreshWho() {
    set((s) => ({ who: loading(s.who) }));
    const res = await fetchWho();
    set((s) => ({ who: settle(s.who, res) }));
  },
  async refreshDisplacement() {
    set((s) => ({ displacement: loading(s.displacement) }));
    const res = await fetchDisplacement();
    set((s) => ({ displacement: settle(s.displacement, res) }));
  },
  async refreshEonet() {
    set((s) => ({ eonet: loading(s.eonet) }));
    const res = await fetchEonet(await nationalBorder());
    set((s) => ({ eonet: settle(s.eonet, res) }));
  },
  async refreshHydro() {
    set((s) => ({ hydro: loading(s.hydro) }));
    const res = await fetchHydro();
    set((s) => ({ hydro: settle(s.hydro, res) }));
  },
  async refreshAll() {
    const s = get();
    await Promise.allSettled([
      s.refreshGdelt(), s.refreshWho(), s.refreshDisplacement(),
      s.refreshEonet(), s.refreshHydro(),
    ]);
  },

  startAuto() {
    if (get().started) return;
    const s = get();
    timers = [
      setInterval(() => void s.refreshGdelt(), CADENCE.gdelt),
      setInterval(() => void s.refreshEonet(), CADENCE.eonet),
      setInterval(() => void s.refreshHydro(), CADENCE.hydro),
      setInterval(() => void s.refreshWho(), CADENCE.who),
    ];
    set({ started: true });
  },

  stopAuto() {
    for (const t of timers) clearInterval(t);
    timers = [];
    set({ started: false });
  },
}));
