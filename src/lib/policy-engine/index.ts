// Public contract — the app imports ONLY from here, never from engine internals.
export { runSimulation } from './engine';
export type {
  SimulationInput,
  SimulationOutput,
  SectorImpact,
  TimelinePoint,
  RiskLevel,
  ShockType,
  Sector,
  Region,
} from './types';
