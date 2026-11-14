#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Server-side collector
   ═══════════════════════════════════════════════════════════════════════

   Runs on a schedule in GitHub Actions (see .github/workflows/collect.yml).
   Collects open sources a browser cannot — the Congolese press RSS feeds
   (no CORS) and GDELT at a server's own rate limit — normalises them, and
   writes two snapshot files that the live site reads directly:

     wire.json      the collected reports, newest first
     manifest.json  per-source status + a generated-at timestamp

   Nothing here is interception. Every source is a public feed anyone can
   open in a browser; the job only reads them on a timer and in one place,
   so the data is there around the clock whether or not anyone is looking.

   Writes to OUT_DIR (default ./data-out). The workflow points that at a
   checkout of the orphan `data` branch and commits the result, so the
   snapshot refreshes without rebuilding or redeploying the site.
   ═══════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normGdelt, normFeed, parseFeed, buildWire } from './collect-lib.mjs';

const OUT_DIR = process.env.OUT_DIR || './data-out';
const UA = 'Mozilla/5.0 (compatible; NKOYI-collector/1.0; +https://github.com/BlkHoldings/sentinelle-rdc)';

/** One fetch with a timeout and up to two retries with backoff. */
async function get(url, { json = false, timeoutMs = 30_000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = json ? await res.json() : await res.text();
      return { ok: true, body, ms: Date.now() - t0 };
    } catch (e) {
      if (attempt >= retries) return { ok: false, error: String(e.message || e), ms: Date.now() - t0 };
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

const GDELT_QUERY = '(Goma OR Bukavu OR "Nord-Kivu" OR "Sud-Kivu" OR "North Kivu" OR "South Kivu" '
  + 'OR Ituri OR Beni OR Bunia OR Uvira OR Masisi OR Rutshuru OR Walikale OR Fizi OR M23 OR FARDC OR MONUSCO) '
  + '(sourcelang:french OR sourcelang:english)';

function gdeltUrl() {
  const p = new URLSearchParams({
    query: GDELT_QUERY, mode: 'artlist', format: 'json', sort: 'datedesc',
    maxrecords: '250', timespan: '72h',
  });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${p}`;
}

/* The press and institutional feeds. All public, all readable by a server. */
const FEEDS = [
  { id: 'radio_okapi', name: 'Radio Okapi',   url: 'https://www.radiookapi.net/feed',     filter: false },
  { id: 'actualite',   name: 'Actualité.cd',  url: 'https://actualite.cd/feed',           filter: false },
  { id: 'reliefweb',   name: 'ReliefWeb RDC', url: 'https://reliefweb.int/country/cod/rss.xml', filter: false },
  { id: 'un_news',     name: 'UN News',       url: 'https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml', filter: true },
];

async function main() {
  const sources = [];
  const lists = [];
  const started = new Date().toISOString();

  // GDELT — one request; the collector is the only thing hitting it from
  // this IP, so the 5-second limit is never a problem here.
  {
    const r = await get(gdeltUrl(), { json: true, timeoutMs: 30_000, retries: 3 });
    if (r.ok) {
      const recs = normGdelt(r.body?.articles ?? []);
      lists.push(recs);
      sources.push({ id: 'gdelt', name: 'GDELT', ok: true, count: recs.length, ms: r.ms });
    } else {
      sources.push({ id: 'gdelt', name: 'GDELT', ok: false, count: 0, ms: r.ms, error: r.error });
    }
  }

  // RSS feeds, sequentially — polite, and the volume is tiny.
  for (const f of FEEDS) {
    const r = await get(f.url, { timeoutMs: 25_000 });
    if (r.ok) {
      const recs = normFeed(parseFeed(r.body), { filter: f.filter });
      lists.push(recs);
      sources.push({ id: f.id, name: f.name, ok: true, count: recs.length, ms: r.ms });
    } else {
      sources.push({ id: f.id, name: f.name, ok: false, count: 0, ms: r.ms, error: r.error });
    }
  }

  const wire = buildWire(lists);
  const okSources = sources.filter((s) => s.ok).length;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'wire.json'), JSON.stringify(wire));
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    startedAt: started,
    total: wire.length,
    newestRecordAt: wire[0]?.created_at ?? null,
    sources,
    note: 'Instantané de sources ouvertes, collecté côté serveur. Aucune interception. Un signalement de presse n’est pas un fait vérifié.',
  }, null, 1));

  console.log(`wire=${wire.length} sources_ok=${okSources}/${sources.length}`);
  for (const s of sources) console.log(`  ${s.ok ? 'OK ' : 'ERR'} ${s.name} ${s.count} (${s.ms}ms)${s.error ? ' — ' + s.error : ''}`);
  // A total collector failure (nothing from any source) exits non-zero so
  // the workflow is marked failed and does not commit an empty snapshot.
  if (!wire.length && okSources === 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
