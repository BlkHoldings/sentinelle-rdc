import { runSimulation } from '../src/lib/policy-engine';
import type { SimulationInput } from '../src/lib/policy-engine';

const BASE: SimulationInput = {
  shockType: 'trade_war',
  originSector: 'trade',
  affectedRegions: ['north_america', 'europe'],
  intensity: 75,
  horizon: 24,
};

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('produces identical output for identical input', () => {
    expect(runSimulation(BASE)).toEqual(runSimulation(BASE));
  });

  it('is stable across 100 calls', () => {
    const reference = runSimulation(BASE);
    for (let i = 0; i < 99; i++) {
      expect(runSimulation(BASE)).toEqual(reference);
    }
  });
});

// ── Bounds ────────────────────────────────────────────────────────────────────

describe('bounds', () => {
  const cases: SimulationInput[] = [
    BASE,
    { shockType: 'pandemic',      originSector: 'healthcare',    affectedRegions: ['europe', 'asia_pacific', 'africa'],                        intensity: 100, horizon: 60 },
    { shockType: 'cyber_attack',  originSector: 'technology',    affectedRegions: ['north_america'],                                           intensity: 30,  horizon: 6  },
    { shockType: 'energy_shock',  originSector: 'energy',        affectedRegions: ['middle_east', 'europe', 'asia_pacific', 'north_america'],   intensity: 90,  horizon: 36 },
    { shockType: 'currency_crisis', originSector: 'finance',     affectedRegions: ['latin_america', 'africa'],                                 intensity: 55,  horizon: 18 },
    { shockType: 'climate',       originSector: 'agriculture',   affectedRegions: ['africa', 'south_asia', 'latin_america', 'middle_east'],     intensity: 85,  horizon: 48 },
  ];

  test.each(cases)('all values in [0,100] — %#', (input) => {
    const out = runSimulation(input);
    expect(out.disruptionScore).toBeGreaterThanOrEqual(0);
    expect(out.disruptionScore).toBeLessThanOrEqual(100);
    for (const s of out.sectorImpacts) {
      expect(s.firstOrder).toBeGreaterThanOrEqual(0);
      expect(s.firstOrder).toBeLessThanOrEqual(100);
      expect(s.secondOrder).toBeGreaterThanOrEqual(0);
      expect(s.secondOrder).toBeLessThanOrEqual(100);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
    }
    for (const t of out.timeline) {
      expect(t.disruption).toBeGreaterThanOrEqual(0);
      expect(t.disruption).toBeLessThanOrEqual(100);
    }
  });

  test.each(cases)('timeline length equals horizon — %#', (input) => {
    const out = runSimulation(input);
    expect(out.timeline).toHaveLength(input.horizon);
  });

  test.each(cases)('sectorImpacts covers all 8 sectors — %#', (input) => {
    const out = runSimulation(input);
    expect(out.sectorImpacts).toHaveLength(8);
  });
});

// ── Realism ───────────────────────────────────────────────────────────────────

describe('realism', () => {
  it('higher intensity → higher disruption score', () => {
    const low  = runSimulation({ ...BASE, intensity: 20 });
    const high = runSimulation({ ...BASE, intensity: 80 });
    expect(high.disruptionScore).toBeGreaterThan(low.disruptionScore);
  });

  it('more regions → higher disruption score', () => {
    const few  = runSimulation({ ...BASE, affectedRegions: ['north_america'] });
    const many = runSimulation({ ...BASE, affectedRegions: ['north_america', 'europe', 'asia_pacific', 'africa'] });
    expect(many.disruptionScore).toBeGreaterThan(few.disruptionScore);
  });

  it('origin sector is the hardest-hit sector', () => {
    const out = runSimulation(BASE);
    const originTotal = out.sectorImpacts.find(s => s.sector === BASE.originSector)!.total;
    const otherMax = Math.max(...out.sectorImpacts.filter(s => s.sector !== BASE.originSector).map(s => s.total));
    expect(originTotal).toBeGreaterThanOrEqual(otherMax);
  });

  it('second-order effects are weaker than first-order', () => {
    const out = runSimulation(BASE);
    const firstOrder = out.sectorImpacts.find(s => s.sector === BASE.originSector)!.firstOrder;
    const secondOrders = out.sectorImpacts.filter(s => s.sector !== BASE.originSector).map(s => s.secondOrder);
    for (const so of secondOrders) {
      expect(so).toBeLessThanOrEqual(firstOrder);
    }
  });

  it('timeline rises then recovers', () => {
    const out = runSimulation(BASE);
    const peakIdx = out.timeline.reduce((mi, p, i, arr) => p.disruption > arr[mi].disruption ? i : mi, 0);
    expect(out.timeline[peakIdx].month).toBeLessThan(BASE.horizon);
    const afterPeak = out.timeline.slice(peakIdx);
    if (afterPeak.length > 2) {
      expect(afterPeak[afterPeak.length - 1].disruption).toBeLessThan(afterPeak[0].disruption);
    }
  });

  it('risk level bands match disruption score', () => {
    const bands: Array<[number, string]> = [[10, 'low'], [40, 'moderate'], [65, 'high'], [90, 'critical']];
    for (const [intensity, _] of bands) {
      const out = runSimulation({ ...BASE, intensity, affectedRegions: ['north_america', 'europe', 'asia_pacific', 'middle_east'] });
      const score = out.disruptionScore;
      const level = out.riskLevel;
      if (score < 25)       expect(level).toBe('low');
      else if (score < 50)  expect(level).toBe('moderate');
      else if (score < 75)  expect(level).toBe('high');
      else                  expect(level).toBe('critical');
    }
  });
});
