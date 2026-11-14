/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Internet connectivity (IODA)
   ═══════════════════════════════════════════════════════════════════════

   A real early-warning signal, not a simulated one. IODA (Georgia Tech /
   CAIDA) watches three independent views of a country's internet —
   global routing (BGP), active probing of address space, and a network
   telescope — and raises an alert when connectivity drops below its
   recent baseline.

   This matters in the DRC specifically: authorities have cut the internet
   during unrest and around elections, and a nationwide or provincial
   outage is itself an event — often the first sign that something is
   happening in a place the press cannot yet reach.

   Keyless and CORS-open, so the browser reads it directly. It replaces
   the connectivity telemetry that previously existed only in
   demonstration mode with a measured one.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';

export type ConnStatus = 'up' | 'degraded' | 'outage' | 'unknown';

export interface ConnAlert {
  datasource: string;
  level: 'normal' | 'warning' | 'critical' | string;
  /** Observed value (e.g. number of routed /24s) and the baseline it fell from. */
  value: number | null;
  baseline: number | null;
  at: string;
}

export interface Connectivity {
  status: ConnStatus;
  /** Human sentence for the indicator. */
  summary: string;
  /** Most recent alert per datasource, worst first. */
  current: ConnAlert[];
  /** Recent alert history, newest first. */
  alerts: ConnAlert[];
  updatedAt: string;
}

export const CONNECTIVITY_META: LiveSourceMeta = {
  id: 'connectivity',
  label: 'Connectivité internet (IODA)',
  purpose: 'Détection de coupures internet en RDC — routage BGP, sondage actif, télescope réseau. Un arrêt national ou provincial est en soi un signal.',
  provider: 'IODA — Georgia Tech / CAIDA',
  docs: 'https://ioda.inetintel.cc.gatech.edu/',
  cadence: '5 min',
  requiresKey: false,
};

const DS_LABEL: Record<string, string> = {
  bgp: 'Routage BGP',
  'ping-slash24': 'Sondage actif',
  'merit-nt': 'Télescope réseau',
  gtr: 'Trafic de recherche',
};

export function datasourceLabel(id: string): string {
  return DS_LABEL[id] ?? id;
}

interface RawAlert {
  datasource?: string;
  level?: string;
  value?: number;
  historyValue?: number;
  time?: number;
  entity?: { type?: string };
}

const RECENT_MS = 2 * 3_600_000;
const SEVERITY = { critical: 3, warning: 2, normal: 1 } as const;

export function parseConnectivity(raw: { data?: RawAlert[] }, now = Date.now()): Connectivity {
  const all = (raw.data ?? [])
    .filter((a) => a.datasource && a.time)
    .map<ConnAlert>((a) => ({
      datasource: a.datasource!,
      level: (a.level as ConnAlert['level']) ?? 'normal',
      value: a.value ?? null,
      baseline: a.historyValue ?? null,
      at: new Date(a.time! * 1000).toISOString(),
    }))
    .sort((a, b) => b.at.localeCompare(a.at));

  // Latest alert per datasource.
  const latest = new Map<string, ConnAlert>();
  for (const a of all) if (!latest.has(a.datasource)) latest.set(a.datasource, a);
  const current = [...latest.values()].sort(
    (a, b) => (SEVERITY[b.level as keyof typeof SEVERITY] ?? 0) - (SEVERITY[a.level as keyof typeof SEVERITY] ?? 0),
  );

  /* Status is driven only by alerts that are both recent and still in a
     bad state: an old resolved dip must not read as an ongoing outage. */
  const active = current.filter((a) => a.level !== 'normal' && now - new Date(a.at).getTime() <= RECENT_MS);
  const nCrit = active.filter((a) => a.level === 'critical').length;
  /* An unresolved-but-old bad alert: the last thing we heard was trouble
     and no recovery since, so we do not know the current state. Claiming
     "up" there would be a false all-clear. */
  const staleBad = active.length === 0 && current.some((a) => a.level !== 'normal');
  let status: ConnStatus = 'unknown';
  let summary = 'État indéterminé.';
  if (current.length === 0) {
    status = 'unknown';
    summary = 'Aucune mesure récente.';
  } else if (active.length === 0 && !staleBad) {
    status = 'up';
    summary = 'Connectivité nominale sur les sources de mesure.';
  } else if (staleBad) {
    status = 'unknown';
    summary = 'Dernière alerte non résolue mais ancienne — état actuel incertain.';
  } else if (nCrit >= 2) {
    status = 'outage';
    summary = `Coupure probable — ${nCrit} sources en alerte critique.`;
  } else {
    status = 'degraded';
    summary = `Connectivité dégradée — ${active.map((a) => datasourceLabel(a.datasource)).join(', ')}.`;
  }

  return { status, summary, current, alerts: all.slice(0, 20), updatedAt: new Date(now).toISOString() };
}

export async function fetchConnectivity(): Promise<FetchResult<Connectivity>> {
  const until = Math.floor(Date.now() / 1000);
  const from = until - 3 * 86_400;
  const url = `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${from}&until=${until}&entityType=country&entityCode=CD`;
  const res = await fetchJSON<{ data?: RawAlert[] }>(url, { timeoutMs: 20_000 });
  if (!res.ok || !res.data) return { ...res, data: null, count: 0 };
  const conn = parseConnectivity(res.data);
  return {
    ...res, data: conn, count: conn.current.length,
    // "degraded" is a healthy reading of a real problem, not a feed fault.
    health: 'ok',
    newestRecordAt: conn.alerts[0]?.at,
  };
}
