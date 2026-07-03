/**
 * External API clients: NASA FIRMS, Copernicus DataSpace, ACLED.
 * All functions are pure async — no side effects, no globals.
 */

import type { IntelEvent } from '@/types/intel';
import { parseCSV, daysAgoISO, todayISO } from '@/lib/utils';

const COP_BBOX = [27, -5, 31, 3] as const; // eastern DRC

/* ── NASA FIRMS ─────────────────────────────────────────────
   VIIRS SNPP Near-Real-Time active fire data for DRC.
   Requires a MAP_KEY from https://firms.modaps.eosdis.nasa.gov/api/area/ */

function firmsUrls(key: string): string[] {
  const base = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${key}/VIIRS_SNPP_NRT/COD/2`;
  return [
    base,
    `https://corsproxy.io/?url=${encodeURIComponent(base)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`,
  ];
}

export async function fetchFIRMS(key: string): Promise<IntelEvent[]> {
  if (!key) return [];
  for (const url of firmsUrls(key)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const csv = await res.text();
      if (!csv.includes('latitude')) continue;
      const rows = parseCSV(csv);
      if (!rows.length) continue;
      return rows.map(f => ({
        src:        'firms' as const,
        type:       'Thermal Anomaly',
        date:       f['acq_date'] ?? '',
        time:       f['acq_time'] ?? '',
        lat:        parseFloat(f['latitude'] ?? '0'),
        lon:        parseFloat(f['longitude'] ?? '0'),
        brightness: parseFloat(f['bright_ti4'] ?? '0'),
        confidence: f['confidence'] ?? '',
        frp:        parseFloat(f['frp'] ?? '0'),
        daynight:   f['daynight'] ?? '',
      }));
    } catch { /* try next proxy */ }
  }
  return [];
}

/* ── Copernicus DataSpace ────────────────────────────────────
   Sentinel-1 (SAR) + Sentinel-2 (MSI) scene catalog — free, no key. */

export async function fetchCopernicus(): Promise<IntelEvent[]> {
  const start = new Date(Date.now() - 3 * 864e5).toISOString().split('.')[0] + 'Z';
  const [w, s, e, n] = COP_BBOX;
  const poly = `${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}`;
  const results: IntelEvent[] = [];

  for (const col of ['SENTINEL-1', 'SENTINEL-2'] as const) {
    try {
      const filter =
        `Collection/Name eq '${col}' and ` +
        `OData.CSC.Intersects(area=geography'SRID=4326;POLYGON((${poly}))') and ` +
        `ContentDate/Start gt ${start}`;
      const url =
        `https://catalogue.dataspace.copernicus.eu/odata/v1/Products` +
        `?$filter=${encodeURIComponent(filter)}&$top=30&$orderby=ContentDate/Start desc`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const json = await res.json() as { value?: Array<{
        Name?: string; ContentDate?: { Start?: string }
      }> };
      (json.value ?? []).forEach(p => {
        results.push({
          src:      'cop',
          type:     `${(p.Name ?? '').substring(0, 2)} ${(p.Name ?? '').includes('GRD') ? 'SAR' : 'MSI'}`,
          date:     (p.ContentDate?.Start ?? '').split('T')[0],
          time:     (p.ContentDate?.Start ?? '').substring(11, 16),
          name:     p.Name ?? '',
          platform: (p.Name ?? '').substring(0, 2),
          lat:      0,
          lon:      0,
        });
      });
    } catch { /* continue */ }
  }
  return results;
}

/* ── ACLED ───────────────────────────────────────────────────
   Armed Conflict Location & Event Data — https://acleddata.com */

export async function fetchACLED(key: string, email: string): Promise<IntelEvent[] | null> {
  if (!key || !email) return null; // signal caller to use fallback
  const url =
    `https://api.acleddata.com/acled/read` +
    `?iso=180&limit=200` +
    `&event_date=${daysAgoISO(90)}|${todayISO()}` +
    `&event_date_where=BETWEEN` +
    `&key=${encodeURIComponent(key)}` +
    `&email=${encodeURIComponent(email)}`;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const json = await res.json() as { success?: boolean; data?: Array<Record<string, string>> };
    if (!json.success || !json.data?.length) return null;
    return json.data.map(e => ({
      src:       'acled' as const,
      type:      e['event_type'] ?? '',
      subtype:   e['sub_event_type'] ?? '',
      date:      e['event_date'] ?? '',
      location:  e['location'] ?? '',
      admin1:    e['admin1'] ?? '',
      lat:       parseFloat(e['latitude'] ?? '0'),
      lon:       parseFloat(e['longitude'] ?? '0'),
      fatalities: parseInt(e['fatalities'] ?? '0', 10),
      actor1:    e['actor1'] ?? '',
      actor2:    e['actor2'] ?? '',
      notes:     e['notes'] ?? '',
    }));
  } catch {
    return null;
  }
}
