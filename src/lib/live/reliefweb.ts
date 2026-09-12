/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — ReliefWeb (UN OCHA)
   ═══════════════════════════════════════════════════════════════════════

   The most operationally useful keyless feed available for this theatre.
   ReliefWeb carries OCHA situation reports, cluster updates, MSF and NRC
   field dispatches, IOM displacement tracking — the reporting that
   actually drives humanitarian decisions in the Kivus, published by named
   organisations with editorial standards.

   These enter the fusion pipeline as `field`-family reports rather than
   going to a separate panel. That placement is deliberate: the `field`
   family carries the lowest within-family correlation coefficient in the
   confidence model (ρ = 0.22), because independent NGO field networks
   genuinely do observe independently — unlike press, which cross-quotes
   relentlessly. A ReliefWeb dispatch corroborating a social-media claim
   should therefore move the posterior substantially, and with this wired
   in, it does.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';
import type { RawReport, SourceType } from '@/lib/fusion/schema';

export const RELIEFWEB_META: LiveSourceMeta = {
  id: 'reliefweb',
  label: 'ReliefWeb (OCHA)',
  purpose: 'Rapports humanitaires RDC — OCHA, ONG, clusters',
  provider: 'UN OCHA',
  docs: 'https://apidoc.reliefweb.int/',
  cadence: 'Continu, plusieurs publications par jour',
  requiresKey: false,
};

export interface ReliefWebReport {
  id: string;
  title: string;
  body: string;
  source: string;
  date: string;
  url: string;
  themes: string[];
}

interface RwField {
  title?: string;
  body?: string;
  'date'?: { created?: string; original?: string };
  source?: { name?: string; shortname?: string }[];
  url?: string;
  theme?: { name?: string }[];
}

interface RwResponse {
  data?: { id: string; fields?: RwField }[];
  totalCount?: number;
}

/**
 * Recent DRC reports.
 *
 * `appname` is required by ReliefWeb's terms so they can attribute
 * traffic; it is not a credential and carries no access rights.
 */
export async function fetchReliefWeb(limit = 40): Promise<FetchResult<ReliefWebReport[]>> {
  const params = [
    'appname=sentinelle-rdc',
    `limit=${limit}`,
    'sort[]=date.created:desc',
    'filter[field]=country.iso3',
    'filter[value]=cod',
    'fields[include][]=title',
    'fields[include][]=body',
    'fields[include][]=date.created',
    'fields[include][]=source.name',
    'fields[include][]=source.shortname',
    'fields[include][]=url',
    'fields[include][]=theme.name',
  ].join('&');
  const url = `https://api.reliefweb.int/v1/reports?${params}`;

  const res = await fetchJSON<RwResponse>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data?.data) return { ...res, data: null, count: 0 };

  const reports: ReliefWebReport[] = res.data.data.map((d) => {
    const f = d.fields ?? {};
    return {
      id: d.id,
      title: f.title ?? '',
      // Bodies are long-form markdown; the extractor only needs the lede,
      // and keeping the whole thing would balloon the dedupe window.
      body: (f.body ?? '').replace(/\s+/g, ' ').slice(0, 1500),
      source: f.source?.[0]?.shortname || f.source?.[0]?.name || 'ReliefWeb',
      date: f['date']?.created ?? f['date']?.original ?? new Date().toISOString(),
      url: f.url ?? 'https://reliefweb.int/',
      themes: (f.theme ?? []).map((t) => t.name ?? '').filter(Boolean),
    };
  });

  return {
    ...res,
    data: reports,
    count: reports.length,
    newestRecordAt: reports[0]?.date,
  };
}

/** Map a publishing organisation onto the source taxonomy. */
function sourceTypeFor(org: string): SourceType {
  const o = org.toLowerCase();
  if (o.includes('ocha')) return 'ocha';
  if (o.includes('monusco') || o.includes('monuc')) return 'monusco';
  if (/msf|nrc|oxfam|caritas|save the children|irc|acted|solidarit|medair|world vision|unicef|wfp|unhcr|iom|oim/.test(o)) {
    return 'ngo_field';
  }
  return 'reliefweb';
}

/**
 * Convert to pipeline input.
 *
 * Title and body are concatenated because the title alone routinely
 * carries the toponym and the body carries the casualty figures — the
 * extractor needs both in one span to tie them together.
 */
export function toRawReports(reports: ReliefWebReport[]): RawReport[] {
  return reports.map((r) => ({
    source_type: sourceTypeFor(r.source),
    source_id: `reliefweb:${r.id}`,
    handle: r.source,
    url: r.url,
    text: `${r.title}. ${r.body}`.trim(),
    created_at: new Date(r.date).toISOString(),
    lang: /\b(the|and|of|in|with|reported)\b/i.test(r.title) ? 'en' : 'fr',
  }));
}
