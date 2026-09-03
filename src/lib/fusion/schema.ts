/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Unified Event Schema (Data Fusion Layer)
   ═══════════════════════════════════════════════════════════════════════

   Every source — ACLED, FIRMS, drone ISR, Radio Okapi, Actualité.cd,
   X/Twitter, Telegram, SMS field reports, radio transcripts, telecom
   telemetry — is normalised into a single `FusedEvent` before it touches
   the map, the triage queue, or a SITREP.

   Design notes vs. the reference spec
   ───────────────────────────────────
   • `event_id` is a ULID (time-sortable, collision-free), NOT an MD5 of
     content. Hashing timestamp|location|type as the identity makes two
     genuinely distinct events at the same place/minute/type collide and
     silently overwrite one another — a real risk in Kivu where several
     clashes occur in the same locality within an hour. The content hash
     is kept separately as `block_key` and used only for dedup blocking.
   • Confidence is a *derived* field. It is recomputed whenever the
     corroboration set changes, never mutated in place by a source.
   • `provenance` retains every contributing report so an analyst can
     always answer "who told us this, and when?" — a hard requirement for
     anything that ends up in a SITREP.
   ═══════════════════════════════════════════════════════════════════════ */

/** Source families. Reports from the same family are treated as
 *  statistically correlated during confidence fusion — 40 X accounts
 *  reposting one Radio Okapi bulletin is one source, not forty. */
export type SourceFamily =
  | 'wire'        // ACLED, ReliefWeb, OCHA — curated aggregators
  | 'broadcast'   // Radio Okapi, RTNC, community radio transcripts
  | 'press'       // Actualité.cd, 7sur7, Politico.cd
  | 'social'      // X/Twitter, Facebook, TikTok
  | 'messaging'   // Telegram/WhatsApp journalist channels
  | 'field'       // NGO/civil-society field reports, SMS gateway
  | 'sensor'      // FIRMS thermal, acoustic, telecom telemetry
  | 'imagery'     // Sentinel-1/2, commercial EO, UAS full-motion video
  | 'official';   // FARDC, MONUSCO, provincial government comms

export type SourceType =
  | 'acled' | 'reliefweb' | 'ocha'
  | 'radio_okapi' | 'rtnc' | 'community_radio'
  | 'actualite_cd' | '7sur7' | 'politico_cd'
  | 'twitter_verified' | 'twitter_unverified' | 'facebook'
  | 'telegram' | 'whatsapp'
  | 'ngo_field' | 'sms_gateway' | 'civil_society'
  | 'firms' | 'acoustic' | 'telecom'
  | 'sentinel' | 'uas_isr'
  | 'fardc' | 'monusco' | 'gov_provincial'
  | 'anonymous';

/** Canonical event taxonomy. Deliberately DRC-specific: `mine_incident`
 *  (artisanal mining site seizure) and `roadblock` (barrière / taxation
 *  illégale) are distinct conflict economies here, not generic "violence". */
export type EventType =
  | 'armed_clash'
  | 'shelling'
  | 'airstrike'
  | 'drone_strike'
  | 'ied'
  | 'abduction'
  | 'massacre'
  | 'sexual_violence'
  | 'looting'
  | 'arson'
  | 'displacement'
  | 'roadblock'
  | 'mine_incident'
  | 'protest'
  | 'arrest'
  | 'comms_blackout'
  | 'troop_movement'
  | 'humanitarian_access'
  | 'thermal_anomaly'
  | 'unknown';

export type EventStatus =
  | 'unverified'   // fresh out of the pipeline
  | 'corroborated' // ≥2 independent source families agree
  | 'confirmed'    // analyst-adjudicated true
  | 'disputed'     // sources materially disagree
  | 'rejected'     // analyst-adjudicated false / duplicate of another
  | 'merged';      // folded into another cluster

export interface GeoPoint {
  lat: number;
  lon: number;
  place_name: string;
  /** Positional uncertainty in km. A tweet saying "près de Goma" is not
   *  the same as a 10-digit MGRS grid from a UAS. Drives map halo radius. */
  radius_km: number;
  /** How the coordinate was obtained. */
  method: 'exact' | 'gazetteer' | 'admin_centroid' | 'inferred' | 'none';
}

export interface AdminContext {
  province?: string;
  territory?: string;
  /** Chefferie / secteur / ville — DRC admin level 3. */
  sector?: string;
}

export interface GeoEnrichment {
  admin: AdminContext;
  /** Persons per km², sampled from the WorldPop-derived grid. */
  population_density?: number;
  /** Estimated civilians inside the event's uncertainty radius. */
  population_at_risk?: number;
  nearest_hospital_km?: number;
  nearest_idp_site_km?: number;
  nearest_mining_site_km?: number;
  nearest_airstrip_km?: number;
  nearest_border_km?: number;
  /** Straight-line km to the nearest MONUSCO/FARDC position. */
  nearest_force_km?: number;
  /** Named road/axis the event sits on, e.g. "RN2 Goma–Rutshuru". */
  axis?: string;
  /** Terrain class drives both movement rate and ISR feasibility. */
  terrain?: 'urban' | 'agricultural' | 'forest' | 'highland' | 'lacustrine';
}

export interface SourceRef {
  type: SourceType;
  family: SourceFamily;
  /** Source-native identifier — tweet id, article URL, ACLED event id. */
  id: string;
  /** Publisher handle/outlet, for per-outlet reliability tracking. */
  handle?: string;
  url?: string;
  /** Admiralty source-reliability grade A–F at time of ingest. */
  grade: AdmiraltyReliability;
  /** Admiralty information-credibility grade 1–6 at time of ingest. */
  credibility: AdmiraltyCredibility;
  /** Prior P(report is true) for this source, from the Beta posterior. */
  prior: number;
  /** When the source published, not when we ingested. */
  published_at: string;
  ingested_at: string;
  language?: 'fr' | 'sw' | 'ln' | 'en' | 'unknown';
}

/* ── NATO Admiralty Code (STANAG 2511) ────────────────────────────────
   The reference spec used a flat dict of source→float. Admiralty is the
   doctrine actually used in this domain and separates two things the flat
   model conflates: how much you trust the *source* (A–F) versus how much
   this *particular report* hangs together (1–6). A completely reliable
   outlet can still relay an improbable rumour. */
export type AdmiraltyReliability = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type AdmiraltyCredibility = 1 | 2 | 3 | 4 | 5 | 6;

export const ADMIRALTY_RELIABILITY: Record<AdmiraltyReliability, { label: string; p: number }> = {
  A: { label: 'Complètement fiable', p: 0.95 },
  B: { label: 'Habituellement fiable', p: 0.80 },
  C: { label: 'Assez fiable', p: 0.65 },
  D: { label: 'Pas habituellement fiable', p: 0.40 },
  E: { label: 'Non fiable', p: 0.20 },
  F: { label: 'Fiabilité indéterminée', p: 0.50 },
};

export const ADMIRALTY_CREDIBILITY: Record<AdmiraltyCredibility, { label: string; p: number }> = {
  1: { label: 'Confirmé par d\'autres sources', p: 0.95 },
  2: { label: 'Probablement vrai', p: 0.80 },
  3: { label: 'Possiblement vrai', p: 0.65 },
  4: { label: 'Douteux', p: 0.40 },
  5: { label: 'Improbable', p: 0.20 },
  6: { label: 'Véracité indéterminée', p: 0.50 },
};

/** One contributing report inside a fused cluster. */
export interface ProvenanceEntry {
  source: SourceRef;
  raw_text: string;
  /** Excerpt the extractor actually keyed on, for explainability. */
  matched_span?: string;
  /** This report's individual likelihood before fusion. */
  report_confidence: number;
  /** Does this report agree with the cluster consensus on type + actors? */
  agreement: 'agree' | 'partial' | 'contradict';
}

export interface CasualtyEstimate {
  fatalities?: number;
  injured?: number;
  abducted?: number;
  displaced?: number;
  /** Sources rarely agree on counts; keep the spread, not just a mean. */
  fatalities_range?: [number, number];
}

/** Analyst adjudication trail — the human-in-the-loop record. */
export interface Adjudication {
  analyst: string;
  action: 'confirm' | 'reject' | 'merge' | 'edit' | 'escalate' | 'defer';
  at: string;
  notes?: string;
  merged_with?: string[];
}

export interface FusedEvent {
  /** ULID — time-sortable, globally unique. */
  event_id: string;
  /** Content hash over (time-bucket, geo-cell, type). Dedup blocking key
   *  only — never an identity. */
  block_key: string;

  timestamp: string;              // ISO 8601 UTC — when the event occurred
  /** Uncertainty of `timestamp` in minutes. "hier soir" ≈ ±180. */
  time_uncertainty_min: number;

  location: GeoPoint | null;
  event_type: EventType;
  /** Ranked alternates from the classifier, for analyst override. */
  event_type_alts: { type: EventType; score: number }[];

  actors: string[];
  /** Actor→role mapping where the text supports it. */
  actor_roles?: { actor: string; role: 'perpetrator' | 'target' | 'responder' | 'unclear' }[];

  description: string;
  casualties: CasualtyEstimate;

  /** Primary source (highest-graded contributor). */
  source: SourceRef;
  raw_text: string;

  /** Fused posterior probability the event is real, as reported. 0–1. */
  confidence: number;
  /** Human-readable breakdown of how `confidence` was reached. */
  confidence_factors: ConfidenceFactor[];

  status: EventStatus;
  /** Count of *independent source families* backing this cluster. */
  independent_sources: number;
  provenance: ProvenanceEntry[];

  geo?: GeoEnrichment;
  /** 0–100 composite: severity × population at risk × confidence. */
  priority: number;

  adjudications: Adjudication[];
  /** Set when this event was folded into another cluster. */
  merged_into?: string;

  /** Pipeline stage timings, µs — surfaced in the fusion console. */
  trace?: Record<string, number>;
}

export interface ConfidenceFactor {
  label: string;
  /** Contribution in log-odds. Positive raises confidence. */
  delta: number;
  detail?: string;
}

/* ── Raw ingest envelope ─────────────────────────────────────────────
   What a source adapter produces, before normalisation. */
export interface RawReport {
  source_type: SourceType;
  source_id: string;
  handle?: string;
  url?: string;
  text: string;
  created_at: string;
  /** Some sources carry their own coordinates (geotagged posts, sensors). */
  geo?: { lat: number; lon: number; radius_km?: number };
  lang?: 'fr' | 'sw' | 'ln' | 'en' | 'unknown';
  /** Sensor payloads carry structured values instead of prose. */
  metrics?: Record<string, number>;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID: 48-bit millisecond timestamp + 80 bits of randomness, Crockford
 *  base32. Sorts lexicographically by creation time — which means the
 *  triage queue can page by id without a secondary index. */
export function ulid(now: number = Date.now()): string {
  let ts = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    ts = ULID_ALPHABET[t % 32] + ts;
    t = Math.floor(t / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  let r = '';
  for (let i = 0; i < 16; i++) r += ULID_ALPHABET[rand[i] % 32];
  return ts + r;
}

/** FNV-1a 32-bit — fast, dependency-free, adequate for a blocking key
 *  (this is not a security hash and never used as one). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Blocking key: 6-hour time bucket × ~11 km geo cell × event type.
 *  Events sharing a block key are candidate duplicates and get pairwise
 *  scored; events in different blocks are never compared. This is what
 *  keeps dedup O(n·k) instead of O(n²) as the stream grows. */
export function blockKey(
  timestamp: string,
  lat: number | null,
  lon: number | null,
  type: EventType,
): string {
  const bucket = Math.floor(new Date(timestamp).getTime() / (6 * 3600_000));
  const cell = lat == null || lon == null
    ? 'nogeo'
    : `${Math.round(lat * 10)}:${Math.round(lon * 10)}`;
  return fnv1a(`${bucket}|${cell}|${type}`);
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  armed_clash:         'Affrontement armé',
  shelling:            'Bombardement',
  airstrike:           'Frappe aérienne',
  drone_strike:        'Frappe de drone',
  ied:                 'EEI / mine',
  abduction:           'Enlèvement',
  massacre:            'Massacre',
  sexual_violence:     'Violence sexuelle',
  looting:             'Pillage',
  arson:               'Incendie criminel',
  displacement:        'Déplacement de population',
  roadblock:           'Barrière / taxation illégale',
  mine_incident:       'Incident minier',
  protest:             'Manifestation',
  arrest:              'Arrestation',
  comms_blackout:      'Coupure de communications',
  troop_movement:      'Mouvement de troupes',
  humanitarian_access: 'Accès humanitaire',
  thermal_anomaly:     'Anomalie thermique',
  unknown:             'Non classé',
};

/** Base severity weight per type, 0–1. Feeds the priority score. */
export const EVENT_TYPE_SEVERITY: Record<EventType, number> = {
  massacre: 1.00, airstrike: 0.90, shelling: 0.85, armed_clash: 0.80,
  drone_strike: 0.80, sexual_violence: 0.85, ied: 0.75, abduction: 0.70,
  displacement: 0.65, arson: 0.55, looting: 0.50, mine_incident: 0.50,
  comms_blackout: 0.55, troop_movement: 0.45, roadblock: 0.35,
  humanitarian_access: 0.40, protest: 0.30, arrest: 0.25,
  thermal_anomaly: 0.30, unknown: 0.20,
};
