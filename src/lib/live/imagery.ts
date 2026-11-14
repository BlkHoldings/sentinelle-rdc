/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Latest optical imagery (Sentinel-2)
   ═══════════════════════════════════════════════════════════════════════

   When was this place last seen from orbit, and was it under cloud? The
   answer bounds what any optical assessment can claim. A report of
   "nothing visible at the airstrip" means one thing under a clear scene
   from yesterday and nothing at all under a 100 %-cloud scene from three
   weeks ago.

   Served by Element84's Earth Search — a public STAC catalogue of
   Sentinel-2 L2A on AWS, keyless and CORS-open, so no Copernicus account
   is needed. This is scene *metadata and a preview thumbnail*, not the
   full raster: it says what imagery exists and how usable it is.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';

export interface Scene {
  id: string;
  datetime: string;
  cloudCover: number | null;
  platform: string;
  thumbnail: string | null;
  bbox: number[] | null;
}

export const IMAGERY_META: LiveSourceMeta = {
  id: 'imagery',
  label: 'Imagerie optique récente (Sentinel-2)',
  purpose: 'Dernière scène Sentinel-2 disponible sur la zone est, avec sa couverture nuageuse — ce que l’optique peut ou ne peut pas montrer, en ce moment.',
  provider: 'Copernicus Sentinel-2 via Element84 Earth Search',
  docs: 'https://earth-search.aws.element84.com/v1',
  cadence: '~5 jours (revisite satellite)',
  requiresKey: false,
};

/** Eastern DRC AOR, where the optical question actually matters. */
const AOR_BBOX = [27.8, -3.6, 30.2, 1.6];

interface RawFeature {
  id?: string;
  bbox?: number[];
  properties?: { datetime?: string; 'eo:cloud_cover'?: number; platform?: string };
  assets?: { thumbnail?: { href?: string }; preview?: { href?: string } };
}

export function parseScenes(raw: { features?: RawFeature[] }): Scene[] {
  return (raw.features ?? [])
    .filter((f) => f.id && f.properties?.datetime)
    .map((f) => ({
      id: f.id!,
      datetime: f.properties!.datetime!,
      cloudCover: typeof f.properties!['eo:cloud_cover'] === 'number' ? f.properties!['eo:cloud_cover']! : null,
      platform: f.properties!.platform ?? 'sentinel-2',
      thumbnail: f.assets?.thumbnail?.href ?? f.assets?.preview?.href ?? null,
      bbox: f.bbox ?? null,
    }))
    .sort((a, b) => b.datetime.localeCompare(a.datetime));
}

export interface ImageryResult {
  scenes: Scene[];
  /** Newest scene with usable (<40 %) cloud, if any — the freshest clear look. */
  freshestClear: Scene | null;
}

export async function fetchImagery(): Promise<FetchResult<ImageryResult>> {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86_400_000);
  const body = {
    collections: ['sentinel-2-l2a'],
    bbox: AOR_BBOX,
    datetime: `${from.toISOString()}/${now.toISOString()}`,
    limit: 20,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
  };
  const res = await fetchJSON<{ features?: RawFeature[] }>(
    'https://earth-search.aws.element84.com/v1/search',
    { timeoutMs: 20_000, method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };
  const scenes = parseScenes(res.data);
  const freshestClear = scenes.find((s) => s.cloudCover != null && s.cloudCover < 40) ?? null;
  return {
    ...res, data: { scenes, freshestClear }, count: scenes.length,
    health: scenes.length ? 'ok' : 'degraded',
    newestRecordAt: scenes[0]?.datetime,
  };
}
