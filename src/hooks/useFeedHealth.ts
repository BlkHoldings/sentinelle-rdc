'use client';

import { useLiveStore } from '@/store/useLiveStore';
import { useOpenDataStore } from '@/store/useOpenDataStore';
import type { FetchResult } from '@/lib/live/client';

export interface FeedStatus { id: string; name: string; result: FetchResult<unknown> }

/**
 * Every polled upstream, in one list. The sync indicator, the overview
 * and the sources view all count from here, so they cannot disagree
 * about how many feeds are up.
 *
 * A source awaiting configuration (ReliefWeb without an appname) is
 * listed but not counted against the total: it is not down, it is off.
 */
export function useFeedHealth(): { feeds: FeedStatus[]; up: number; total: number } {
  const feeds: FeedStatus[] = [
    { id: 'gdelt',        name: 'GDELT',        result: useOpenDataStore((s) => s.gdelt) },
    { id: 'reliefweb',    name: 'ReliefWeb',    result: useLiveStore((s) => s.reliefweb) },
    { id: 'who',          name: 'OMS',          result: useOpenDataStore((s) => s.who) },
    { id: 'displacement', name: 'UNHCR / IDMC', result: useOpenDataStore((s) => s.displacement) },
    { id: 'eonet',        name: 'NASA EONET',   result: useOpenDataStore((s) => s.eonet) },
    { id: 'usgs',         name: 'USGS',         result: useLiveStore((s) => s.seismic) },
    { id: 'gdacs',        name: 'GDACS',        result: useLiveStore((s) => s.gdacs) },
    { id: 'weather',      name: 'Open-Meteo',   result: useLiveStore((s) => s.weather) },
    { id: 'hydro',        name: 'GloFAS',       result: useOpenDataStore((s) => s.hydro) },
  ];
  const active = feeds.filter((f) => !(f.result.health === 'idle' && f.result.error));
  return { feeds, up: active.filter((f) => f.result.health === 'ok' || f.result.health === 'degraded').length, total: active.length };
}
