/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — OpenStreetMap Infrastructure (Overpass)
   ═══════════════════════════════════════════════════════════════════════

   The embedded infrastructure layer in `lib/fusion/infrastructure.ts` is
   a curated list of ~80 facilities: accurate, but hand-maintained and
   deliberately small so it can ship inside the bundle.

   This is the escape hatch. Overpass queries live OSM at full resolution
   for whatever the analyst is actually looking at — every clinic, bridge,
   ford, airstrip, fuel station and track inside the current viewport,
   with real geometry rather than a centroid.

   Three deliberate constraints:

   • **On demand, never automatic.** Overpass is donated infrastructure
     with published fair-use limits. A polling loop from every open tab
     would be abuse; this runs when an operator asks for the view they
     are looking at.
   • **Bounded viewport.** Wide-area queries are refused client-side
     rather than sent and timed out — a request for the whole AOR would
     take minutes and probably be dropped upstream anyway.
   • **Honest provenance.** OSM coverage in eastern DRC is uneven: good in
     Goma and Bukavu, thin in rural Walikale. Absence of a feature here is
     emphatically not evidence of absence on the ground, and the UI says
     so rather than letting an empty result read as a cleared area.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';

export const OSM_META: LiveSourceMeta = {
  id: 'overpass',
  label: 'OpenStreetMap (Overpass)',
  purpose: 'Infrastructure haute résolution dans la vue courante',
  provider: 'OpenStreetMap contributors / Overpass API',
  docs: 'https://wiki.openstreetmap.org/wiki/Overpass_API',
  cadence: 'À la demande — quota d\'usage équitable',
  requiresKey: false,
};

export type OsmCategory = 'health' | 'transport' | 'water' | 'power' | 'education' | 'other';

export interface OsmFeature {
  id: string;
  name: string;
  category: OsmCategory;
  /** Raw OSM tag that classified it, kept for traceability. */
  tag: string;
  lat: number;
  lon: number;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Beyond this the query is too broad to answer usefully or politely. */
export const MAX_QUERY_AREA_DEG2 = 0.6;

function classify(tags: Record<string, string>): { category: OsmCategory; tag: string } | null {
  const a = tags.amenity, h = tags.healthcare, ae = tags.aeroway, hw = tags.highway;
  if (h || a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy') {
    return { category: 'health', tag: h ? `healthcare=${h}` : `amenity=${a}` };
  }
  if (ae) return { category: 'transport', tag: `aeroway=${ae}` };
  if (a === 'fuel') return { category: 'transport', tag: 'amenity=fuel' };
  if (tags.bridge === 'yes' || hw === 'ford') {
    return { category: 'transport', tag: tags.bridge ? 'bridge' : 'ford' };
  }
  if (tags.man_made === 'water_tower' || a === 'drinking_water' || tags.man_made === 'water_well') {
    return { category: 'water', tag: tags.man_made ?? `amenity=${a}` };
  }
  if (tags.power) return { category: 'power', tag: `power=${tags.power}` };
  if (a === 'school' || a === 'university' || a === 'college') {
    return { category: 'education', tag: `amenity=${a}` };
  }
  return null;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Query infrastructure inside a bounding box.
 *
 * `out center` makes ways and relations return a representative point, so
 * a hospital mapped as a building polygon comes back usable rather than
 * as an unresolved node list.
 */
export async function fetchOsmInfrastructure(
  bbox: [number, number, number, number],
): Promise<FetchResult<OsmFeature[]>> {
  const [w, s, e, n] = bbox;
  const area = Math.abs(e - w) * Math.abs(n - s);
  if (area > MAX_QUERY_AREA_DEG2) {
    return {
      ok: false, health: 'degraded', data: null, count: 0, latencyMs: 0,
      fetchedAt: new Date().toISOString(),
      error: `zone trop vaste (${area.toFixed(2)} deg² > ${MAX_QUERY_AREA_DEG2}) — zoomez avant d'interroger`,
    };
  }

  const bb = `${s},${w},${n},${e}`;
  const query = `[out:json][timeout:25];(
    node["amenity"~"^(hospital|clinic|doctors|pharmacy|fuel|school|university|college|drinking_water)$"](${bb});
    way["amenity"~"^(hospital|clinic|doctors|school|university)$"](${bb});
    node["healthcare"](${bb});
    way["healthcare"](${bb});
    node["aeroway"](${bb});
    way["aeroway"~"^(aerodrome|runway|helipad)$"](${bb});
    way["bridge"="yes"](${bb});
    node["man_made"~"^(water_tower|water_well)$"](${bb});
    node["power"~"^(substation|generator|plant)$"](${bb});
  );out center 600;`;

  let last: FetchResult<{ elements?: OverpassElement[] }> | null = null;
  for (const endpoint of ENDPOINTS) {
    const url = `${endpoint}?data=${encodeURIComponent(query)}`;
    const res = await fetchJSON<{ elements?: OverpassElement[] }>(url, {
      timeoutMs: 30_000, retries: 0,
    });
    last = res;
    if (!res.ok || !res.data?.elements) continue;

    const features: OsmFeature[] = [];
    for (const el of res.data.elements) {
      const tags = el.tags ?? {};
      const cls = classify(tags);
      if (!cls) continue;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;
      features.push({
        id: `${el.type}/${el.id}`,
        name: tags.name || tags['name:fr'] || cls.tag,
        category: cls.category,
        tag: cls.tag,
        lat, lon,
      });
    }

    return { ...res, data: features, count: features.length, newestRecordAt: res.fetchedAt };
  }

  return {
    ...(last ?? { latencyMs: 0 }),
    ok: false, health: 'error', data: null, count: 0,
    fetchedAt: new Date().toISOString(),
    error: last?.error ?? 'tous les points d\'accès Overpass ont échoué',
  } as FetchResult<OsmFeature[]>;
}

export const OSM_CATEGORY_COLOR: Record<OsmCategory, string> = {
  health:    '#20c880',
  transport: '#18c8e0',
  water:     '#1e70f0',
  power:     '#d09820',
  education: '#8060d8',
  other:     '#7890a8',
};

export const OSM_CATEGORY_LABEL: Record<OsmCategory, string> = {
  health:    'Santé',
  transport: 'Transport',
  water:     'Eau',
  power:     'Énergie',
  education: 'Éducation',
  other:     'Autre',
};
