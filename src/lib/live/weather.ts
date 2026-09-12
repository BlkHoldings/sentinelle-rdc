/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Meteorological Conditions (Open-Meteo)
   ═══════════════════════════════════════════════════════════════════════

   Weather is not decoration on this map. In the Kivus it is a first-order
   operational constraint:

   • **ISR**: cloud base and visibility decide whether a UAS sortie sees
     anything. A tasked orbit under an overcast deck at 800 m returns
     nothing, and knowing that before launch is the difference between a
     collection gap you planned for and one you discover afterwards.
   • **Mobility**: the RN2 north of Kanyabayonga and essentially every
     axis in Masisi and Walikale are unpaved. Accumulated rainfall over
     24–72 h predicts which of them are passable far better than any map.
   • **Interpretation**: a sharp drop in reporting from a territory during
     a three-day downpour is probably a collection artefact, not calm —
     and this is exactly the kind of thing the SITREP gap analysis should
     be able to say out loud rather than leave an analyst to infer.

   Open-Meteo is used because it is free, needs no key, sets permissive
   CORS, and serves ~1–11 km resolution model output. All of which suits a
   keyless static bundle.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';

export const WEATHER_META: LiveSourceMeta = {
  id: 'open-meteo',
  label: 'Open-Meteo',
  purpose: 'Conditions météo — faisabilité ISR, praticabilité des axes',
  provider: 'Open-Meteo (ECMWF / DWD ICON)',
  docs: 'https://open-meteo.com/en/docs',
  cadence: 'Horaire, modèle rafraîchi toutes les 3 h',
  requiresKey: false,
};

export interface WeatherPoint {
  name: string;
  lat: number;
  lon: number;
  temperature_c: number | null;
  precipitation_mm: number | null;
  /** Accumulated rainfall over the trailing 24 h — the mobility driver. */
  rain_24h_mm: number | null;
  /** Accumulated over 72 h; unpaved axes stay bad well after the rain. */
  rain_72h_mm: number | null;
  cloud_cover_pct: number | null;
  /** Metres. Below ~600 m AGL most UAS optical collection is worthless. */
  cloud_base_m: number | null;
  visibility_m: number | null;
  wind_kmh: number | null;
  wind_gust_kmh: number | null;
  /** Derived assessments, computed below from the raw fields. */
  isr: IsrAssessment;
  mobility: MobilityAssessment;
}

export type IsrAssessment = 'FAVORABLE' | 'DÉGRADÉ' | 'DÉFAVORABLE' | 'INCONNU';
export type MobilityAssessment = 'PRATICABLE' | 'DIFFICILE' | 'IMPRATICABLE' | 'INCONNU';

/* Sites are the places where collection and movement decisions are
   actually made, not a uniform grid. */
export const WEATHER_SITES: { name: string; lat: number; lon: number }[] = [
  { name: 'Goma',         lat: -1.678, lon: 29.228 },
  { name: 'Sake',         lat: -1.573, lon: 28.990 },
  { name: 'Rutshuru',     lat: -1.186, lon: 29.447 },
  { name: 'Masisi',       lat: -1.400, lon: 28.810 },
  { name: 'Beni',         lat:  0.492, lon: 29.472 },
  { name: 'Butembo',      lat:  0.131, lon: 29.291 },
  { name: 'Bunia',        lat:  1.565, lon: 30.245 },
  { name: 'Bukavu',       lat: -2.508, lon: 28.842 },
  { name: 'Uvira',        lat: -3.400, lon: 29.140 },
  { name: 'Walikale',     lat: -1.420, lon: 28.050 },
  { name: 'Kanyabayonga', lat: -0.360, lon: 29.280 },
];

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current?: Record<string, number>;
  hourly?: {
    time: string[];
    precipitation?: (number | null)[];
    cloud_base?: (number | null)[];
    visibility?: (number | null)[];
  };
}

/**
 * Assess ISR feasibility.
 *
 * Thresholds are deliberately coarse and stated rather than tuned: a
 * three-band judgement an operator can sanity-check beats a precise score
 * whose derivation nobody can reconstruct.
 */
function assessIsr(cloudBase: number | null, vis: number | null, cloud: number | null): IsrAssessment {
  if (cloudBase == null && vis == null && cloud == null) return 'INCONNU';
  if ((cloudBase != null && cloudBase < 600) || (vis != null && vis < 3000)) return 'DÉFAVORABLE';
  if ((cloudBase != null && cloudBase < 1500) || (vis != null && vis < 8000) ||
      (cloud != null && cloud > 80)) return 'DÉGRADÉ';
  return 'FAVORABLE';
}

/** Assess unpaved-axis mobility from accumulated rainfall. */
function assessMobility(r24: number | null, r72: number | null): MobilityAssessment {
  if (r24 == null && r72 == null) return 'INCONNU';
  const a = r24 ?? 0, b = r72 ?? 0;
  if (a > 40 || b > 90) return 'IMPRATICABLE';
  if (a > 12 || b > 35) return 'DIFFICILE';
  return 'PRATICABLE';
}

function sumTrailing(arr: (number | null)[] | undefined, times: string[] | undefined, hours: number): number | null {
  if (!arr || !times || !arr.length) return null;
  const now = Date.now();
  let sum = 0, seen = 0;
  for (let i = 0; i < times.length && i < arr.length; i++) {
    const t = new Date(times[i] + 'Z').getTime();
    if (!Number.isFinite(t) || t > now) continue;
    if (now - t > hours * 3_600_000) continue;
    sum += arr[i] ?? 0;
    seen++;
  }
  return seen ? +sum.toFixed(1) : null;
}

function latest(arr: (number | null)[] | undefined, times: string[] | undefined): number | null {
  if (!arr || !times) return null;
  const now = Date.now();
  let best: number | null = null, bestT = -Infinity;
  for (let i = 0; i < times.length && i < arr.length; i++) {
    const t = new Date(times[i] + 'Z').getTime();
    if (!Number.isFinite(t) || t > now) continue;
    if (t > bestT && arr[i] != null) { bestT = t; best = arr[i]!; }
  }
  return best;
}

/**
 * One batched call covering every site.
 *
 * Open-Meteo accepts comma-separated coordinate lists and returns an
 * array, so the whole AOR costs a single request rather than eleven —
 * which matters on a metered link and keeps us well inside the free
 * tier's fair-use limits.
 */
export async function fetchWeather(
  sites = WEATHER_SITES,
): Promise<FetchResult<WeatherPoint[]>> {
  const lats = sites.map((s) => s.lat.toFixed(4)).join(',');
  const lons = sites.map((s) => s.lon.toFixed(4)).join(',');
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lats}&longitude=${lons}` +
    '&current=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_gusts_10m' +
    '&hourly=precipitation,cloud_base,visibility' +
    '&past_days=3&forecast_days=1&timezone=UTC';

  const res = await fetchJSON<OpenMeteoResponse | OpenMeteoResponse[]>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };

  // A single coordinate returns an object; multiple return an array.
  const rows = Array.isArray(res.data) ? res.data : [res.data];

  const points: WeatherPoint[] = rows.map((r, i) => {
    const site = sites[i] ?? { name: `site-${i}`, lat: r.latitude, lon: r.longitude };
    const times = r.hourly?.time;
    const cloudBase = latest(r.hourly?.cloud_base, times);
    const vis = latest(r.hourly?.visibility, times);
    const cloud = r.current?.cloud_cover ?? null;
    const r24 = sumTrailing(r.hourly?.precipitation, times, 24);
    const r72 = sumTrailing(r.hourly?.precipitation, times, 72);

    return {
      name: site.name, lat: site.lat, lon: site.lon,
      temperature_c:    r.current?.temperature_2m ?? null,
      precipitation_mm: r.current?.precipitation ?? null,
      rain_24h_mm: r24,
      rain_72h_mm: r72,
      cloud_cover_pct: cloud,
      cloud_base_m: cloudBase,
      visibility_m: vis,
      wind_kmh:      r.current?.wind_speed_10m ?? null,
      wind_gust_kmh: r.current?.wind_gusts_10m ?? null,
      isr: assessIsr(cloudBase, vis, cloud),
      mobility: assessMobility(r24, r72),
    };
  });

  return { ...res, data: points, count: points.length, newestRecordAt: res.fetchedAt };
}

export const ISR_COLOR: Record<IsrAssessment, string> = {
  FAVORABLE:    'text-grn',
  'DÉGRADÉ':    'text-amb',
  'DÉFAVORABLE':'text-alert',
  INCONNU:      'text-t3',
};

export const MOBILITY_COLOR: Record<MobilityAssessment, string> = {
  PRATICABLE:    'text-grn',
  DIFFICILE:     'text-amb',
  IMPRATICABLE:  'text-alert',
  INCONNU:       'text-t3',
};
