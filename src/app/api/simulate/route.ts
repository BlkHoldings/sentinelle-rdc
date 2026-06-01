import { NextRequest, NextResponse } from 'next/server';
import { runSimulation } from '@/lib/policy-engine';
import type { SimulationInput } from '@/lib/policy-engine';

const VALID_SHOCKS = new Set([
  'trade_war', 'pandemic', 'conflict', 'climate',
  'cyber_attack', 'currency_crisis', 'energy_shock',
]);
const VALID_SECTORS = new Set([
  'energy', 'finance', 'agriculture', 'manufacturing',
  'technology', 'healthcare', 'transport', 'trade',
]);
const VALID_REGIONS = new Set([
  'north_america', 'europe', 'asia_pacific', 'middle_east',
  'africa', 'latin_america', 'south_asia',
]);

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const b = body as Record<string, unknown>;

  if (!VALID_SHOCKS.has(b.shockType as string))
    return err('Invalid or missing shockType');
  if (!VALID_SECTORS.has(b.originSector as string))
    return err('Invalid or missing originSector');
  if (!Array.isArray(b.affectedRegions) || b.affectedRegions.length === 0)
    return err('affectedRegions must be a non-empty array');
  if (b.affectedRegions.some((r: unknown) => !VALID_REGIONS.has(r as string)))
    return err('affectedRegions contains an invalid region');
  if (typeof b.intensity !== 'number' || b.intensity < 0 || b.intensity > 100)
    return err('intensity must be a number in [0, 100]');
  if (typeof b.horizon !== 'number' || b.horizon < 1 || b.horizon > 60)
    return err('horizon must be a number in [1, 60]');

  const output = runSimulation(b as unknown as SimulationInput);
  return NextResponse.json(output);
}
