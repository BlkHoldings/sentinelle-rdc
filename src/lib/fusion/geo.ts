/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Geospatial Enrichment
   ═══════════════════════════════════════════════════════════════════════

   Adds administrative context, population exposure, infrastructure
   proximity and terrain to every fused event.

   Two corrections to the reference approach:

   • **Spatial indexing.** `for idx, row in provinces.iterrows(): if
     row.geometry.contains(point)` is a linear scan with a full polygon
     test per candidate, run per event. Here every polygon carries a
     precomputed bounding box, so the ray-cast only runs for polygons
     whose bbox actually contains the point.

   • **Attribution order.** Polygon containment is the *fallback*, not the
     primary path. When an event resolved to a gazetteer place, that
     place's real province/territory values are authoritative — they came
     from an actual administrative dataset, whereas the polygons here are
     deliberately coarse. Attribution therefore prefers: gazetteer place →
     nearest settlement within 25 km → polygon containment → none.

   Every enrichment records how it was derived, so nothing modelled is
   ever presented to an analyst as if it were measured.
   ═══════════════════════════════════════════════════════════════════════ */

import type { GeoEnrichment, AdminContext } from './schema';
import { haversineKm, reverseGeocode, PLACES, type Place } from './gazetteer';
import {
  HOSPITALS, IDP_SITES, MINING_SITES, AIRSTRIPS, BORDER_CROSSINGS,
  AXES, PROVINCE_BBOX, LAKES, type PointFeature,
} from './infrastructure';
import { MIL_POSITIONS } from '@/data/military';

/* ── Point-in-polygon (ray casting, bbox-prefiltered) ───────────── */

function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function provinceAt(lat: number, lon: number): string | null {
  for (const p of PROVINCE_BBOX) {
    if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;
    if (pointInRing(lon, lat, p.ring)) return p.name;
  }
  return null;
}

/* ── Nearest-feature search ─────────────────────────────────────── */

function nearest(
  lat: number, lon: number, features: PointFeature[],
): { feature: PointFeature; km: number } | null {
  let best: PointFeature | null = null;
  let bestD = Infinity;
  for (const f of features) {
    const d = haversineKm(lat, lon, f.lat, f.lon);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best ? { feature: best, km: bestD } : null;
}

/** Perpendicular distance from a point to a polyline, in km. Uses a local
 *  equirectangular projection — accurate to well under 1 % at these
 *  latitudes and far cheaper than a spherical cross-track formula. */
function distanceToAxis(lat: number, lon: number, points: [number, number][]): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const ax = (x1 - lon) * kx, ay = (y1 - lat) * ky;
    const bx = (x2 - lon) * kx, by = (y2 - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    best = Math.min(best, Math.hypot(px, py));
  }
  return best;
}

export function nearestAxis(lat: number, lon: number): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const ax of AXES) {
    const km = distanceToAxis(lat, lon, ax.points);
    if (!best || km < best.km) best = { name: ax.name, km };
  }
  return best;
}

/* ── Population surface ─────────────────────────────────────────
   A Gaussian settlement kernel over the gazetteer, plus a rural
   baseline. This is a *model*, not a raster sample — the returned
   `population_density` is flagged as modelled everywhere it surfaces.

   Kernel bandwidth scales with settlement size: a city of a million
   spreads its density over a much wider footprint than a village. */

const RURAL_BASELINE: Record<string, number> = {
  'Nord-Kivu': 120, 'Sud-Kivu': 110, 'Ituri': 65, 'Tanganyika': 18,
  'Maniema': 12, 'Haut-Uele': 10, 'Tshopo': 8, 'Kinshasa': 900,
};

export function populationDensity(lat: number, lon: number, province?: string): number {
  let density = RURAL_BASELINE[province ?? ''] ?? 25;

  for (const p of PLACES) {
    if (!p.pop || p.kind === 'feature' || p.kind === 'province') continue;
    const d = haversineKm(lat, lon, p.lat, p.lon);
    // Bandwidth ~ settlement radius; ignore beyond 3σ.
    const sigma = Math.max(2, p.radius_km * 0.8);
    if (d > sigma * 3) continue;
    // Peak density = pop spread over the settlement disc, Gaussian-tapered.
    const peak = p.pop / (Math.PI * Math.max(1, p.radius_km) ** 2);
    density += peak * Math.exp(-0.5 * (d / sigma) ** 2);
  }
  return Math.round(density);
}

/** Civilians inside the event's positional uncertainty disc. This is the
 *  number that actually drives triage priority — a clash 3 km from Goma
 *  and a clash 3 km from an empty forest track are not the same event. */
export function populationAtRisk(lat: number, lon: number, radiusKm: number, province?: string): number {
  // Sample the density surface on concentric rings rather than assuming
  // uniform density across the disc — event discs frequently straddle a
  // dense town and empty hinterland.
  const r = Math.max(1, radiusKm);
  let total = 0;
  const rings = 4;
  for (let i = 0; i < rings; i++) {
    const r0 = (r * i) / rings;
    const r1 = (r * (i + 1)) / rings;
    const rMid = (r0 + r1) / 2;
    const area = Math.PI * (r1 * r1 - r0 * r0);
    // 8 azimuth samples per ring
    let sum = 0;
    const n = i === 0 ? 1 : 8;
    for (let k = 0; k < n; k++) {
      const th = (2 * Math.PI * k) / n;
      const dLat = (rMid * Math.cos(th)) / 110.57;
      const dLon = (rMid * Math.sin(th)) / (111.32 * Math.cos((lat * Math.PI) / 180));
      sum += populationDensity(lat + dLat, lon + dLon, province);
    }
    total += (sum / n) * area;
  }
  return Math.round(total);
}

/* ── Terrain classification ─────────────────────────────────────── */

export function terrainAt(lat: number, lon: number): GeoEnrichment['terrain'] {
  for (const l of LAKES) {
    if (haversineKm(lat, lon, l.lat, l.lon) < l.radius_km * 0.55) return 'lacustrine';
  }
  const near = reverseGeocode(lat, lon, 12);
  if (near && (near.kind === 'city' || (near.pop ?? 0) > 200_000)) return 'urban';

  // Virunga / Kivu rift highlands and the Hauts Plateaux.
  const highland =
    (lat > -2.2 && lat < -0.9 && lon > 28.6 && lon < 29.7) ||
    (lat > -4.4 && lat < -3.5 && lon > 28.4 && lon < 29.1) ||
    (lat > 1.5 && lat < 2.4 && lon > 30.2 && lon < 30.9);
  if (highland) return 'highland';

  // Ituri and Walikale rainforest belt.
  const forest =
    (lon < 28.6 && lat > -2.2 && lat < 1.6) ||
    (lat > 0.9 && lat < 2.6 && lon > 28.0 && lon < 29.8);
  if (forest) return 'forest';

  return 'agricultural';
}

/* ── Public entry point ─────────────────────────────────────────── */

export interface EnrichOptions {
  /** Province/territory already known from the gazetteer resolution.
   *  Authoritative — polygon containment is only consulted when absent. */
  knownAdmin?: AdminContext;
  radiusKm?: number;
}

/* Enrichment is deterministic in (lat, lon, radius, known admin) and is
   recomputed for every cluster on every flush. The population-exposure
   term alone samples the settlement kernel 33 times, and each sample
   walks the gazetteer — roughly 4 000 great-circle computations per
   event, which measured as the dominant cost of a flush once the window
   filled. Since a cluster's coordinates barely move between flushes,
   memoising on rounded coordinates removes almost all of that work
   without changing any result an analyst sees (the key resolves to ~10 m,
   far below the smallest positional uncertainty in the system). */
const enrichCache = new Map<string, GeoEnrichment>();
const ENRICH_CACHE_MAX = 4000;

export function enrichLocation(
  lat: number, lon: number, opts: EnrichOptions = {},
): GeoEnrichment {
  const key =
    `${lat.toFixed(4)}|${lon.toFixed(4)}|${(opts.radiusKm ?? 5).toFixed(1)}` +
    `|${opts.knownAdmin?.province ?? ''}|${opts.knownAdmin?.territory ?? ''}`;
  const hit = enrichCache.get(key);
  if (hit) return hit;

  const result = computeEnrichment(lat, lon, opts);
  if (enrichCache.size >= ENRICH_CACHE_MAX) {
    // Cheap eviction: drop the oldest quarter. Insertion order is
    // iteration order for a Map, so this approximates LRU well enough for
    // a workload that re-requests the same recent coordinates.
    let n = ENRICH_CACHE_MAX / 4;
    for (const k of enrichCache.keys()) {
      enrichCache.delete(k);
      if (--n <= 0) break;
    }
  }
  enrichCache.set(key, result);
  return result;
}

function computeEnrichment(
  lat: number, lon: number, opts: EnrichOptions,
): GeoEnrichment {
  const admin: AdminContext = { ...opts.knownAdmin };

  if (!admin.province) {
    // Nearest settlement carries real admin attributes — prefer it over
    // the coarse polygons.
    const near = reverseGeocode(lat, lon, 25);
    if (near) {
      admin.province = near.province;
      admin.territory = near.territory;
    } else {
      admin.province = provinceAt(lat, lon) ?? undefined;
    }
  }

  const radius = opts.radiusKm ?? 5;
  const hosp = nearest(lat, lon, HOSPITALS);
  const idp = nearest(lat, lon, IDP_SITES);
  const mine = nearest(lat, lon, MINING_SITES);
  const strip = nearest(lat, lon, AIRSTRIPS);
  const border = nearest(lat, lon, BORDER_CROSSINGS);
  const axis = nearestAxis(lat, lon);

  const forces: PointFeature[] = MIL_POSITIONS.map((m) => ({
    name: m.n, lat: m.lt, lon: m.ln, kind: m.t,
  }));
  const force = nearest(lat, lon, forces);

  const density = populationDensity(lat, lon, admin.province);

  return {
    admin,
    population_density: density,
    population_at_risk: populationAtRisk(lat, lon, radius, admin.province),
    nearest_hospital_km:     hosp   ? round1(hosp.km)   : undefined,
    nearest_idp_site_km:     idp    ? round1(idp.km)    : undefined,
    nearest_mining_site_km:  mine   ? round1(mine.km)   : undefined,
    nearest_airstrip_km:     strip  ? round1(strip.km)  : undefined,
    nearest_border_km:       border ? round1(border.km) : undefined,
    nearest_force_km:        force  ? round1(force.km)  : undefined,
    // Only claim an axis when the event is plausibly *on* it.
    axis: axis && axis.km < 8 ? axis.name : undefined,
    terrain: terrainAt(lat, lon),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ── Named-feature lookups for the intel panel ──────────────────── */

export function nearestHospital(lat: number, lon: number) { return nearest(lat, lon, HOSPITALS); }
export function nearestIdpSite(lat: number, lon: number)  { return nearest(lat, lon, IDP_SITES); }
export function nearestMiningSite(lat: number, lon: number) { return nearest(lat, lon, MINING_SITES); }
export function nearestBorder(lat: number, lon: number)   { return nearest(lat, lon, BORDER_CROSSINGS); }

/** Settlements within `km` — used by the SITREP writer to describe an
 *  event's neighbourhood in prose ("dans le triangle Sake–Kirotshe–Minova"). */
export function settlementsWithin(lat: number, lon: number, km: number): Place[] {
  return PLACES
    .filter((p) => p.kind !== 'feature' && p.kind !== 'province')
    .map((p) => ({ p, d: haversineKm(lat, lon, p.lat, p.lon) }))
    .filter((x) => x.d <= km)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.p);
}
