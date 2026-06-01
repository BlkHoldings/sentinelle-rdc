import type { Sector, ShockType } from './types';

// Base severity of each shock type (0–1)
export const SHOCK_SEVERITY: Record<ShockType, number> = {
  trade_war:       0.70,
  pandemic:        0.90,
  conflict:        0.85,
  climate:         0.75,
  cyber_attack:    0.65,
  currency_crisis: 0.80,
  energy_shock:    0.85,
};

// How vulnerable each sector is to each shock type (0–1)
export const SECTOR_VULNERABILITY: Record<Sector, Record<ShockType, number>> = {
  energy: {
    trade_war: 0.60, pandemic: 0.50, conflict: 0.90,
    climate: 0.80, cyber_attack: 0.70, currency_crisis: 0.50, energy_shock: 1.00,
  },
  finance: {
    trade_war: 0.70, pandemic: 0.60, conflict: 0.60,
    climate: 0.40, cyber_attack: 0.80, currency_crisis: 1.00, energy_shock: 0.45,
  },
  agriculture: {
    trade_war: 0.65, pandemic: 0.70, conflict: 0.75,
    climate: 0.90, cyber_attack: 0.20, currency_crisis: 0.55, energy_shock: 0.60,
  },
  manufacturing: {
    trade_war: 0.80, pandemic: 0.75, conflict: 0.80,
    climate: 0.65, cyber_attack: 0.50, currency_crisis: 0.70, energy_shock: 0.75,
  },
  technology: {
    trade_war: 0.75, pandemic: 0.50, conflict: 0.55,
    climate: 0.40, cyber_attack: 0.90, currency_crisis: 0.65, energy_shock: 0.50,
  },
  healthcare: {
    trade_war: 0.40, pandemic: 0.95, conflict: 0.70,
    climate: 0.50, cyber_attack: 0.55, currency_crisis: 0.45, energy_shock: 0.40,
  },
  transport: {
    trade_war: 0.65, pandemic: 0.80, conflict: 0.85,
    climate: 0.70, cyber_attack: 0.45, currency_crisis: 0.60, energy_shock: 0.80,
  },
  trade: {
    trade_war: 0.90, pandemic: 0.75, conflict: 0.70,
    climate: 0.60, cyber_attack: 0.50, currency_crisis: 0.75, energy_shock: 0.55,
  },
};

// IO_LINKAGE[from][to] = fraction of 'from' shock that spills into 'to'
export const IO_LINKAGE: Record<Sector, Record<Sector, number>> = {
  energy: {
    energy: 1.00, finance: 0.40, agriculture: 0.50,
    manufacturing: 0.70, technology: 0.40, healthcare: 0.30, transport: 0.60, trade: 0.50,
  },
  finance: {
    energy: 0.30, finance: 1.00, agriculture: 0.40,
    manufacturing: 0.50, technology: 0.50, healthcare: 0.40, transport: 0.30, trade: 0.60,
  },
  agriculture: {
    energy: 0.10, finance: 0.20, agriculture: 1.00,
    manufacturing: 0.30, technology: 0.10, healthcare: 0.50, transport: 0.20, trade: 0.40,
  },
  manufacturing: {
    energy: 0.30, finance: 0.30, agriculture: 0.20,
    manufacturing: 1.00, technology: 0.40, healthcare: 0.20, transport: 0.40, trade: 0.50,
  },
  technology: {
    energy: 0.20, finance: 0.40, agriculture: 0.10,
    manufacturing: 0.50, technology: 1.00, healthcare: 0.30, transport: 0.20, trade: 0.30,
  },
  healthcare: {
    energy: 0.10, finance: 0.20, agriculture: 0.20,
    manufacturing: 0.10, technology: 0.20, healthcare: 1.00, transport: 0.10, trade: 0.10,
  },
  transport: {
    energy: 0.30, finance: 0.20, agriculture: 0.40,
    manufacturing: 0.50, technology: 0.20, healthcare: 0.10, transport: 1.00, trade: 0.60,
  },
  trade: {
    energy: 0.30, finance: 0.40, agriculture: 0.50,
    manufacturing: 0.50, technology: 0.30, healthcare: 0.20, transport: 0.50, trade: 1.00,
  },
};

// Breadth: base + per-region increment, clamped to [0, 1]
export const BREADTH_BASE = 0.40;
export const BREADTH_PER_REGION = 0.15;

// Second-order dampening: spillover is this fraction of the linkage-weighted hit
export const SPILLOVER_DAMPEN = 0.45;

// Systemic amplifier: how much average inter-sector linkage boosts the headline
export const SYSTEMIC_FACTOR = 0.50;

// Logistic timeline: peak occurs at this fraction of the horizon
export const LOGISTIC_PEAK_FRACTION = 0.30;

// Recovery: exponential decay rate after peak
export const RECOVERY_RATE = 0.70;
