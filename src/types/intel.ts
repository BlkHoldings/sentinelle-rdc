/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Core Domain Types
   ═══════════════════════════════════════════════════════════ */

export type EventSource = 'acled' | 'firms' | 'drone' | 'cop';

export interface IntelEvent {
  src: EventSource;
  type: string;
  subtype?: string;
  date: string;
  time?: string;
  location?: string;
  admin1?: string;
  lat: number;
  lon: number;
  fatalities?: number;
  actor1?: string;
  actor2?: string;
  notes?: string;
  // Drone-specific
  platform?: string;
  status?: string;
  classification?: string;
  desc?: string;
  id?: string;
  alt?: string;
  base?: string;
  // FIRMS-specific
  brightness?: number;
  frp?: number;
  confidence?: string;
  daynight?: string;
  // Copernicus-specific
  name?: string;
}

export type ApiHealth = 'idle' | 'loading' | 'ok' | 'error';

export interface ApiStatus {
  firms: ApiHealth;
  copernicus: ApiHealth;
  acled: ApiHealth;
  drone: ApiHealth;
}

export interface MilPosition {
  n: string;     // name
  lt: number;    // latitude
  ln: number;    // longitude
  t: string;     // type: hq | arty | cp | log | camp | nav | idp
  s: string;     // tactical symbol
  c: string;     // colour (CSS custom property)
  d: string;     // description
}

export interface DroneRecord {
  id: string;
  time: string;
  type: string;
  platform: string;
  base: string;
  alt: string;
  lat: number;
  lon: number;
  desc: string;
  status: string;
  classification: string;
}

export type LayerKey = 'acled' | 'firms' | 'heat' | 'drone' | 'mil' | 'zone' | 'ref' | 'routes';

export interface LayerVisibility extends Record<LayerKey, boolean> {}

export interface UserSession {
  token: string;
  user: string;
  clearance: string;
  level: 'analyst' | 'operator' | 'commander';
  loginTime: string;
}

/** Parsed mouse/cursor position on the map */
export interface MapCoords {
  lat: number;
  lon: number;
  mgrs: string;
}
