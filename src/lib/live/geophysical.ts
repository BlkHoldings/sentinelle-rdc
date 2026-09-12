/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Geophysical Feeds (USGS · GDACS)
   ═══════════════════════════════════════════════════════════════════════

   Two reasons these belong in a conflict monitor rather than a separate
   hazard tool:

   • **Nyiragongo.** The volcano sits 18 km from a city of a million
     people and last erupted in May 2021 with a few hours of warning,
     displacing several hundred thousand. Seismic swarms beneath the
     Nyiragongo–Nyamulagira system are the only meaningful precursor, and
     an evacuation and a displacement crisis are the same operational
     problem whether the cause is M23 or magma.
   • **Attribution.** A felt tremor generates exactly the same first wave
     of social reporting as an explosion — "forte détonation", "la terre
     a tremblé". Having the seismic catalogue in the same pipeline lets
     the fusion layer corroborate or contradict those reports instead of
     classifying them as shelling.

   Both feeds are public, keyless and CORS-enabled.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, inAOR, type FetchResult, type LiveSourceMeta } from './client';

export const SEISMIC_META: LiveSourceMeta = {
  id: 'usgs-seismic',
  label: 'USGS — sismicité',
  purpose: 'Séismes — précurseurs volcaniques, désambiguïsation détonation/tremblement',
  provider: 'U.S. Geological Survey',
  docs: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
  cadence: 'Continu, latence ~5 min',
  requiresKey: false,
};

export interface SeismicEvent {
  id: string;
  time: string;
  lat: number;
  lon: number;
  depth_km: number;
  magnitude: number;
  place: string;
  /** Distance to Nyiragongo's summit in km — the number that matters. */
  km_to_nyiragongo: number;
  url: string;
}

/** Nyiragongo summit crater. */
const NYIRAGONGO = { lat: -1.522, lon: 29.250 };

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180, la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface UsgsFeature {
  id: string;
  properties: { time: number; mag: number | null; place: string | null; url: string };
  geometry: { coordinates: [number, number, number] };
}

/**
 * Global feed, filtered client-side to the AOR.
 *
 * USGS does offer a bbox query API, but the static summary feeds are
 * cached at the edge and answer in a fraction of the time. At a few
 * hundred kilobytes for a month of global M2.5+, pulling the whole thing
 * and filtering locally is faster than a parameterised query.
 */
export async function fetchSeismic(
  window: 'hour' | 'day' | 'week' | 'month' = 'month',
  minMag = 2.5,
): Promise<FetchResult<SeismicEvent[]>> {
  const feed = minMag >= 4.5 ? '4.5' : minMag >= 2.5 ? '2.5' : 'all';
  const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}_${window}.geojson`;

  const res = await fetchJSON<{ features: UsgsFeature[] }>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data?.features) return { ...res, data: null, count: 0 };

  const events: SeismicEvent[] = res.data.features
    .map((f) => {
      const [lon, lat, depth] = f.geometry.coordinates;
      return {
        id: f.id,
        time: new Date(f.properties.time).toISOString(),
        lat, lon,
        depth_km: depth,
        magnitude: f.properties.mag ?? 0,
        place: f.properties.place ?? 'inconnu',
        km_to_nyiragongo: +haversineKm(lat, lon, NYIRAGONGO.lat, NYIRAGONGO.lon).toFixed(1),
        url: f.properties.url,
      };
    })
    // Widen slightly beyond the AOR: the Rwandan and Ugandan sides of the
    // rift are the same seismic system and seismographs there constrain
    // Congolese events.
    .filter((e) => inAOR(e.lat, e.lon) || e.km_to_nyiragongo < 400)
    .sort((a, b) => b.time.localeCompare(a.time));

  return {
    ...res,
    data: events,
    count: events.length,
    newestRecordAt: events[0]?.time,
  };
}

/** Events close enough and shallow enough to be volcano-tectonic. */
export function volcanicCandidates(events: SeismicEvent[]): SeismicEvent[] {
  return events.filter((e) => e.km_to_nyiragongo < 60 && e.depth_km < 25);
}

/* ── GDACS ───────────────────────────────────────────────────────── */

export const GDACS_META: LiveSourceMeta = {
  id: 'gdacs',
  label: 'GDACS',
  purpose: 'Alertes multirisques — inondations, volcans, cyclones, épidémies',
  provider: 'Commission européenne / ONU (GDACS)',
  docs: 'https://www.gdacs.org/',
  cadence: 'Continu',
  requiresKey: false,
};

export interface GdacsAlert {
  id: string;
  title: string;
  type: string;
  level: 'Green' | 'Orange' | 'Red' | string;
  country: string;
  from: string;
  lat: number | null;
  lon: number | null;
  url: string;
}

interface GdacsFeature {
  properties: Record<string, unknown>;
  geometry?: { coordinates?: [number, number] };
}

/** GDACS GeoJSON, filtered to DRC and its immediate neighbours. */
export async function fetchGdacs(): Promise<FetchResult<GdacsAlert[]>> {
  const url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?country=COD';
  const res = await fetchJSON<{ features?: GdacsFeature[] }>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };

  const feats = res.data.features ?? [];
  const alerts: GdacsAlert[] = feats.map((f) => {
    const p = f.properties ?? {};
    const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
    const coords = f.geometry?.coordinates;
    return {
      id: str('eventid') || str('eventtype') + str('fromdate'),
      title: str('name') || str('htmldescription').replace(/<[^>]+>/g, '').slice(0, 160),
      type: str('eventtype'),
      level: str('alertlevel'),
      country: str('country'),
      from: str('fromdate'),
      lat: Array.isArray(coords) ? coords[1] : null,
      lon: Array.isArray(coords) ? coords[0] : null,
      url: str('url') || 'https://www.gdacs.org/',
    };
  });

  return {
    ...res,
    data: alerts,
    count: alerts.length,
    newestRecordAt: alerts[0]?.from,
  };
}
