/* Parsers run against responses recorded from the live endpoints on
   2026-11-12 (tests/fixtures). If an upstream changes shape, these fail
   here rather than emptying a panel in production. */

import { describe, it, expect } from 'vitest';
import { parseGdelt, parseSeenDate, tidyTitle, gdeltToRawReports, gdeltUrl } from '@/lib/live/gdelt';
import {
  parseWho, mergeDisplacement, parseEonet, parseFlood, parseFunding, gibsTileUrl, gibsYesterday,
  SAT_LAYERS, RIVER_SITES,
} from '@/lib/live/opendata';
import { categoryOf } from '@/lib/intel/derive';
import gdelt from './fixtures/gdelt.json';
import who from './fixtures/who.json';
import origin from './fixtures/unhcr_origin.json';
import asylum from './fixtures/unhcr_asylum.json';
import idmc from './fixtures/idmc.json';
import eonet from './fixtures/eonet.json';
import flood from './fixtures/flood.json';
import flow from './fixtures/fts_flow.json';
import plans from './fixtures/fts_plans.json';

describe('GDELT', () => {
  it('parses the compact timestamp and rejects anything else', () => {
    expect(parseSeenDate('20261112T070000Z')).toBe('2026-11-12T07:00:00Z');
    expect(parseSeenDate('2026-11-12')).toBe('');
  });
  it('repairs GDELT’s spaced punctuation', () => {
    expect(tidyTitle('Ebola Outbreak Surpasses 11 , 000 Cases and 5 , 387 Deaths'))
      .toBe('Ebola Outbreak Surpasses 11,000 Cases and 5,387 Deaths');
  });
  it('keeps only citable articles from a real response', () => {
    const a = parseGdelt(gdelt);
    expect(a.length).toBeGreaterThan(0);
    for (const x of a) {
      expect(x.url).toMatch(/^https?:\/\//);
      expect(x.seen).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(x.title).not.toMatch(/\s,/);
    }
  });
  it('drops records with no link, no date, or a duplicate headline', () => {
    const a = parseGdelt({ articles: [
      { url: 'https://a.example/1', title: 'Titre', seendate: '20261112T070000Z', domain: 'a.example' },
      { url: 'https://a.example/2', title: 'Titre', seendate: '20261112T080000Z', domain: 'a.example' },
      { url: 'javascript:alert(1)', title: 'X', seendate: '20261112T070000Z', domain: 'b.example' },
      { url: 'https://c.example/1', title: 'Sans date', seendate: '', domain: 'c.example' },
    ] });
    expect(a.map((x) => x.url)).toEqual(['https://a.example/1']);
  });
  it('hands the engine a low-graded press report with its real URL', () => {
    const [r] = gdeltToRawReports(parseGdelt(gdelt));
    expect(r.source_type).toBe('press_other');
    expect(r.source_id.startsWith('gdelt:https://')).toBe(true);
    expect(r.source_id.startsWith('syn-')).toBe(false);
    expect(r.url).toMatch(/^https?:\/\//);
  });
  it('recognises outlets the reliability model already profiles', () => {
    const [r] = gdeltToRawReports([{ url: 'https://www.radiookapi.net/x', title: 't', seen: '2026-11-12T07:00:00Z', domain: 'radiookapi.net', language: 'French', sourceCountry: '' }]);
    expect(r.source_type).toBe('radio_okapi');
    expect(r.lang).toBe('fr');
  });
  it('builds a query bounded in time and size', () => {
    const u = new URL(gdeltUrl(48, 50));
    expect(u.searchParams.get('timespan')).toBe('48h');
    expect(u.searchParams.get('maxrecords')).toBe('50');
    expect(u.searchParams.get('format')).toBe('json');
  });
});

describe('WHO outbreak news', () => {
  it('builds a public link and strips markup from the summary', () => {
    const n = parseWho(who);
    expect(n.length).toBeGreaterThan(0);
    expect(n[0].url).toBe(`https://www.who.int/emergencies/disease-outbreak-news/item/${n[0].id}`);
    expect(n[0].summary).not.toMatch(/<[a-z]/i);
    expect(n[0].published).toMatch(/^\d{4}-/);
  });
});

describe('displacement series', () => {
  const rows = mergeDisplacement(origin, asylum, idmc);
  it('merges the three series by year, oldest first', () => {
    expect(rows.map((r) => r.year)).toEqual([...rows.map((r) => r.year)].sort((a, b) => a - b));
    const y2025 = rows.find((r) => r.year === 2025)!;
    expect(y2025.refugeesAbroad).toBe(1176489);
    expect(y2025.idpsUnhcr).toBe(5669479);
    expect(y2025.idpsIdmc).toBe(4276000);
  });
  it('leaves a missing value null instead of zero', () => {
    const r = mergeDisplacement({ items: [{ year: 2024, refugees: '-', idps: 10 }] }, {}, {});
    expect(r[0].refugeesAbroad).toBeNull();
    expect(r[0].idpsIdmc).toBeNull();
    expect(r[0].idpsUnhcr).toBe(10);
  });
});

describe('EONET', () => {
  it('places each event at a finite coordinate with a source link', () => {
    const e = parseEonet(eonet);
    expect(e.length).toBeGreaterThan(0);
    for (const x of e) {
      expect(Number.isFinite(x.lon) && Number.isFinite(x.lat)).toBe(true);
      expect(x.url).toMatch(/^https?:\/\//);
    }
  });
  it('skips events with no usable geometry', () => {
    expect(parseEonet({ events: [{ id: 'x', geometry: [] }, { id: 'y', geometry: [{ type: 'Polygon', coordinates: [] }] }] })).toEqual([]);
  });
});

describe('river discharge', () => {
  it('reads today, the trailing week and the forecast peak', () => {
    const time = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const river_discharge = [100, 100, 100, 100, 100, 100, 100, 130, 140, 160, 150, 120];
    const [r] = parseFlood({ daily: { time, river_discharge } });
    expect(r.name).toBe(RIVER_SITES[0].name);
    expect(r.weekMean).toBe(100);
    expect(r.today).toBe(130);
    expect(r.ratio).toBeCloseTo(1.3);
    expect(r.forecastPeak).toBe(160);
    expect(r.forecastPeakDate).toBe('2026-11-10');
  });
  it('has no ratio without a baseline, and parses a real response', () => {
    expect(parseFlood({ daily: { time: [], river_discharge: [] } })[0].ratio).toBeNull();
    expect(parseFlood(flood)[0].series.length).toBeGreaterThan(0);
  });
});

describe('humanitarian funding', () => {
  it('pairs this year’s plan with reported funding', () => {
    const f = parseFunding(flow, plans, 2026);
    expect(f.required).toBe(2132641156);
    expect(f.funded).toBe(1217361365);
    expect(f.coverage).toBeCloseTo(0.5708, 3);
    expect(f.donors[0].amount).toBeGreaterThanOrEqual(f.donors[1].amount);
  });
  it('reports no coverage when no plan covers the year', () => {
    const f = parseFunding(flow, plans, 2031);
    expect(f.required).toBeNull();
    expect(f.coverage).toBeNull();
  });
});

describe('satellite layers', () => {
  it('requests yesterday’s image, by date, in the layer’s own matrix', () => {
    const now = new Date('2026-11-12T03:00:00Z');
    expect(gibsYesterday(now)).toBe('2026-11-11');
    const u = gibsTileUrl(SAT_LAYERS[0], now);
    expect(u).toContain('/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-11-11/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg');
  });
});

describe('unclassified reports', () => {
  it('are not counted as conflict', () => {
    expect(categoryOf({ event_type: 'unknown' } as never)).toBe('other');
  });
});

import { insideRings } from '@/lib/live/opendata';

describe('national boundary filter', () => {
  const square = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
  it('keeps points inside and drops points outside', () => {
    expect(insideRings(5, 5, square)).toBe(true);
    expect(insideRings(15, 5, square)).toBe(false);
    expect(insideRings(5, -1, square)).toBe(false);
  });
  it('works against the real DRC outline', async () => {
    const fs = await import('node:fs');
    const fc = JSON.parse(fs.readFileSync('public/geo/cod-adm0.json', 'utf8'));
    const rings = fc.features.flatMap((f: { geometry: { coordinates: number[][][][] } }) => f.geometry.coordinates.map((p) => p[0]));
    expect(insideRings(29.22, -1.68, rings)).toBe(true);    // Goma
    expect(insideRings(15.31, -4.32, rings)).toBe(true);    // Kinshasa
    expect(insideRings(30.06, -1.95, rings)).toBe(false);   // Kigali
    expect(insideRings(13.23, -8.84, rings)).toBe(false);   // Luanda
  });
});
