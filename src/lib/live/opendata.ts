/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Open institutional data
   ═══════════════════════════════════════════════════════════════════════

   Keyless, CORS-enabled public APIs from the institutions that publish
   the reference figures: WHO, UNHCR, IDMC, OCHA, NASA, Copernicus/GloFAS.

   Each parser was written against a recorded response from the live
   endpoint (tests/fixtures) and is tested against it, so a change in an
   upstream's shape fails a test instead of silently emptying a panel.

   Every record keeps the reference period its publisher gave it. Most
   of these series are annual or slower; showing a 2025 year-end figure
   without its year would be passing off an archive as a live reading.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';

const meta = (m: LiveSourceMeta) => m;
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && v !== '-' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/* ── WHO Disease Outbreak News ───────────────────────────────────── */

export interface OutbreakNotice { id: string; title: string; published: string; url: string; summary: string }

export const WHO_META = meta({
  id: 'who', label: 'OMS — flambées épidémiques',
  purpose: 'Bulletins officiels « Disease Outbreak News » concernant la RDC.',
  provider: 'Organisation mondiale de la Santé',
  docs: 'https://www.who.int/emergencies/disease-outbreak-news',
  cadence: 'à la publication', requiresKey: false,
});

interface RawWho { value?: { Title?: string; OverrideTitle?: string; PublicationDate?: string; DonId?: string; ItemDefaultUrl?: string; Summary?: string }[] }

export function parseWho(raw: RawWho): OutbreakNotice[] {
  return (raw.value ?? []).filter((v) => v.DonId && v.PublicationDate).map((v) => ({
    id: v.DonId!,
    title: (v.OverrideTitle || v.Title || '').trim(),
    published: v.PublicationDate!,
    url: `https://www.who.int/emergencies/disease-outbreak-news/item/${v.DonId}`,
    summary: (v.Summary ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}

export async function fetchWho(): Promise<FetchResult<OutbreakNotice[]>> {
  const url = 'https://www.who.int/api/news/diseaseoutbreaknews'
    + "?$filter=contains(Title,'Congo')&$orderby=PublicationDate%20desc&$top=12"
    + '&$select=Title,OverrideTitle,PublicationDate,DonId,ItemDefaultUrl,Summary';
  const res = await fetchJSON<RawWho>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };
  const items = parseWho(res.data);
  return { ...res, data: items, count: items.length, newestRecordAt: items[0]?.published };
}

/* ── Displacement: UNHCR and IDMC ────────────────────────────────── */

export interface DisplacementYear {
  year: number;
  /** Congolese refugees abroad (UNHCR, country of origin). */
  refugeesAbroad: number | null;
  asylumSeekersAbroad: number | null;
  /** Internally displaced, UNHCR figure for the year. */
  idpsUnhcr: number | null;
  returnedIdps: number | null;
  /** Internally displaced by conflict, IDMC year-end stock. */
  idpsIdmc: number | null;
  /** Refugees from elsewhere hosted in the DRC. */
  refugeesHosted: number | null;
}

export const DISPLACEMENT_META = meta({
  id: 'displacement', label: 'UNHCR / IDMC — déplacements',
  purpose: 'Séries annuelles officielles : réfugiés congolais, déplacés internes, réfugiés accueillis.',
  provider: 'HCR — Refugee Data Finder ; IDMC',
  docs: 'https://api.unhcr.org/docs/refugee-statistics.html',
  cadence: 'annuelle (mi-année et fin d’année)', requiresKey: false,
});

interface RawPop { items?: Record<string, unknown>[] }

export function mergeDisplacement(origin: RawPop, asylum: RawPop, idmc: RawPop): DisplacementYear[] {
  const by = new Map<number, DisplacementYear>();
  const row = (y: number) => {
    let r = by.get(y);
    if (!r) {
      r = { year: y, refugeesAbroad: null, asylumSeekersAbroad: null, idpsUnhcr: null, returnedIdps: null, idpsIdmc: null, refugeesHosted: null };
      by.set(y, r);
    }
    return r;
  };
  for (const i of origin.items ?? []) {
    const y = num(i.year); if (y == null) continue;
    const r = row(y);
    r.refugeesAbroad = num(i.refugees); r.asylumSeekersAbroad = num(i.asylum_seekers);
    r.idpsUnhcr = num(i.idps); r.returnedIdps = num(i.returned_idps);
  }
  for (const i of asylum.items ?? []) {
    const y = num(i.year); if (y != null) row(y).refugeesHosted = num(i.refugees);
  }
  for (const i of idmc.items ?? []) {
    const y = num(i.year); if (y != null) row(y).idpsIdmc = num(i.total);
  }
  return [...by.values()].sort((a, b) => a.year - b.year);
}

export async function fetchDisplacement(): Promise<FetchResult<DisplacementYear[]>> {
  const yearTo = new Date().getUTCFullYear();
  const q = `limit=40&yearFrom=${yearTo - 9}&yearTo=${yearTo}&cf_type=ISO`;
  const base = 'https://api.unhcr.org/population/v1';
  const [origin, asylum, idmc] = await Promise.all([
    fetchJSON<RawPop>(`${base}/population/?${q}&coo=COD`, { timeoutMs: 20_000 }),
    fetchJSON<RawPop>(`${base}/population/?${q}&coa=COD`, { timeoutMs: 20_000 }),
    fetchJSON<RawPop>(`${base}/idmc/?${q}&coo=COD`, { timeoutMs: 20_000 }),
  ]);
  // The origin series is the backbone; without it there is nothing to show.
  if (!origin.ok || !origin.data) return { ...origin, data: null, count: 0 };
  const rows = mergeDisplacement(origin.data, asylum.data ?? {}, idmc.data ?? {});
  const partial = !asylum.ok || !idmc.ok;
  return {
    ...origin, data: rows, count: rows.length,
    health: partial ? 'degraded' : 'ok',
    error: partial ? 'Série partielle : une des trois requêtes a échoué.' : undefined,
    newestRecordAt: rows.length ? `${rows[rows.length - 1].year}-12-31T00:00:00Z` : undefined,
  };
}

/* ── NASA EONET natural events ───────────────────────────────────── */

export interface NaturalEvent { id: string; title: string; category: string; date: string; lon: number; lat: number; url: string; closed: boolean }

export const EONET_META = meta({
  id: 'eonet', label: 'NASA EONET — événements naturels',
  purpose: 'Feux, volcans, inondations et tempêtes recensés sur le territoire, avec leur source d’origine.',
  provider: 'NASA Earth Observatory',
  docs: 'https://eonet.gsfc.nasa.gov/docs/v3',
  cadence: 'quotidienne', requiresKey: false,
});

/** DRC bounding box, [west, north, east, south] as EONET expects. */
const DRC_BBOX = '12,6,32,-14';

interface RawEonet { events?: { id?: string; title?: string; closed?: string | null; categories?: { title?: string }[]; sources?: { url?: string }[]; geometry?: { date?: string; type?: string; coordinates?: unknown }[] }[] }

export function parseEonet(raw: RawEonet): NaturalEvent[] {
  const out: NaturalEvent[] = [];
  for (const e of raw.events ?? []) {
    // Latest point geometry: an event that moves (a storm) is where it is now.
    const g = [...(e.geometry ?? [])].reverse().find((x) => x.type === 'Point' && Array.isArray(x.coordinates));
    const c = g?.coordinates as number[] | undefined;
    if (!e.id || !g || !c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    out.push({
      id: e.id, title: e.title ?? e.id, category: e.categories?.[0]?.title ?? '—',
      date: g.date ?? '', lon: c[0], lat: c[1],
      url: e.sources?.[0]?.url ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${e.id}`,
      closed: !!e.closed,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

type Ring = number[][];

/** Ray-casting point-in-polygon over a set of outer rings. */
export function insideRings(lon: number, lat: number, rings: Ring[]): boolean {
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

/**
 * EONET is queried by bounding box, and the DRC's box takes in half of
 * Angola and Zambia. `border` — the outer rings of the national
 * boundary — trims the result to the country. Without it the box result
 * is returned and flagged as degraded, so the wider area is not passed
 * off as the national picture.
 */
export async function fetchEonet(border?: Ring[]): Promise<FetchResult<NaturalEvent[]>> {
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?bbox=${DRC_BBOX}&status=all&days=60&limit=200`;
  const res = await fetchJSON<RawEonet>(url, { timeoutMs: 25_000 });
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };
  const all = parseEonet(res.data);
  const items = border?.length ? all.filter((e) => insideRings(e.lon, e.lat, border)) : all;
  return {
    ...res, data: items, count: items.length, newestRecordAt: items[0]?.date || undefined,
    health: border?.length ? 'ok' : 'degraded',
    error: border?.length ? undefined : 'Limite nationale indisponible : résultats non restreints au territoire.',
  };
}

/* ── River discharge (GloFAS via Open-Meteo) ─────────────────────── */

export interface RiverSite { name: string; river: string; lat: number; lon: number }

export interface RiverReading extends RiverSite {
  /** m³/s today, from the model. */
  today: number | null;
  /** Mean of the preceding seven days. */
  weekMean: number | null;
  /** Peak in the forecast window, and its date. */
  forecastPeak: number | null;
  forecastPeakDate: string;
  /** Today against the trailing week, as a ratio; null without a baseline. */
  ratio: number | null;
  series: { date: string; value: number | null }[];
}

/* Coordinates are those of the model's river-channel cell nearest each
   town, found by sampling the grid — not the town centre. GloFAS is a
   5 km raster: a point 3 km off the channel lands in a hillside cell and
   reads ~0 m³/s, which is what the town-centre coordinates returned.
   Sites whose channel cell could not be identified with confidence
   (Kalemie, Ilebo) are left out rather than shown with a doubtful value. */
export const RIVER_SITES: RiverSite[] = [
  { name: 'Kinshasa',  river: 'Congo',   lat: -4.325, lon: 15.175 },
  { name: 'Mbandaka',  river: 'Congo',   lat:  0.025, lon: 18.175 },
  { name: 'Kisangani', river: 'Congo',   lat:  0.475, lon: 25.175 },
  { name: 'Kindu',     river: 'Lualaba', lat: -3.025, lon: 25.875 },
  { name: 'Bukavu',    river: 'Ruzizi',  lat: -2.575, lon: 28.825 },
  { name: 'Uvira',     river: 'Ruzizi',  lat: -3.475, lon: 29.175 },
];

export const HYDRO_META = meta({
  id: 'hydro', label: 'GloFAS — débit des cours d’eau',
  purpose: 'Débit modélisé et prévision à 7 jours sur six points du bassin. Un modèle, pas une jauge.',
  provider: 'Copernicus GloFAS, via Open-Meteo',
  docs: 'https://open-meteo.com/en/docs/flood-api',
  cadence: 'quotidienne', requiresKey: false,
});

interface RawFlood { daily?: { time?: string[]; river_discharge?: (number | null)[] } }

const PAST_DAYS = 7;

export function parseFlood(raw: RawFlood | RawFlood[], sites: RiverSite[] = RIVER_SITES): RiverReading[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return sites.slice(0, list.length).map((site, i) => {
    const time = list[i].daily?.time ?? [];
    const vals = list[i].daily?.river_discharge ?? [];
    const series = time.map((date, k) => ({ date, value: vals[k] ?? null }));
    const past = series.slice(0, PAST_DAYS).map((s) => s.value).filter((v): v is number => v != null);
    const today = series[PAST_DAYS]?.value ?? null;
    const ahead = series.slice(PAST_DAYS + 1).filter((s) => s.value != null) as { date: string; value: number }[];
    const peak = ahead.reduce<{ date: string; value: number } | null>((m, s) => (!m || s.value > m.value ? s : m), null);
    const weekMean = past.length ? past.reduce((a, b) => a + b, 0) / past.length : null;
    return {
      ...site, today, weekMean,
      forecastPeak: peak?.value ?? null, forecastPeakDate: peak?.date ?? '',
      ratio: today != null && weekMean ? today / weekMean : null,
      series,
    };
  });
}

export async function fetchHydro(): Promise<FetchResult<RiverReading[]>> {
  const url = 'https://flood-api.open-meteo.com/v1/flood'
    + `?latitude=${RIVER_SITES.map((s) => s.lat).join(',')}&longitude=${RIVER_SITES.map((s) => s.lon).join(',')}`
    + `&daily=river_discharge&past_days=${PAST_DAYS}&forecast_days=8`;
  const res = await fetchJSON<RawFlood | RawFlood[]>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };
  const rows = parseFlood(res.data);
  return { ...res, data: rows, count: rows.length, newestRecordAt: new Date().toISOString() };
}

/* ── Humanitarian funding (OCHA FTS) ─────────────────────────────────
   NOT WIRED INTO THE INTERFACE. The parser is correct and tested, and
   the API answers — but its responses carry two Access-Control-Allow-
   Origin headers, which every browser rejects. Until OCHA fixes that or
   a server relay exists, a static site cannot read this source. It is
   listed under "not connected" with that reason; this code is the
   integration point for the day a relay is available. */

export interface Funding {
  year: number;
  planName: string;
  /** USD requested by the response plan; null when no plan is listed. */
  required: number | null;
  /** USD reported as funded for the country this year, all flows. */
  funded: number;
  /** funded / required, capped at nothing — it can exceed 1. */
  coverage: number | null;
  donors: { name: string; amount: number }[];
}

export const FTS_META = meta({
  id: 'fts', label: 'OCHA FTS — financement humanitaire',
  purpose: 'Montants requis par le plan de réponse et financements déclarés pour l’année en cours.',
  provider: 'OCHA Financial Tracking Service',
  docs: 'https://api.hpc.tools/docs/v1/',
  cadence: 'quotidienne', requiresKey: false,
});

interface RawFlow { data?: { report1?: { fundingTotals?: { total?: number; objects?: { singleFundingObjects?: { name?: string; totalFunding?: number }[] }[] } } } }
interface RawPlans { data?: { planVersion?: { name?: string }; years?: { year?: string }[]; origRequirements?: number | string; revisedRequirements?: number | string }[] }

export function parseFunding(flow: RawFlow, plans: RawPlans, year: number): Funding {
  const totals = flow.data?.report1?.fundingTotals;
  const funded = num(totals?.total) ?? 0;
  const donors = (totals?.objects?.[0]?.singleFundingObjects ?? [])
    .map((d) => ({ name: d.name ?? '—', amount: num(d.totalFunding) ?? 0 }))
    .sort((a, b) => b.amount - a.amount).slice(0, 8);
  const plan = (plans.data ?? []).find((p) => (p.years ?? []).some((y) => Number(y.year) === year));
  const required = plan ? (num(plan.revisedRequirements) ?? num(plan.origRequirements)) : null;
  return {
    year, planName: plan?.planVersion?.name ?? '', required, funded,
    coverage: required ? funded / required : null, donors,
  };
}

export async function fetchFunding(): Promise<FetchResult<Funding>> {
  const year = new Date().getUTCFullYear();
  const [flow, plans] = await Promise.all([
    fetchJSON<RawFlow>(`https://api.hpc.tools/v1/public/fts/flow?countryISO3=COD&year=${year}&groupby=organization`, { timeoutMs: 30_000 }),
    fetchJSON<RawPlans>('https://api.hpc.tools/v1/public/plan/country/COD', { timeoutMs: 30_000 }),
  ]);
  if (!flow.ok || !flow.data) return { ...flow, data: null, count: 0 };
  const f = parseFunding(flow.data, plans.data ?? {}, year);
  return {
    ...flow, data: f, count: f.donors.length,
    health: plans.ok ? 'ok' : 'degraded',
    error: plans.ok ? undefined : 'Plan de réponse indisponible : montant requis inconnu.',
    newestRecordAt: new Date().toISOString(),
  };
}

/* ── NASA GIBS satellite layers ──────────────────────────────────── */

export interface SatLayer {
  key: 'sat_true' | 'sat_rain' | 'sat_night';
  gibsId: string;
  matrix: string;
  ext: 'jpg' | 'png';
  maxzoom: number;
  /** Which day's image to request. */
  date: (now?: Date) => string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/* Yesterday, UTC: today's composite is still being assembled as the
   satellite passes, and requesting it returns a half-empty mosaic. */
export const gibsYesterday = (now = new Date()) => iso(new Date(now.getTime() - 86_400_000));

export const SAT_LAYERS: SatLayer[] = [
  { key: 'sat_true',  gibsId: 'MODIS_Terra_CorrectedReflectance_TrueColor', matrix: 'GoogleMapsCompatible_Level9', ext: 'jpg', maxzoom: 9, date: gibsYesterday },
  { key: 'sat_rain',  gibsId: 'IMERG_Precipitation_Rate',                   matrix: 'GoogleMapsCompatible_Level6', ext: 'png', maxzoom: 6, date: gibsYesterday },
  { key: 'sat_night', gibsId: 'VIIRS_Black_Marble',                         matrix: 'GoogleMapsCompatible_Level8', ext: 'png', maxzoom: 8, date: () => '2016-01-01' },
];

export function gibsTileUrl(l: SatLayer, now = new Date()): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.gibsId}/default/${l.date(now)}/${l.matrix}/{z}/{y}/{x}.${l.ext}`;
}
