export type ShockType =
  | 'trade_war'
  | 'pandemic'
  | 'conflict'
  | 'climate'
  | 'cyber_attack'
  | 'currency_crisis'
  | 'energy_shock';

export type Sector =
  | 'energy'
  | 'finance'
  | 'agriculture'
  | 'manufacturing'
  | 'technology'
  | 'healthcare'
  | 'transport'
  | 'trade';

export type Region =
  | 'north_america'
  | 'europe'
  | 'asia_pacific'
  | 'middle_east'
  | 'africa'
  | 'latin_america'
  | 'south_asia';

export interface SimulationInput {
  shockType: ShockType;
  originSector: Sector;
  affectedRegions: Region[];
  intensity: number; // 0–100
  horizon: number;   // months, 1–60
}

export interface SectorImpact {
  sector: Sector;
  firstOrder: number;  // 0–100, non-zero only for origin sector
  secondOrder: number; // 0–100, non-zero only for linked sectors
  total: number;       // 0–100
}

export interface TimelinePoint {
  month: number;
  disruption: number; // 0–100
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface SimulationOutput {
  disruptionScore: number; // 0–100
  sectorImpacts: SectorImpact[];
  timeline: TimelinePoint[];
  riskLevel: RiskLevel;
  summary: string;
}
