/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Live Source Client
   ═══════════════════════════════════════════════════════════════════════

   Every live source in this build is keyless and public, because the app
   is a static bundle on a CDN — there is nowhere to put a secret. That
   constraint is also a design advantage: an analyst can verify every
   upstream by pasting the URL into a browser.

   What this module adds over bare `fetch`:

   • **Health as a first-class result.** A source that is down must say so
     on screen. The failure mode to avoid is a map that silently shows
     less and looks calm — an empty theatre and a broken feed are
     indistinguishable to the eye, and only one of them is good news.
   • **Measured latency and record counts**, so "slow" and "empty" are
     separable from "failed".
   • **Timeout and single retry**, because mobile links in this theatre
     drop packets rather than connections.
   • **Staleness tracking** — the age of the data, not of the request.
     A feed that answers instantly with yesterday's contents is stale,
     and the request clock cannot see that.
   ═══════════════════════════════════════════════════════════════════════ */

export type SourceHealth = 'idle' | 'loading' | 'ok' | 'degraded' | 'error';

export interface LiveSourceMeta {
  id: string;
  label: string;
  /** What this feed actually tells you, in operator terms. */
  purpose: string;
  /** Publisher, for the attribution line. */
  provider: string;
  /** Documentation or landing page, so a claim can be checked. */
  docs: string;
  /** Update cadence advertised by the provider. */
  cadence: string;
  /** Does it need a key? All of these are false by design. */
  requiresKey: boolean;
}

export interface FetchResult<T> {
  ok: boolean;
  health: SourceHealth;
  data: T | null;
  /** Records returned, after any client-side filtering. */
  count: number;
  /** Round-trip time in ms. */
  latencyMs: number;
  /** When we fetched. */
  fetchedAt: string;
  /** Newest record timestamp, when the payload carries one. */
  newestRecordAt?: string;
  error?: string;
  /** Final URL used, so the operator can reproduce the call. */
  url?: string;
}

export function emptyResult<T>(): FetchResult<T> {
  return {
    ok: false, health: 'idle', data: null, count: 0,
    latencyMs: 0, fetchedAt: '',
  };
}

/**
 * JSON fetch with timeout, one retry, and health classification.
 *
 * `degraded` is a distinct state from `error` on purpose: a source that
 * answered but returned nothing usable is a different operational fact
 * from one that could not be reached, and they call for different
 * responses — check the query versus check the link.
 */
export async function fetchJSON<T>(
  url: string,
  opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {},
): Promise<FetchResult<T>> {
  const { timeoutMs = 15_000, retries = 1, headers } = opts;
  const started = performance.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json', ...headers },
      });
      const latencyMs = Math.round(performance.now() - started);

      if (!res.ok) {
        // 4xx is our bug and will not fix itself on retry; 5xx might.
        if (res.status < 500 || attempt === retries) {
          return {
            ok: false, health: 'error', data: null, count: 0, latencyMs,
            fetchedAt: new Date().toISOString(),
            error: `HTTP ${res.status}`, url,
          };
        }
        continue;
      }

      const data = (await res.json()) as T;
      return {
        ok: true, health: 'ok', data, count: 0, latencyMs,
        fetchedAt: new Date().toISOString(), url,
      };
    } catch (e) {
      if (attempt === retries) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          ok: false, health: 'error', data: null, count: 0,
          latencyMs: Math.round(performance.now() - started),
          fetchedAt: new Date().toISOString(),
          // A browser CORS rejection surfaces as an opaque TypeError with
          // no detail, so name the likely cause rather than showing
          // "Failed to fetch" and leaving the operator guessing.
          error: /fetch|network|load failed/i.test(msg)
            ? 'inaccessible (réseau, CORS ou blocage réseau local)'
            : msg,
          url,
        };
      }
    }
  }

  return {
    ok: false, health: 'error', data: null, count: 0,
    latencyMs: Math.round(performance.now() - started),
    fetchedAt: new Date().toISOString(), error: 'échec après nouvelle tentative', url,
  };
}

/** Text fetch, for XML/RSS feeds that have no JSON representation. */
export async function fetchText(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<FetchResult<string>> {
  const { timeoutMs = 15_000 } = opts;
  const started = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const latencyMs = Math.round(performance.now() - started);
    if (!res.ok) {
      return {
        ok: false, health: 'error', data: null, count: 0, latencyMs,
        fetchedAt: new Date().toISOString(), error: `HTTP ${res.status}`, url,
      };
    }
    return {
      ok: true, health: 'ok', data: await res.text(), count: 0, latencyMs,
      fetchedAt: new Date().toISOString(), url,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false, health: 'error', data: null, count: 0,
      latencyMs: Math.round(performance.now() - started),
      fetchedAt: new Date().toISOString(),
      error: /fetch|network|load failed/i.test(msg)
        ? 'inaccessible (réseau, CORS ou blocage réseau local)'
        : msg,
      url,
    };
  }
}

/** How old the newest record is, in hours. */
export function stalenessHours(r: FetchResult<unknown>): number | null {
  if (!r.newestRecordAt) return null;
  const t = new Date(r.newestRecordAt).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

/** Eastern DRC bounding box: [west, south, east, north]. */
export const AOR_BBOX: [number, number, number, number] = [26.5, -6.5, 31.2, 4.0];

export function inAOR(lat: number, lon: number): boolean {
  const [w, s, e, n] = AOR_BBOX;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}
