import { describe, it, expect } from 'vitest';
import {
  validateRecord, validateSource, filterRecords, attentionIndex, standingLabel,
  summariseEntities, blankRecord, blankSource, type StrategicRecord, type SourceRef,
} from '@/lib/strategic/model';
import { buildBrief, retrieve, tokenize } from '@/lib/strategic/synthesis';
import { canApprove, type Report } from '@/store/useStrategicStore';
import { clusterPoints, CLUSTER_MAX_ZOOM } from '@/lib/cluster';

const src = (over: Partial<SourceRef> = {}): SourceRef => ({
  ...blankSource('2026-11-01'), title: 'Rapport annuel', publisher: 'Ministère',
  url: 'https://example.org/rapport.pdf', published: '2026-10-01', access: 'Publication ouverte', ...over,
});

const rec = (over: Partial<StrategicRecord> = {}): StrategicRecord => ({
  ...blankRecord('TEST'), title: 'Capacité du corridor ferroviaire', country: 'RD Congo', region: 'Lualaba',
  sector: 'Mines', summary: 'Résumé suffisamment long pour être valide.', ...over,
});

describe('record validation', () => {
  it('accepts a well-formed draft with no sources', () => {
    expect(validateRecord(rec())).toEqual({});
  });

  it('rejects a short title and a short summary', () => {
    const e = validateRecord(rec({ title: 'Court', summary: 'bref' }));
    expect(e.title).toBeDefined();
    expect(e.summary).toBeDefined();
  });

  it('refuses review or verification without any source', () => {
    expect(validateRecord(rec({ status: 'in_review' })).status).toBeDefined();
    expect(validateRecord(rec({ status: 'verified' })).status).toBeDefined();
    expect(validateRecord(rec({ status: 'verified', sources: [src()] })).status).toBeUndefined();
  });

  it('requires two sources for high confidence', () => {
    expect(validateRecord(rec({ confidence: 'high', sources: [src()] })).confidence).toBeDefined();
    expect(validateRecord(rec({ confidence: 'high', sources: [src(), src({ id: 's2' })] })).confidence).toBeUndefined();
  });

  it('requires latitude and longitude together, within bounds', () => {
    expect(validateRecord(rec({ lat: -4 })).coords).toBeDefined();
    expect(validateRecord(rec({ lat: -94, lon: 20 })).coords).toBeDefined();
    expect(validateRecord(rec({ lat: -4, lon: 20 })).coords).toBeUndefined();
  });

  it('reports source errors under an indexed key', () => {
    const e = validateRecord(rec({ sources: [src({ title: '' })] }));
    expect(e['sources.0.title']).toBeDefined();
  });
});

describe('source validation', () => {
  const today = '2026-11-12';
  it('accepts a document reference in place of a URL', () => {
    expect(validateSource(src({ url: 'Archives nationales, cote 12-B' }), today)).toEqual({});
  });
  it('rejects non-http schemes that would render as a clickable link', () => {
    expect(validateSource(src({ url: 'javascript:alert(1)' }), today).url).toBeDefined();
    expect(validateSource(src({ url: 'data:text/html,x' }), today).url).toBeDefined();
  });
  it('rejects impossible and future dates', () => {
    expect(validateSource(src({ published: '2026-02-31' }), today).published).toBeDefined();
    expect(validateSource(src({ published: '2027-01-01' }), today).published).toBeDefined();
    expect(validateSource(src({ retrieved: '' }), today).retrieved).toBeDefined();
  });
  it('rejects retrieval before publication', () => {
    expect(validateSource(src({ published: '2026-10-01', retrieved: '2026-09-01' }), today).retrieved).toBeDefined();
  });
});

describe('filtering', () => {
  const rs = [
    rec({ id: 'a', title: 'Corridor solaire du Kongo Central', sector: 'Énergie', region: 'Kongo Central' }),
    rec({ id: 'b', title: 'Logistique cuivre-cobalt', sector: 'Mines', entities: ['Chaîne du cuivre'] }),
    rec({ id: 'c', title: 'Ancien dossier douanier', sector: 'Commerce', status: 'archived' }),
  ];
  it('hides the archive by default and shows it on request', () => {
    expect(filterRecords(rs, {}).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterRecords(rs, { status: 'all' })).toHaveLength(3);
    expect(filterRecords(rs, { status: 'archived' }).map((r) => r.id)).toEqual(['c']);
  });
  it('filters by sector', () => {
    expect(filterRecords(rs, { sector: 'Mines' }).map((r) => r.id)).toEqual(['b']);
  });
  it('ignores accents and case', () => {
    expect(filterRecords(rs, { query: 'ENERGIE' }).map((r) => r.id)).toEqual(['a']);
  });
  it('requires every term to match, and searches entities', () => {
    expect(filterRecords(rs, { query: 'cuivre chaine' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRecords(rs, { query: 'cuivre solaire' })).toEqual([]);
  });
});

describe('confidence display', () => {
  it('always names confidence, status and source count together', () => {
    expect(standingLabel(rec({ confidence: 'high', status: 'draft' })))
      .toBe('Confiance élevée · brouillon · aucune source');
    expect(standingLabel(rec({ confidence: 'low', status: 'verified', sources: [src(), src({ id: 'x' })] })))
      .toBe('Confiance faible · vérifié · 2 sources');
  });
});

describe('attention index', () => {
  const now = new Date('2026-11-12T00:00:00Z').getTime();
  const fresh = '2026-11-10T00:00:00Z';
  it('scores an unsourced draft above a verified, corroborated record', () => {
    const weak = attentionIndex(rec({ updatedAt: fresh }), now);
    const strong = attentionIndex(rec({
      updatedAt: fresh, status: 'verified', confidence: 'high', sources: [src(), src({ id: 'y' })],
    }), now);
    expect(weak.score).toBeGreaterThan(strong.score);
    expect(strong.score).toBe(0);
  });
  it('is the sum of its stated factors, capped at 100', () => {
    const a = attentionIndex(rec({ updatedAt: '2025-01-01T00:00:00Z', status: 'disputed', illustrative: true }), now);
    expect(a.score).toBe(Math.min(100, a.factors.reduce((s, f) => s + f.points, 0)));
    expect(a.score).toBeLessThanOrEqual(100);
  });
  it('scores archived records at zero', () => {
    expect(attentionIndex(rec({ status: 'archived' }), now).score).toBe(0);
  });
});

describe('entities', () => {
  it('links entities that share a record and skips the archive', () => {
    const es = summariseEntities([
      rec({ id: '1', entities: ['Réseau', 'Corridor'] }),
      rec({ id: '2', entities: ['Réseau'] }),
      rec({ id: '3', entities: ['Fantôme'], status: 'archived' }),
    ]);
    expect(es.map((e) => e.name)).toEqual(['Réseau', 'Corridor']);
    expect(es[0].records).toHaveLength(2);
    expect(es[0].linked).toEqual([{ name: 'Corridor', shared: 1 }]);
  });
});

describe('workbench', () => {
  const sourced = rec({ id: 's', title: 'Logistique du cuivre au Lualaba', sources: [src()], confidence: 'medium' });
  const seed = rec({ id: 'i', title: 'Cuivre : exemple', illustrative: true });

  it('drops stop words and short tokens', () => {
    expect(tokenize('Quelles sont les contraintes sur le cuivre ?')).toEqual(['contraintes', 'cuivre']);
  });
  it('ranks title matches above summary matches and never returns the archive', () => {
    const inBody = rec({ id: 'b', title: 'Autre sujet entièrement', summary: 'Mention passagère du cuivre dans le texte.' });
    const gone = rec({ id: 'g', title: 'Cuivre archivé', status: 'archived' });
    expect(retrieve('cuivre', [inBody, sourced, gone]).map((h) => h.record.id)).toEqual(['s', 'b']);
  });
  it('says so when nothing matches, and offers no findings', () => {
    const b = buildBrief('hydrogène vert en Namibie', [sourced]);
    expect(b.sufficient).toBe(false);
    expect(b.findings).toEqual([]);
    expect(b.confidence.level).toBe('none');
  });
  it('does not treat illustrative or unsourced records as evidence', () => {
    const b = buildBrief('cuivre', [seed]);
    expect(b.sufficient).toBe(false);
    expect(b.confidence.level).toBe('none');
    expect(b.limitations.join(' ')).toMatch(/illustratif/);
  });
  it('caps confidence below high when nothing is verified', () => {
    const hi = rec({ id: 'h', title: 'Cuivre : étude', confidence: 'high', sources: [src(), src({ id: 'z' })] });
    expect(buildBrief('cuivre', [hi]).confidence.level).toBe('medium');
    expect(buildBrief('cuivre', [{ ...hi, status: 'verified' }]).confidence.level).toBe('high');
  });
  it('cites only records that exist, and always states it is rule-built', () => {
    const b = buildBrief('cuivre Lualaba', [sourced, seed]);
    const ids = new Set(['s', 'i']);
    expect(b.findings.every((f) => ids.has(f.recordId))).toBe(true);
    expect(b.limitations[0]).toMatch(/aucun modèle de langage/);
  });
});

describe('report approval', () => {
  const report = (state: Report['state'], author = 'ALICE'): Report => ({
    id: 'r', title: 't', state, recordIds: [],
    versions: [{ n: 1, body: '', at: '', author, note: '' }],
  });
  it('refuses the author, the analyst role, and anything not in review', () => {
    expect(canApprove(report('in_review'), 'ALICE', 'operator').ok).toBe(false);
    expect(canApprove(report('in_review'), 'BOB', 'analyst').ok).toBe(false);
    expect(canApprove(report('draft'), 'BOB', 'operator').ok).toBe(false);
    expect(canApprove(report('in_review'), 'BOB', 'operator').ok).toBe(true);
  });
});

describe('map clustering', () => {
  const pts = [{ lon: 29.22, lat: -1.68 }, { lon: 29.23, lat: -1.67 }, { lon: 15.3, lat: -4.3 }];
  it('merges near points at theatre zoom and keeps distant ones apart', () => {
    const c = clusterPoints(pts, 5);
    expect(c.map((x) => x.members.length).sort()).toEqual([1, 2]);
  });
  it('never merges past the maximum cluster zoom', () => {
    expect(clusterPoints(pts, CLUSTER_MAX_ZOOM)).toHaveLength(3);
  });
  it('loses no point', () => {
    for (const z of [3, 5, 7, 9]) {
      expect(clusterPoints(pts, z).reduce((a, c) => a + c.members.length, 0)).toBe(3);
    }
  });
});
