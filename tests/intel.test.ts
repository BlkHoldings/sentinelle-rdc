import { describe, it, expect } from 'vitest';
import type { FusedEvent, ProvenanceEntry, EventType, EventStatus } from '@/lib/fusion/schema';
import {
  originOf, isSimulatedSource, categoryOf, filterFeed, dailySeries, weeklySeries, tallyBy,
  situation, firstPublished, lastUpdated, familyMix, provinceOf, ago,
} from '@/lib/intel/derive';
import { needsTriage } from '@/lib/intel/triage';
import { relatedEvents } from '@/lib/strategic/synthesis';
import { DICTS, translate } from '@/lib/i18n';

const NOW = new Date('2026-11-12T12:00:00Z').getTime();
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

const prov = (id: string, over: Partial<ProvenanceEntry['source']> = {}): ProvenanceEntry => ({
  source: {
    type: 'radio_okapi', family: 'broadcast', id, grade: 'B', credibility: 2, prior: 0.8,
    published_at: iso(5), ingested_at: iso(4), ...over,
  },
  raw_text: 't', report_confidence: 0.7, agreement: 'agree',
});

let n = 0;
const ev = (over: Partial<FusedEvent> & { hoursAgo?: number; type?: EventType; province?: string } = {}): FusedEvent => {
  const p = over.provenance ?? [prov(`real-${++n}`)];
  return {
    event_id: `e${++n}`, block_key: 'k', timestamp: iso(over.hoursAgo ?? 2), time_uncertainty_min: 60,
    location: { lat: -1.6, lon: 29.2, place_name: 'Goma', radius_km: 4, method: 'gazetteer' },
    event_type: over.type ?? 'armed_clash', event_type_alts: [], actors: ['M23'], description: 'Affrontement à Goma',
    casualties: {}, source: p[0].source, raw_text: '', confidence: 0.6, confidence_factors: [],
    status: 'unverified' as EventStatus, independent_sources: 1, provenance: p,
    geo: { admin: { province: over.province ?? 'Nord-Kivu' } }, priority: 40, adjudications: [],
    ...over,
  };
};

describe('provenance origin', () => {
  it('recognises the demonstration stream and synthetic telemetry', () => {
    expect(isSimulatedSource(prov('syn-abc'))).toBe(true);
    expect(isSimulatedSource(prov('telecom:Ituri:2026'))).toBe(true);
    expect(isSimulatedSource(prov('acled:2026-07-05'))).toBe(false);
  });
  it('labels an event simulated, mixed or collected', () => {
    expect(originOf(ev({ provenance: [prov('syn-1'), prov('syn-2')] }))).toBe('simulated');
    expect(originOf(ev({ provenance: [prov('syn-1'), prov('acled:x')] }))).toBe('mixed');
    expect(originOf(ev({ provenance: [prov('acled:x')] }))).toBe('collected');
  });
});

describe('feed filtering', () => {
  const list = [
    ev({ hoursAgo: 1 }),
    ev({ hoursAgo: 30, type: 'displacement', province: 'Ituri' }),
    ev({ hoursAgo: 200, type: 'protest' }),
    ev({ hoursAgo: 1, status: 'merged' }),
    ev({ hoursAgo: 1, status: 'rejected' }),
    ev({ hoursAgo: 3, provenance: [prov('syn-9')] }),
  ];
  it('drops merged and rejected events and sorts newest first', () => {
    const out = filterFeed(list, { range: 'all' }, NOW);
    expect(out).toHaveLength(4);
    expect(out.map((e) => e.timestamp)).toEqual([...out.map((e) => e.timestamp)].sort().reverse());
  });
  it('applies the time window', () => {
    expect(filterFeed(list, { range: '24h' }, NOW)).toHaveLength(2);
    expect(filterFeed(list, { range: '72h' }, NOW)).toHaveLength(3);
  });
  it('filters by category, province and status', () => {
    expect(filterFeed(list, { range: 'all', category: 'humanitarian' }, NOW)).toHaveLength(1);
    expect(filterFeed(list, { range: 'all', category: 'political' }, NOW)).toHaveLength(1);
    expect(filterFeed(list, { range: 'all', province: 'Ituri' }, NOW)).toHaveLength(1);
    expect(filterFeed(list, { range: 'all', status: 'confirmed' }, NOW)).toHaveLength(0);
  });
  it('can hide events built only from the simulated stream', () => {
    expect(filterFeed(list, { range: 'all', hideSimulated: true }, NOW)).toHaveLength(3);
  });
  it('searches place, province and actors without accents', () => {
    expect(filterFeed(list, { range: 'all', query: 'ITURI' }, NOW)).toHaveLength(1);
    expect(filterFeed(list, { range: 'all', query: 'm23 goma' }, NOW)).toHaveLength(4);
    expect(filterFeed(list, { range: 'all', query: 'kinshasa' }, NOW)).toHaveLength(0);
  });
});

describe('series', () => {
  it('keeps empty days and excludes sensor telemetry', () => {
    const s = dailySeries([ev({ hoursAgo: 2 }), ev({ hoursAgo: 50 }), ev({ hoursAgo: 2, type: 'thermal_anomaly' })], 5, NOW);
    expect(s).toHaveLength(5);
    expect(s.map((d) => d.total)).toEqual([0, 0, 1, 0, 1]);
    expect(s[4].conflict).toBe(1);
  });
  it('sums days into weeks without losing any', () => {
    const daily = dailySeries([ev({ hoursAgo: 2 }), ev({ hoursAgo: 24 * 9 })], 14, NOW);
    const weekly = weeklySeries(daily);
    expect(weekly).toHaveLength(2);
    expect(weekly.reduce((a, w) => a + w.total, 0)).toBe(2);
  });
  it('tallies by key with fatalities and corroboration', () => {
    const t = tallyBy([
      ev({ casualties: { fatalities: 3 }, status: 'confirmed' }), ev({ casualties: { fatalities: 2 } }), ev({ province: 'Ituri' }),
    ], provinceOf);
    expect(t[0]).toEqual({ key: 'Nord-Kivu', count: 2, fatalities: 5, confirmed: 1 });
    expect(t[1].key).toBe('Ituri');
  });
});

describe('situation indicators', () => {
  it('reports no change figure when there is no earlier baseline', () => {
    const s = situation([ev({ hoursAgo: 2 })], '24h', NOW);
    expect(s.total).toBe(1);
    expect(s.changePct).toBeNull();
  });
  it('compares against the preceding window of equal length', () => {
    const s = situation([ev({ hoursAgo: 2 }), ev({ hoursAgo: 3 }), ev({ hoursAgo: 30 })], '24h', NOW);
    expect(s.changePct).toBe(100);
  });
  it('has no corroborated share on an empty window, rather than 0 %', () => {
    expect(situation([], '7d', NOW).corroboratedShare).toBeNull();
  });
  it('counts simulated events and sums reported displacement', () => {
    const s = situation([
      ev({ provenance: [prov('syn-1')], casualties: { displaced: 500 }, type: 'displacement' }),
      ev({ status: 'corroborated' }),
    ], '7d', NOW);
    expect(s.simulated).toBe(1);
    expect(s.displaced).toBe(500);
    expect(s.humanitarian).toBe(1);
    expect(s.corroboratedShare).toBe(0.5);
  });
});

describe('timestamps', () => {
  it('takes the earliest publication and the latest update', () => {
    const e = ev({
      provenance: [
        prov('a', { published_at: iso(10), ingested_at: iso(9) }),
        prov('b', { published_at: iso(20), ingested_at: iso(1) }),
      ],
      adjudications: [{ analyst: 'X', action: 'edit', at: iso(0.5), notes: 'n' }],
    });
    expect(firstPublished(e)).toBe(iso(20));
    expect(lastUpdated(e)).toBe(iso(0.5));
  });
  it('formats relative time in both languages', () => {
    expect(ago(iso(3), 'fr', NOW)).toBe('il y a 3 h');
    expect(ago(iso(3), 'en', NOW)).toBe('3 h ago');
    expect(ago('nonsense', 'fr', NOW)).toBe('—');
  });
});

describe('source mix', () => {
  it('counts reports per family and how many were simulated', () => {
    const mix = familyMix([ev({ provenance: [prov('syn-1'), prov('real', { family: 'press' })] })]);
    expect(mix).toContainEqual({ family: 'broadcast', reports: 1, simulated: 1 });
    expect(mix).toContainEqual({ family: 'press', reports: 1, simulated: 0 });
  });
});

describe('triage', () => {
  it('keeps an annotated event in the queue: a note is not a decision', () => {
    const e = ev({ priority: 60 });
    expect(needsTriage(e)).toBe(true);
    expect(needsTriage({ ...e, adjudications: [{ analyst: 'X', action: 'edit', at: iso(0), notes: 'n' }] })).toBe(true);
    expect(needsTriage({ ...e, adjudications: [{ analyst: 'X', action: 'confirm', at: iso(0) }] })).toBe(false);
  });
});

describe('assistant event context', () => {
  it('finds events by place and compares the last two weeks', () => {
    const ctx = relatedEvents('situation à Goma', [
      ev({ hoursAgo: 5 }), ev({ hoursAgo: 24 * 9 }), ev({ hoursAgo: 5, status: 'rejected' }),
      ev({ hoursAgo: 5, location: null, description: 'ailleurs', geo: { admin: { province: 'Ituri' } }, actors: [] }),
    ], NOW);
    expect(ctx.total).toBe(2);
    expect(ctx.recent).toBe(1);
    expect(ctx.previous).toBe(1);
  });
  it('returns nothing for a question with no usable term', () => {
    expect(relatedEvents('et le la', [ev()], NOW).total).toBe(0);
  });
});

describe('translations', () => {
  it('has the same keys in every language, none empty', () => {
    const fr = Object.keys(DICTS.fr).sort();
    for (const [lang, dict] of Object.entries(DICTS)) {
      expect(Object.keys(dict).sort(), lang).toEqual(fr);
      for (const [k, v] of Object.entries(dict)) expect(v.trim().length, `${lang}:${k}`).toBeGreaterThan(0);
    }
  });
  it('uses the same placeholders in every language', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(DICTS.fr) as (keyof typeof DICTS.fr)[]) {
      expect(vars(DICTS.en[k]), k).toBe(vars(DICTS.fr[k]));
    }
  });
  it('substitutes variables', () => {
    expect(translate('en', 'bar.sync.feeds', { up: 2, n: 4 })).toBe('2 of 4 feeds responding');
  });
});
