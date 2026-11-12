/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — GDELT news index
   ═══════════════════════════════════════════════════════════════════════

   GDELT monitors world news and updates every 15 minutes. It is the one
   keyless source here that reaches the press at something close to real
   time, which makes it the main live input to the fusion engine.

   What it is, precisely: an *index of headlines*. Each record is a real
   article at a real URL, published by the outlet named. GDELT does not
   check what the article says, and neither does this connector. So:

   • A GDELT record enters the pipeline as one press report, graded low
     unless the outlet is one the engine already profiles.
   • Only the headline is available. Extraction works on that line alone,
     so many records will geolocate to a province or not at all — and
     the positional uncertainty says so.
   • Syndicated copies of one wire story arrive as many records. They
     share a source family, and the confidence model already discounts
     agreement within a family, so forty reprints are not forty
     confirmations.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';
import type { RawReport, SourceType } from '@/lib/fusion/schema';

export interface GdeltArticle {
  url: string;
  title: string;
  /** ISO 8601, from GDELT's `seendate` — when GDELT first saw it. */
  seen: string;
  domain: string;
  language: string;
  sourceCountry: string;
}

export const GDELT_META: LiveSourceMeta = {
  id: 'gdelt',
  label: 'GDELT — presse mondiale',
  purpose: 'Titres de presse mentionnant l’est de la RDC, indexés toutes les 15 minutes. Alimente le moteur de fusion.',
  provider: 'The GDELT Project',
  docs: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
  cadence: '15 min',
  requiresKey: false,
};

/** Outlets the reliability model already knows by name. */
const KNOWN_DOMAIN: Record<string, SourceType> = {
  'radiookapi.net': 'radio_okapi',
  'actualite.cd': 'actualite_cd',
  '7sur7.cd': '7sur7',
  'politico.cd': 'politico_cd',
  'reliefweb.int': 'reliefweb',
};

const PLACES = ['Goma', 'Bukavu', '"Nord-Kivu"', '"Sud-Kivu"', '"North Kivu"', '"South Kivu"', 'Ituri', 'Beni', 'Bunia', 'Uvira', 'Masisi', 'Rutshuru', 'M23'];

export function gdeltUrl(hours = 72, max = 75): string {
  const query = `(${PLACES.join(' OR ')}) (sourcelang:french OR sourcelang:english)`;
  const p = new URLSearchParams({
    query, mode: 'artlist', format: 'json', sort: 'datedesc',
    maxrecords: String(max), timespan: `${hours}h`,
  });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${p}`;
}

/** `20261112T070000Z` → ISO. Returns '' on anything else. */
export function parseSeenDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? '');
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : '';
}

/** GDELT tokenises punctuation apart: "11 , 000" → "11,000". */
export function tidyTitle(t: string): string {
  return (t ?? '')
    .replace(/\s+([,.;:!?%])/g, '$1')
    .replace(/(\d),\s(\d{3})\b/g, '$1,$2')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawGdelt { articles?: { url?: string; title?: string; seendate?: string; domain?: string; language?: string; sourcecountry?: string }[] }

export function parseGdelt(raw: RawGdelt): GdeltArticle[] {
  const seenTitles = new Set<string>();
  const out: GdeltArticle[] = [];
  for (const a of raw.articles ?? []) {
    const url = a.url ?? '';
    const title = tidyTitle(a.title ?? '');
    const seen = parseSeenDate(a.seendate ?? '');
    // A record without a link or a date cannot be cited; drop it.
    if (!/^https?:\/\//i.test(url) || !title || !seen) continue;
    // The same headline from the same outlet, re-indexed under a second URL.
    const key = `${a.domain}|${title.toLowerCase()}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    out.push({
      url, title, seen, domain: (a.domain ?? '').toLowerCase(),
      language: a.language ?? '', sourceCountry: a.sourcecountry ?? '',
    });
  }
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchGdelt(): Promise<FetchResult<GdeltArticle[]>> {
  /* GDELT allows one request every five seconds per address and answers
     a faster one with a 429 that carries no CORS header — which a
     browser reports as an opaque network failure. So: no immediate
     retry (it would only extend the penalty); one retry after the
     window has passed; and an error message that names the likely cause. */
  let res = await fetchJSON<RawGdelt>(gdeltUrl(), { timeoutMs: 25_000, retries: 0 });
  if (!res.ok) {
    await wait(6_500);
    res = await fetchJSON<RawGdelt>(gdeltUrl(), { timeoutMs: 25_000, retries: 0 });
  }
  if (!res.ok || !res.data) {
    return {
      ...res, data: null, count: 0,
      error: `${res.error ?? 'échec'} — GDELT limite à une requête toutes les 5 s par adresse ; nouvel essai au prochain cycle.`,
    };
  }
  const articles = parseGdelt(res.data);
  return {
    ...res, data: articles, count: articles.length,
    health: articles.length ? 'ok' : 'degraded',
    newestRecordAt: articles[0]?.seen,
  };
}

export function gdeltToRawReports(articles: GdeltArticle[]): RawReport[] {
  return articles.map((a) => ({
    source_type: KNOWN_DOMAIN[a.domain.replace(/^www\./, '')] ?? 'press_other',
    source_id: `gdelt:${a.url}`,
    handle: a.domain,
    url: a.url,
    text: a.title,
    created_at: a.seen,
    lang: a.language === 'French' ? 'fr' : a.language === 'English' ? 'en' : 'unknown',
  }));
}
