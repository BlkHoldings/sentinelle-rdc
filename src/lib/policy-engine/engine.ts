import type {
  SimulationInput,
  SimulationOutput,
  SectorImpact,
  TimelinePoint,
  RiskLevel,
  Sector,
} from './types';
import {
  SHOCK_SEVERITY,
  SECTOR_VULNERABILITY,
  IO_LINKAGE,
  BREADTH_BASE,
  BREADTH_PER_REGION,
  SPILLOVER_DAMPEN,
  SYSTEMIC_FACTOR,
  LOGISTIC_PEAK_FRACTION,
  RECOVERY_RATE,
} from './coefficients';

const SECTORS: Sector[] = [
  'energy', 'finance', 'agriculture', 'manufacturing',
  'technology', 'healthcare', 'transport', 'trade',
];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// Standard logistic, domain [0,1] → output near 0 at t=0, near 1 at t=1
function logistic(t: number): number {
  return 1 / (1 + Math.exp(-10 * (t - 0.5)));
}

function getRiskLevel(score: number): RiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'high';
  return 'critical';
}

export function runSimulation(input: SimulationInput): SimulationOutput {
  const { shockType, originSector, affectedRegions, intensity, horizon } = input;

  // 1. Breadth from regional spread
  const breadth = clamp(BREADTH_BASE + affectedRegions.length * BREADTH_PER_REGION, 0, 1);

  // 2. First-order hit on origin sector (normalised 0–1 before ×100)
  const severity = SHOCK_SEVERITY[shockType];
  const vulnerability = SECTOR_VULNERABILITY[originSector][shockType];
  const firstOrderNorm = severity * vulnerability * breadth * (intensity / 100);
  const firstOrderScore = clamp(firstOrderNorm * 100, 0, 100);

  // 3. Damped spillover to linked sectors via IO matrix
  const sectorImpacts: SectorImpact[] = SECTORS.map((sector): SectorImpact => {
    if (sector === originSector) {
      return { sector, firstOrder: round1(firstOrderScore), secondOrder: 0, total: round1(firstOrderScore) };
    }
    const linkage = IO_LINKAGE[originSector][sector];
    const secondOrderScore = clamp(firstOrderNorm * linkage * SPILLOVER_DAMPEN * 100, 0, 100);
    return { sector, firstOrder: 0, secondOrder: round1(secondOrderScore), total: round1(secondOrderScore) };
  });

  // 4. Headline score: first-order hit scaled up by average inter-sector linkage
  const nonSelfLinkages = SECTORS
    .filter(s => s !== originSector)
    .map(s => IO_LINKAGE[originSector][s]);
  const avgLinkage = nonSelfLinkages.reduce((a, b) => a + b, 0) / nonSelfLinkages.length;
  const systemicAmp = avgLinkage * SPILLOVER_DAMPEN * SYSTEMIC_FACTOR;
  const disruptionScore = round1(clamp(firstOrderScore * (1 + systemicAmp), 0, 100));

  // 5. Logistic rise then exponential recovery timeline
  const peakMonth = Math.max(1, Math.floor(horizon * LOGISTIC_PEAK_FRACTION));
  const timeline: TimelinePoint[] = [];
  for (let month = 1; month <= horizon; month++) {
    let disruption: number;
    if (month <= peakMonth) {
      const t = month / peakMonth;
      disruption = disruptionScore * logistic(t);
    } else {
      const t = (month - peakMonth) / Math.max(1, horizon - peakMonth);
      disruption = disruptionScore * Math.exp(-RECOVERY_RATE * t);
    }
    timeline.push({ month, disruption: round1(clamp(disruption, 0, 100)) });
  }

  const riskLevel = getRiskLevel(disruptionScore);
  const worstSector = sectorImpacts.reduce((a, b) => (a.total > b.total ? a : b));
  const summary =
    `A ${shockType.replace(/_/g, ' ')} originating in ${originSector} ` +
    `with ${intensity}% intensity across ${affectedRegions.length} region(s) ` +
    `produces a disruption score of ${disruptionScore}/100 (${riskLevel} risk). ` +
    `Hardest-hit sector: ${worstSector.sector} (${worstSector.total}/100).`;

  return { disruptionScore, sectorImpacts, timeline, riskLevel, summary };
}
