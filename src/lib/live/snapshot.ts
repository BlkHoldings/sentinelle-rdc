/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Server-collected snapshot
   ═══════════════════════════════════════════════════════════════════════

   The one source that is always populated, because a server collects it
   around the clock (scripts/collect.mjs, run every 30 minutes by GitHub
   Actions) rather than depending on a visitor's browser.

   The snapshot lives on the repository's `data` branch and is read
   straight from raw.githubusercontent.com, which serves it with open CORS
   and a short cache. So the site needs no backend of its own and no
   rebuild to show fresh data: the collector updates the branch, the
   browser reads it on the next poll.

   This is how the Congolese press (Radio Okapi, Actualité.cd, 7sur7) and
   GDELT reach the feed at all — a browser cannot read the first (no CORS)
   and is rate-limited on the second. A server has neither limit.
   ═══════════════════════════════════════════════════════════════════════ */

import { fetchJSON, type FetchResult, type LiveSourceMeta } from './client';
import type { RawReport } from '@/lib/fusion/schema';

/* Override at build time if the repository is renamed. */
const REPO = process.env.NEXT_PUBLIC_DATA_REPO || 'BlkHoldings/sentinelle-rdc';
const BRANCH = process.env.NEXT_PUBLIC_DATA_BRANCH || 'data';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

export interface SnapshotSource {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  ms: number;
  error?: string;
}

export interface SnapshotManifest {
  generatedAt: string;
  total: number;
  newestRecordAt: string | null;
  sources: SnapshotSource[];
  note?: string;
}

export interface Snapshot {
  manifest: SnapshotManifest;
  reports: RawReport[];
}

export const SNAPSHOT_META: LiveSourceMeta = {
  id: 'snapshot',
  label: 'Collecteur 24h/24 (presse + GDELT)',
  purpose: 'Instantané collecté côté serveur toutes les 30 min : presse congolaise (Radio Okapi, Actualité.cd), ReliefWeb, UN News, GDELT. Alimente le moteur de fusion même navigateur fermé.',
  provider: 'GitHub Actions → branche data',
  docs: 'https://github.com/BlkHoldings/sentinelle-rdc/tree/data',
  cadence: '30 min',
  requiresKey: false,
};

interface RawManifest extends SnapshotManifest { }

/** Cache-bust so a 30-minute-old CDN copy is not served for hours. */
function bust(url: string): string {
  const slot = Math.floor(Date.now() / 300_000); // 5-minute slots
  return `${url}?t=${slot}`;
}

export async function fetchSnapshot(): Promise<FetchResult<Snapshot>> {
  const man = await fetchJSON<RawManifest>(bust(`${RAW}/manifest.json`), { timeoutMs: 15_000 });
  if (!man.ok || !man.data) {
    // No data branch yet, or it is unreachable from this network. This is
    // a normal early state, not an alarm: live browser feeds still run.
    return {
      ...man, data: null, count: 0,
      health: man.health === 'error' ? 'idle' : man.health,
      error: man.error ?? 'Collecteur pas encore initialisé (branche data absente).',
    };
  }
  const rep = await fetchJSON<RawReport[]>(bust(`${RAW}/wire.json`), { timeoutMs: 20_000 });
  const reports = Array.isArray(rep.data) ? rep.data : [];
  return {
    ...man,
    data: { manifest: man.data, reports },
    count: reports.length,
    newestRecordAt: man.data.newestRecordAt ?? undefined,
  };
}
