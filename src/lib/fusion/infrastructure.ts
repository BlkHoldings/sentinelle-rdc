/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Infrastructure & Boundary Reference Layer
   ═══════════════════════════════════════════════════════════════════════

   The reference design loaded GADM boundaries, a WorldPop raster and OSM
   extracts server-side. This build is a static export served from a CDN —
   there is no PostGIS behind it, and shipping a 40 MB raster to an analyst
   on a Goma 3G link is not an option.

   So: the reference layer is embedded, and small. Boundaries are
   *simplified* province outlines (marked as such — they are for
   containment tests, never for cartographic display); admin attribution
   prefers the gazetteer's real province/territory values and only falls
   back to polygons for coordinates far from any known settlement.
   Population density is modelled as a settlement kernel over the
   gazetteer rather than sampled from a raster.

   Every derived field carries its provenance so an analyst is never
   shown a modelled number as if it were a measured one.
   ═══════════════════════════════════════════════════════════════════════ */

export interface PointFeature {
  name: string;
  lat: number;
  lon: number;
  kind: string;
}

/* ── Health facilities ──────────────────────────────────────────── */

export const HOSPITALS: PointFeature[] = [
  { name: 'HP Nord-Kivu (Goma)',       lat: -1.677, lon: 29.230, kind: 'provincial' },
  { name: 'HEAL Africa (Goma)',        lat: -1.680, lon: 29.225, kind: 'referral' },
  { name: 'CBCA Ndosho (Goma)',        lat: -1.667, lon: 29.203, kind: 'trauma' },
  { name: 'HGR Kirotshe',              lat: -1.750, lon: 29.030, kind: 'general' },
  { name: 'HGR Rutshuru (MSF)',        lat: -1.185, lon: 29.448, kind: 'general' },
  { name: 'Hôpital de Mweso (MSF)',    lat: -0.970, lon: 28.920, kind: 'general' },
  { name: 'HGR Masisi',                lat: -1.400, lon: 28.810, kind: 'general' },
  { name: 'HGR Kitshanga',             lat: -1.020, lon: 29.020, kind: 'general' },
  { name: 'HGR Walikale',              lat: -1.420, lon: 28.050, kind: 'general' },
  { name: 'HGR Beni',                  lat:  0.492, lon: 29.475, kind: 'general' },
  { name: 'HGR Oicha',                 lat:  0.700, lon: 29.520, kind: 'general' },
  { name: 'Hôpital Matanda (Butembo)', lat:  0.135, lon: 29.290, kind: 'referral' },
  { name: 'HGR Kanyabayonga',          lat: -0.360, lon: 29.280, kind: 'general' },
  { name: 'HGR Bunia',                 lat:  1.565, lon: 30.245, kind: 'provincial' },
  { name: 'HGR Drodro',                lat:  1.830, lon: 30.530, kind: 'general' },
  { name: 'HGR Komanda',               lat:  1.370, lon: 29.770, kind: 'general' },
  { name: 'HGR Mahagi',                lat:  2.240, lon: 30.990, kind: 'general' },
  { name: 'HP Sud-Kivu (Bukavu)',      lat: -2.508, lon: 28.845, kind: 'provincial' },
  { name: 'Hôpital de Panzi',          lat: -2.545, lon: 28.855, kind: 'referral' },
  { name: 'HGR Uvira',                 lat: -3.400, lon: 29.140, kind: 'general' },
  { name: 'HGR Baraka',                lat: -4.100, lon: 29.090, kind: 'general' },
  { name: 'HGR Fizi',                  lat: -4.300, lon: 28.940, kind: 'general' },
  { name: 'HGR Minova',                lat: -1.980, lon: 29.030, kind: 'general' },
  { name: 'HGR Kamituga',              lat: -3.060, lon: 28.180, kind: 'general' },
  { name: 'HGR Shabunda',              lat: -2.700, lon: 27.350, kind: 'general' },
  { name: 'HGR Kalemie',               lat: -5.950, lon: 29.190, kind: 'provincial' },
  { name: 'HGR Kindu',                 lat: -2.940, lon: 25.920, kind: 'provincial' },
];

/* ── IDP sites (displacement camps and spontaneous settlements) ──── */

export const IDP_SITES: PointFeature[] = [
  { name: 'Kanyaruchinya',      lat: -1.590, lon: 29.240, kind: 'spontaneous' },
  { name: 'Bulengo',            lat: -1.665, lon: 29.150, kind: 'managed' },
  { name: 'Lushagala',          lat: -1.655, lon: 29.135, kind: 'managed' },
  { name: 'Rusayo',             lat: -1.615, lon: 29.180, kind: 'managed' },
  { name: 'Kibati',             lat: -1.598, lon: 29.245, kind: 'spontaneous' },
  { name: 'Don Bosco Ndosho',   lat: -1.667, lon: 29.200, kind: 'collective' },
  { name: 'Mubambiro (Sake)',   lat: -1.573, lon: 28.990, kind: 'spontaneous' },
  { name: 'Minova sites',       lat: -1.980, lon: 29.030, kind: 'spontaneous' },
  { name: 'Kitshanga sites',    lat: -1.020, lon: 29.020, kind: 'spontaneous' },
  { name: 'Rho (Djugu)',        lat:  1.950, lon: 30.420, kind: 'managed' },
  { name: 'Bule (Djugu)',       lat:  2.100, lon: 30.600, kind: 'managed' },
  { name: 'Savo / Drodro',      lat:  1.830, lon: 30.530, kind: 'spontaneous' },
  { name: 'Tché (Djugu)',       lat:  1.880, lon: 30.450, kind: 'spontaneous' },
  { name: 'Kigonze (Bunia)',    lat:  1.545, lon: 30.235, kind: 'managed' },
  { name: 'ISP Bunia',          lat:  1.560, lon: 30.250, kind: 'collective' },
  { name: 'Lusenda (Fizi)',     lat: -4.180, lon: 29.020, kind: 'managed' },
];

/* ── Artisanal & industrial mining sites ────────────────────────── */

export const MINING_SITES: PointFeature[] = [
  { name: 'Rubaya (coltan)',        lat: -1.505, lon: 28.887, kind: 'coltan' },
  { name: 'Numbi (coltan/or)',      lat: -2.020, lon: 28.850, kind: 'coltan' },
  { name: 'Nyabibwe (cassitérite)', lat: -2.020, lon: 28.940, kind: 'tin' },
  { name: 'Bisie (étain)',          lat: -1.110, lon: 27.900, kind: 'tin' },
  { name: 'Lueshe (niobium)',       lat: -0.950, lon: 29.050, kind: 'niobium' },
  { name: 'Kamituga (or)',          lat: -3.060, lon: 28.180, kind: 'gold' },
  { name: 'Misisi (or)',            lat: -4.440, lon: 28.780, kind: 'gold' },
  { name: 'Shabunda (or)',          lat: -2.700, lon: 27.350, kind: 'gold' },
  { name: 'Salamabila (or)',        lat: -4.060, lon: 27.100, kind: 'gold' },
  { name: 'Mongbwalu (or)',         lat:  1.930, lon: 30.040, kind: 'gold' },
  { name: 'Kilo-Moto (or)',         lat:  1.830, lon: 30.150, kind: 'gold' },
  { name: 'Manono (lithium)',       lat: -7.300, lon: 27.420, kind: 'lithium' },
];

/* ── Airstrips & airports ───────────────────────────────────────── */

export const AIRSTRIPS: PointFeature[] = [
  { name: 'Goma Int. (FZNA)',    lat: -1.670, lon: 29.238, kind: 'international' },
  { name: 'Kavumu (FZMA)',       lat: -2.308, lon: 28.809, kind: 'regional' },
  { name: 'Beni-Mavivi (FZNP)',  lat:  0.575, lon: 29.474, kind: 'regional' },
  { name: 'Bunia (FZKA)',        lat:  1.565, lon: 30.220, kind: 'regional' },
  { name: 'Rughenda (Butembo)',  lat:  0.121, lon: 29.310, kind: 'regional' },
  { name: 'Kalemie (FZRF)',      lat: -5.876, lon: 29.250, kind: 'regional' },
  { name: 'Kindu (FZOA)',        lat: -2.919, lon: 25.915, kind: 'regional' },
  { name: 'Walikale',            lat: -1.417, lon: 28.055, kind: 'airstrip' },
  { name: 'Shabunda',            lat: -2.700, lon: 27.350, kind: 'airstrip' },
  { name: 'Kavimvira (Uvira)',   lat: -3.350, lon: 29.160, kind: 'airstrip' },
];

/* ── Official border crossings ──────────────────────────────────── */

export const BORDER_CROSSINGS: PointFeature[] = [
  { name: 'Grande Barrière (Goma–Gisenyi)', lat: -1.6785, lon: 29.2585, kind: 'RWA' },
  { name: 'Petite Barrière (Goma–Gisenyi)', lat: -1.6870, lon: 29.2350, kind: 'RWA' },
  { name: 'Bunagana',                       lat: -1.3400, lon: 29.6300, kind: 'UGA' },
  { name: 'Ishasha',                        lat: -0.6200, lon: 29.6700, kind: 'UGA' },
  { name: 'Kasindi–Lubiriha',               lat:  0.0500, lon: 29.7000, kind: 'UGA' },
  { name: 'Ruzizi I (Bukavu–Cyangugu)',     lat: -2.5020, lon: 28.8580, kind: 'RWA' },
  { name: 'Ruzizi II',                      lat: -2.5200, lon: 28.8700, kind: 'RWA' },
  { name: 'Kamanyola',                      lat: -2.7500, lon: 29.0000, kind: 'RWA' },
  { name: 'Kavimvira (Uvira–Bujumbura)',    lat: -3.3500, lon: 29.1600, kind: 'BDI' },
  { name: 'Mahagi–Goli',                    lat:  2.2400, lon: 30.9900, kind: 'UGA' },
  { name: 'Ariwara–Aru',                    lat:  2.9800, lon: 30.7200, kind: 'UGA' },
];

/* ── Main supply routes, as polylines ───────────────────────────── */

export interface Axis { name: string; points: [number, number][] } // [lon, lat]

export const AXES: Axis[] = [
  {
    name: 'RN2 Goma–Rutshuru–Kanyabayonga–Butembo',
    points: [
      [29.228, -1.678], [29.250, -1.520], [29.283, -1.450], [29.350, -1.360],
      [29.320, -1.398], [29.447, -1.186], [29.440, -1.150], [29.200, -0.720],
      [29.280, -0.360], [29.250, -0.300], [29.291, 0.131],
    ],
  },
  {
    name: 'RN2 Butembo–Beni',
    points: [[29.291, 0.131], [29.400, 0.300], [29.472, 0.492]],
  },
  {
    name: 'RN4 Beni–Kasindi',
    points: [[29.472, 0.492], [29.520, 0.640], [29.700, 0.050]],
  },
  {
    name: 'RN3 Goma–Sake–Masisi–Walikale',
    points: [[29.228, -1.678], [28.990, -1.573], [28.810, -1.400], [28.050, -1.420]],
  },
  {
    name: 'RN5 Bukavu–Uvira–Baraka',
    points: [[28.842, -2.508], [28.900, -2.750], [29.000, -3.100], [29.140, -3.400], [29.090, -4.100]],
  },
  {
    name: 'RN2 Bukavu–Kavumu–Minova–Goma (littoral Kivu)',
    points: [[28.842, -2.508], [28.809, -2.308], [28.890, -2.090], [29.030, -1.980], [28.990, -1.573]],
  },
  {
    name: 'RN27 Bunia–Komanda–Mambasa',
    points: [[30.245, 1.565], [29.770, 1.370], [29.050, 1.360]],
  },
  {
    name: 'RN27 Bunia–Djugu–Mahagi',
    points: [[30.245, 1.565], [30.500, 1.920], [30.990, 2.240]],
  },
];

/* ── Simplified province polygons ───────────────────────────────
   COARSE containment outlines only — NOT survey boundaries and never
   drawn on the map. Used solely to attribute a province to coordinates
   that fall far from any gazetteer settlement (open water, deep forest,
   sensor hits in unpopulated terrain). Vertices are [lon, lat]. */

export const PROVINCE_POLYGONS: { name: string; ring: [number, number][] }[] = [
  {
    name: 'Nord-Kivu',
    ring: [
      [27.20, 0.95], [28.20, 1.30], [29.30, 0.98], [29.72, 0.72], [29.95, 0.30],
      [29.78, -0.30], [29.62, -0.65], [29.72, -1.05], [29.60, -1.38],
      [29.25, -1.72], [28.98, -1.70], [28.75, -1.55], [28.30, -1.60],
      [27.60, -1.55], [27.15, -1.10], [27.00, -0.20], [27.20, 0.95],
    ],
  },
  {
    name: 'Sud-Kivu',
    ring: [
      [26.60, -1.60], [28.30, -1.60], [28.75, -1.55], [28.98, -1.70],
      [29.10, -2.10], [28.90, -2.55], [29.00, -2.90], [29.25, -3.35],
      [29.35, -3.75], [29.20, -4.10], [29.10, -4.50], [28.70, -4.80],
      [28.10, -4.70], [27.30, -4.40], [26.80, -3.60], [26.55, -2.60],
      [26.60, -1.60],
    ],
  },
  {
    name: 'Ituri',
    ring: [
      [28.00, 1.10], [28.40, 2.30], [29.20, 3.10], [30.40, 3.15],
      [31.05, 2.40], [30.85, 1.60], [30.55, 1.15], [30.20, 0.85],
      [29.60, 0.90], [29.10, 0.95], [28.50, 0.95], [28.00, 1.10],
    ],
  },
  {
    name: 'Tanganyika',
    ring: [
      [26.50, -4.60], [28.10, -4.70], [28.70, -4.80], [29.10, -4.50],
      [29.55, -5.50], [29.80, -6.50], [30.00, -7.10], [29.50, -8.20],
      [28.50, -8.60], [27.20, -8.30], [26.60, -7.30], [26.30, -5.80],
      [26.50, -4.60],
    ],
  },
  {
    name: 'Maniema',
    ring: [
      [25.10, -0.60], [26.55, -1.20], [26.55, -2.60], [26.80, -3.60],
      [27.30, -4.40], [26.50, -4.60], [26.30, -5.10], [25.60, -4.90],
      [25.10, -4.20], [24.90, -2.80], [25.10, -0.60],
    ],
  },
  {
    name: 'Haut-Uele',
    ring: [
      [26.60, 2.30], [28.40, 2.30], [29.20, 3.10], [30.40, 3.15],
      [30.75, 3.80], [29.80, 4.60], [28.20, 4.40], [27.00, 3.90],
      [26.50, 3.10], [26.60, 2.30],
    ],
  },
];

/** Precomputed bounding boxes — the spatial index the reference design's
 *  `for idx, row in provinces.iterrows()` loop was missing. Rejects
 *  ~90 % of candidates before any ray casting runs. */
export const PROVINCE_BBOX = PROVINCE_POLYGONS.map((p) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of p.ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { name: p.name, ring: p.ring, minX, minY, maxX, maxY };
});

/* ── Lakes, for terrain classification ──────────────────────────── */

export const LAKES = [
  { name: 'Lac Kivu',       lat: -2.00, lon: 29.00, radius_km: 42 },
  { name: 'Lac Édouard',    lat: -0.40, lon: 29.60, radius_km: 28 },
  { name: 'Lac Albert',     lat:  1.70, lon: 30.90, radius_km: 38 },
  { name: 'Lac Tanganyika', lat: -6.00, lon: 29.50, radius_km: 75 },
];
