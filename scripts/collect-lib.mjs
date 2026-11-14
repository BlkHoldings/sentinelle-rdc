/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Server-side collector: pure helpers
   ═══════════════════════════════════════════════════════════════════════

   Shared by scripts/collect.mjs (the GitHub Actions job) and
   tests/collect.test.ts. No network, no filesystem — just the parsing
   and normalisation, so it can be tested against recorded responses.

   These run on a server, which is the whole point: a browser cannot read
   the Congolese press RSS feeds (no CORS) and is rate-limited on GDELT by
   its own IP. A scheduled job has neither constraint, so the open sources
   this country actually publishes in can finally be collected.
   ═══════════════════════════════════════════════════════════════════════ */

/** DRC-relevance test for feeds that also carry other countries. */
const DRC_TERMS = [
  'congo', 'rdc', 'drc', 'kinshasa', 'kivu', 'goma', 'bukavu', 'beni', 'butembo',
  'ituri', 'bunia', 'uvira', 'masisi', 'rutshuru', 'walikale', 'fizi', 'minembwe',
  'm23', 'fardc', 'wazalendo', 'monusco', 'adf', 'codeco', 'mai-mai', 'maimai',
  'lualaba', 'tanganyika', 'kasai', 'kasaï', 'tshopo', 'maniema', 'mbuji', 'kananga',
  'lubumbashi', 'kalemie', 'kolwezi', 'nyiragongo', 'congolais', 'congolese',
];

export function isDrcRelevant(text) {
  const t = fold(text);
  return DRC_TERMS.some((k) => t.includes(k));
}

export function fold(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** GDELT tokenises punctuation apart: "11 , 000" → "11,000". */
export function tidyTitle(t) {
  return (t ?? '')
    .replace(/\s+([,.;:!?%])/g, '$1')
    .replace(/(\d),\s(\d{3})\b/g, '$1,$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `20261112T070000Z` → ISO 8601. '' on anything else. */
export function parseSeenDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? '');
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : '';
}

const decodeEntities = (x) => (x ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ' '; } });

export function stripHtml(s) {
  // Decode first, so a double-encoded feed (&lt;span&gt;) becomes a real
  // <span> that the tag strip then removes; strip; decode any remainder.
  let t = (s ?? '').replace(/<!\[CDATA\[|\]\]>/g, '');
  t = decodeEntities(t);
  t = t.replace(/<[^>]*>/g, ' ');
  t = decodeEntities(t).replace(/<[^>]*>/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
  // CDATA or plain, first occurrence.
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? m[1] : '';
}

/** Minimal RSS 2.0 + Atom reader. The feeds here are standard and small;
 *  a full XML parser would be a dependency for no gain. */
export function parseFeed(xml) {
  const out = [];
  const items = [...(xml ?? '').matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  for (const block of items) {
    const title = stripHtml(tag(block, 'title'));
    if (!title) continue;
    // RSS <link>text</link>; Atom <link href="..."/>.
    let link = stripHtml(tag(block, 'link'));
    if (!link) { const m = /<link\b[^>]*href="([^"]+)"/i.exec(block); if (m) link = m[1]; }
    const dateRaw = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    const date = normDate(stripHtml(dateRaw));
    const desc = stripHtml(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'));
    out.push({ title, link: link.trim(), date, desc });
  }
  return out;
}

export function normDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const HOST_SOURCE = [
  [/radiookapi\.net/, 'radio_okapi'],
  [/actualite\.cd/, 'actualite_cd'],
  [/7sur7\.cd/, '7sur7'],
  [/politico\.cd/, 'politico_cd'],
  [/reliefweb\.int/, 'reliefweb'],
  [/news\.un\.org|un\.org/, 'ocha'],
];

export function sourceTypeForUrl(url) {
  for (const [re, type] of HOST_SOURCE) if (re.test(url)) return type;
  return 'press_other';
}

export function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; }
}

/** GDELT doc-API `articles` → normalised wire records. */
export function normGdelt(articles) {
  const out = [];
  const seen = new Set();
  for (const a of articles ?? []) {
    const url = a.url ?? '';
    const title = tidyTitle(a.title ?? '');
    const seen_at = parseSeenDate(a.seendate ?? '');
    if (!/^https?:\/\//i.test(url) || !title || !seen_at) continue;
    const domain = (a.domain ?? '').toLowerCase();
    const key = `${domain}|${fold(title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      source_type: sourceTypeForUrl(url),
      source_id: `gdelt:${url}`,
      handle: domain,
      url,
      text: title,
      created_at: seen_at,
      lang: a.language === 'French' ? 'fr' : a.language === 'English' ? 'en' : 'unknown',
      collector: 'gdelt',
    });
  }
  return out;
}

/** RSS items from one feed → normalised wire records, DRC-filtered. */
export function normFeed(items, { filter = true } = {}) {
  const out = [];
  for (const it of items ?? []) {
    if (!/^https?:\/\//i.test(it.link) || !it.title) continue;
    const body = `${it.title}. ${it.desc ?? ''}`.trim();
    if (filter && !isDrcRelevant(body)) continue;
    const type = sourceTypeForUrl(it.link);
    out.push({
      source_type: type,
      source_id: `rss:${it.link}`,
      handle: hostOf(it.link),
      url: it.link,
      text: body.length > 500 ? body.slice(0, 497) + '…' : body,
      created_at: it.date || new Date().toISOString(),
      lang: /actualite|radiookapi|7sur7|politico/.test(it.link) ? 'fr' : 'unknown',
      collector: 'rss',
    });
  }
  return out;
}

/** Merge, dedupe by source_id, drop anything older than `maxAgeH`,
 *  newest first, capped. */
export function buildWire(lists, { now = Date.now(), maxAgeH = 96, cap = 500 } = {}) {
  const byId = new Map();
  for (const list of lists) for (const r of list) {
    if (!byId.has(r.source_id)) byId.set(r.source_id, r);
  }
  const cutoff = now - maxAgeH * 3_600_000;
  return [...byId.values()]
    .filter((r) => { const t = new Date(r.created_at).getTime(); return Number.isFinite(t) && t >= cutoff; })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, cap);
}
