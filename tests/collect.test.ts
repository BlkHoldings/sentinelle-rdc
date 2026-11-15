/* The server collector's parsing, against recorded and representative
   inputs. These run in Node, like the collector itself. */

import { describe, it, expect } from 'vitest';
import {
  tidyTitle, parseSeenDate, stripHtml, parseFeed, normDate, isDrcRelevant,
  sourceTypeForUrl, normGdelt, normFeed, buildWire, hostOf, normX, stripTcoLinks,
} from '../scripts/collect-lib.mjs';
import gdelt from './fixtures/gdelt.json';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>Nord-Kivu : affrontements entre FARDC et M23 près de Sake</title>
    <link>https://www.radiookapi.net/2026/11/14/actualite/securite/nord-kivu-sake</link>
    <pubDate>Fri, 14 Nov 2026 06:30:00 +0100</pubDate>
    <description><![CDATA[<p>Des <b>combats</b> ont repris ce matin.</p>]]></description></item>
  <item><title>Football : résultats du championnat européen</title>
    <link>https://www.radiookapi.net/2026/11/14/sport/football</link>
    <pubDate>Fri, 14 Nov 2026 05:00:00 +0100</pubDate>
    <description>Sans rapport avec la zone.</description></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>DRC: Humanitarian access worsens in Ituri</title>
    <link href="https://news.un.org/en/story/2026/11/1150000"/>
    <published>2026-11-14T08:00:00Z</published>
    <summary>Aid agencies warn about Ituri.</summary></entry>
  <entry><title>Floods in Bangladesh displace thousands</title>
    <link href="https://news.un.org/en/story/2026/11/1150001"/>
    <published>2026-11-14T07:00:00Z</published>
    <summary>Monsoon season.</summary></entry>
</feed>`;

describe('text helpers', () => {
  it('repairs GDELT punctuation', () => {
    expect(tidyTitle('Surpasses 11 , 000 Cases and 5 , 387 Deaths')).toBe('Surpasses 11,000 Cases and 5,387 Deaths');
  });
  it('parses the compact timestamp, rejects others', () => {
    expect(parseSeenDate('20261114T063000Z')).toBe('2026-11-14T06:30:00Z');
    expect(parseSeenDate('2026-11-14')).toBe('');
  });
  it('strips HTML, CDATA and entities', () => {
    expect(stripHtml('<![CDATA[<p>Des <b>combats</b> &amp; tirs</p>]]>')).toBe('Des combats & tirs');
  });
  it('normalises dates and rejects junk', () => {
    expect(normDate('Fri, 14 Nov 2026 06:30:00 +0100')).toBe('2026-11-14T05:30:00.000Z');
    expect(normDate('not a date')).toBe('');
  });
});

describe('relevance', () => {
  it('matches DRC terms ignoring accents and case', () => {
    expect(isDrcRelevant('Combats à GOMA')).toBe(true);
    expect(isDrcRelevant('Situation au Kasaï')).toBe(true);
    expect(isDrcRelevant('Football en Europe')).toBe(false);
  });
});

describe('source typing', () => {
  it('maps hosts to the fusion taxonomy', () => {
    expect(sourceTypeForUrl('https://www.radiookapi.net/x')).toBe('radio_okapi');
    expect(sourceTypeForUrl('https://actualite.cd/x')).toBe('actualite_cd');
    expect(sourceTypeForUrl('https://reliefweb.int/x')).toBe('reliefweb');
    expect(sourceTypeForUrl('https://unknown.example/x')).toBe('press_other');
    expect(hostOf('https://www.radiookapi.net/x')).toBe('radiookapi.net');
  });
});

describe('RSS / Atom parsing', () => {
  it('reads RSS items with links and dates', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].link).toBe('https://www.radiookapi.net/2026/11/14/actualite/securite/nord-kivu-sake');
    expect(items[0].desc).toContain('combats');
  });
  it('reads Atom entries with href links', () => {
    const items = parseFeed(ATOM);
    expect(items[0].link).toBe('https://news.un.org/en/story/2026/11/1150000');
  });
});

describe('normalisation', () => {
  it('turns GDELT articles into citable wire records', () => {
    const recs = normGdelt(gdelt.articles);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.source_id.startsWith('gdelt:')).toBe(true);
      expect(r.created_at).toMatch(/^\d{4}-/);
    }
  });
  it('keeps relevant RSS and drops the rest when filtering', () => {
    const okapi = normFeed(parseFeed(RSS), { filter: false });  // trusted feed, keep all
    expect(okapi).toHaveLength(2);
    const un = normFeed(parseFeed(ATOM), { filter: true });     // mixed feed, filter
    expect(un).toHaveLength(1);
    expect(un[0].url).toContain('1150000');
    expect(un[0].source_type).toBe('ocha');
  });
});

describe('wire assembly', () => {
  const now = new Date('2026-11-14T12:00:00Z').getTime();
  const rec = (id: string, hoursAgo: number) => ({ source_id: id, created_at: new Date(now - hoursAgo * 3.6e6).toISOString() });
  it('dedupes by source_id, drops the old, sorts newest first, caps', () => {
    const wire = buildWire([
      [rec('a', 1), rec('b', 50)],
      [rec('a', 1), rec('c', 200)],   // 'a' duplicate; 'c' older than 96h
    ], { now, maxAgeH: 96, cap: 10 });
    expect(wire.map((r) => r.source_id)).toEqual(['a', 'b']);
  });
  it('caps the output', () => {
    const many = Array.from({ length: 50 }, (_, i) => rec(`r${i}`, i));
    expect(buildWire([many], { now, cap: 20 })).toHaveLength(20);
  });
});
describe('stripHtml double-encoding', () => {
  it('removes tags that were HTML-entity-encoded in the feed', () => {
    expect(stripHtml('Fait. &lt;span property="x"&gt;bruit&lt;/span&gt; &lt;div&gt;Image media&lt;/div&gt; suite')).toBe('Fait. bruit Image media suite');
  });
});

describe('X (Twitter) normalisation', () => {
  const payload = {
    data: [
      { id: '1801', text: 'Affrontements à Goma entre FARDC et M23. https://t.co/abc', author_id: 'u1', created_at: '2026-11-15T06:30:00.000Z', lang: 'fr' },
      { id: '1802', text: 'Great match last night #football', author_id: 'u2', created_at: '2026-11-15T05:00:00.000Z', lang: 'en' },
      { id: '1803', text: 'Gunfire near Beni, North Kivu overnight. https://t.co/xyz', author_id: 'u3', created_at: '2026-11-15T04:00:00.000Z', lang: 'en' },
    ],
    includes: { users: [
      { id: 'u1', username: 'KivuAlerte', verified: false },
      { id: 'u2', username: 'fan', verified: false },
      { id: 'u3', username: 'ReutersAfrica', verified: true },
    ] },
  };
  it('strips t.co links from the text', () => {
    expect(stripTcoLinks('Texte https://t.co/abc fin')).toBe('Texte fin');
  });
  it('keeps only DRC-relevant posts and grades by account verification', () => {
    const r = normX(payload);
    expect(r.map((x) => x.source_id)).toEqual(['x:1801', 'x:1803']); // football dropped
    expect(r[0].source_type).toBe('twitter_unverified');
    expect(r[1].source_type).toBe('twitter_verified');
  });
  it('builds a real post URL and an @handle', () => {
    const r = normX(payload);
    expect(r[0].url).toBe('https://x.com/KivuAlerte/status/1801');
    expect(r[0].handle).toBe('@KivuAlerte');
  });
  it('handles a missing includes block without throwing', () => {
    expect(normX({ data: [{ id: '9', text: 'Goma clash', author_id: 'zz', lang: 'fr' }] })).toHaveLength(1);
    expect(normX({})).toEqual([]);
  });
});
