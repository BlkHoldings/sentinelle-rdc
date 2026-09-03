/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Source Reliability Model
   ═══════════════════════════════════════════════════════════════════════

   The reference design tracked reliability as a flat dict of floats and
   updated it with `source_reliability[S] += 0.05` on every analyst
   confirmation. Three problems with that:

     • Unbounded drift — a source confirmed 15 times exceeds 1.0 and
       becomes mathematically certain, which nothing is.
     • No confidence-in-the-confidence — a source with 1 confirmation is
       treated identically to one with 400.
     • No decay — a source that was reliable in 2023 and has since been
       captured by a faction keeps its old score forever.

   This module models each source as a Beta–Bernoulli posterior. The
   Admiralty grade sets the prior pseudo-counts; analyst adjudications are
   Bernoulli observations; observations decay exponentially with a 90-day
   half-life so the posterior tracks a source's *current* behaviour. The
   posterior mean is the point estimate; the posterior variance drives how
   much a single report from that source is allowed to move a confidence
   score.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  ADMIRALTY_RELIABILITY, type AdmiraltyReliability, type AdmiraltyCredibility,
  type SourceType, type SourceFamily,
} from './schema';

/* ── Source registry ─────────────────────────────────────────────── */

export interface SourceProfile {
  type: SourceType;
  family: SourceFamily;
  label: string;
  /** Initial Admiralty reliability grade, before any feedback. */
  baseGrade: AdmiraltyReliability;
  /** Default credibility applied to reports lacking their own cues. */
  baseCredibility: AdmiraltyCredibility;
  /** Strength of the prior in pseudo-observations. A wire service starts
   *  with a strong prior (hard to move); an anonymous account starts weak
   *  (a few confirmations meaningfully change its standing). */
  priorStrength: number;
}

export const SOURCE_PROFILES: SourceProfile[] = [
  { type: 'acled',              family: 'wire',      label: 'ACLED',              baseGrade: 'B', baseCredibility: 2, priorStrength: 40 },
  { type: 'reliefweb',          family: 'wire',      label: 'ReliefWeb',          baseGrade: 'B', baseCredibility: 2, priorStrength: 30 },
  { type: 'ocha',               family: 'wire',      label: 'OCHA RDC',           baseGrade: 'A', baseCredibility: 2, priorStrength: 40 },
  { type: 'radio_okapi',        family: 'broadcast', label: 'Radio Okapi',        baseGrade: 'B', baseCredibility: 2, priorStrength: 30 },
  { type: 'rtnc',               family: 'broadcast', label: 'RTNC',               baseGrade: 'C', baseCredibility: 3, priorStrength: 15 },
  { type: 'community_radio',    family: 'broadcast', label: 'Radio communautaire',baseGrade: 'C', baseCredibility: 3, priorStrength: 10 },
  { type: 'actualite_cd',       family: 'press',     label: 'Actualité.cd',       baseGrade: 'B', baseCredibility: 3, priorStrength: 20 },
  { type: '7sur7',              family: 'press',     label: '7sur7.cd',           baseGrade: 'C', baseCredibility: 3, priorStrength: 12 },
  { type: 'politico_cd',        family: 'press',     label: 'Politico.cd',        baseGrade: 'C', baseCredibility: 3, priorStrength: 12 },
  { type: 'twitter_verified',   family: 'social',    label: 'X — vérifié',        baseGrade: 'C', baseCredibility: 3, priorStrength: 8 },
  { type: 'twitter_unverified', family: 'social',    label: 'X — non vérifié',    baseGrade: 'E', baseCredibility: 4, priorStrength: 4 },
  { type: 'facebook',           family: 'social',    label: 'Facebook',           baseGrade: 'E', baseCredibility: 4, priorStrength: 4 },
  { type: 'telegram',           family: 'messaging', label: 'Telegram',           baseGrade: 'D', baseCredibility: 4, priorStrength: 6 },
  { type: 'whatsapp',           family: 'messaging', label: 'WhatsApp',           baseGrade: 'D', baseCredibility: 4, priorStrength: 5 },
  { type: 'ngo_field',          family: 'field',     label: 'Rapport ONG terrain',baseGrade: 'B', baseCredibility: 2, priorStrength: 20 },
  { type: 'civil_society',      family: 'field',     label: 'Société civile',     baseGrade: 'C', baseCredibility: 3, priorStrength: 14 },
  { type: 'sms_gateway',        family: 'field',     label: 'Passerelle SMS',     baseGrade: 'D', baseCredibility: 3, priorStrength: 6 },
  { type: 'firms',              family: 'sensor',    label: 'NASA FIRMS',         baseGrade: 'A', baseCredibility: 2, priorStrength: 50 },
  { type: 'acoustic',           family: 'sensor',    label: 'Capteur acoustique', baseGrade: 'B', baseCredibility: 2, priorStrength: 25 },
  { type: 'telecom',            family: 'sensor',    label: 'Télémétrie télécom', baseGrade: 'A', baseCredibility: 1, priorStrength: 45 },
  { type: 'sentinel',           family: 'imagery',   label: 'Sentinel-1/2',       baseGrade: 'A', baseCredibility: 1, priorStrength: 50 },
  { type: 'uas_isr',            family: 'imagery',   label: 'UAS ISR',            baseGrade: 'A', baseCredibility: 1, priorStrength: 45 },
  { type: 'fardc',              family: 'official',  label: 'FARDC — communiqué', baseGrade: 'D', baseCredibility: 3, priorStrength: 15 },
  { type: 'monusco',            family: 'official',  label: 'MONUSCO',            baseGrade: 'B', baseCredibility: 2, priorStrength: 30 },
  { type: 'gov_provincial',     family: 'official',  label: 'Gouvernorat',        baseGrade: 'C', baseCredibility: 3, priorStrength: 18 },
  { type: 'anonymous',          family: 'social',    label: 'Anonyme',            baseGrade: 'F', baseCredibility: 5, priorStrength: 2 },
];

const PROFILE_BY_TYPE = new Map(SOURCE_PROFILES.map((p) => [p.type, p]));

export function profileOf(type: SourceType): SourceProfile {
  return PROFILE_BY_TYPE.get(type) ?? PROFILE_BY_TYPE.get('anonymous')!;
}

/* ── Beta–Bernoulli posterior with time decay ────────────────────── */

const HALF_LIFE_DAYS = 90;
const DECAY_PER_DAY = Math.log(2) / HALF_LIFE_DAYS;

export interface Observation {
  /** true = analyst confirmed a report from this source was accurate. */
  correct: boolean;
  at: number; // epoch ms
  /** Partial credit: a report that was directionally right but wrong on
   *  casualty counts scores 0.5 rather than a hard pass/fail. */
  weight: number;
}

export interface ReliabilityState {
  /** Keyed by source type, and separately by `type:handle` so an
   *  individual outlet or account can diverge from its family. */
  observations: Record<string, Observation[]>;
}

export function emptyReliability(): ReliabilityState {
  return { observations: {} };
}

/** Decayed pseudo-counts (α, β) for a key, including the Admiralty prior. */
export function posteriorFor(
  state: ReliabilityState,
  type: SourceType,
  handle?: string,
  now: number = Date.now(),
): { alpha: number; beta: number; mean: number; sd: number; n: number } {
  const prof = profileOf(type);
  const p0 = ADMIRALTY_RELIABILITY[prof.baseGrade].p;

  let alpha = p0 * prof.priorStrength;
  let beta = (1 - p0) * prof.priorStrength;
  let n = 0;

  const keys = handle ? [type, `${type}:${handle}`] : [type];
  for (const key of keys) {
    for (const o of state.observations[key] ?? []) {
      const ageDays = Math.max(0, (now - o.at) / 86_400_000);
      const w = o.weight * Math.exp(-DECAY_PER_DAY * ageDays);
      if (o.correct) alpha += w; else beta += w;
      n += w;
    }
  }

  const mean = alpha / (alpha + beta);
  const varr = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  return { alpha, beta, mean, sd: Math.sqrt(varr), n };
}

/** Record an analyst adjudication against a source. */
export function observe(
  state: ReliabilityState,
  type: SourceType,
  correct: boolean,
  handle?: string,
  weight = 1,
  at: number = Date.now(),
): ReliabilityState {
  const next: ReliabilityState = { observations: { ...state.observations } };
  const push = (key: string) => {
    // Cap history per key; decay makes anything past ~2 years irrelevant
    // and an unbounded array is a memory leak in a long-running session.
    const arr = [...(next.observations[key] ?? []), { correct, at, weight }];
    next.observations[key] = arr.length > 500 ? arr.slice(-500) : arr;
  };
  push(type);
  if (handle) push(`${type}:${handle}`);
  return next;
}

/** Maps a posterior mean back onto the Admiralty A–F scale so the UI can
 *  show a doctrinally familiar grade rather than a bare probability. */
export function gradeFor(mean: number): AdmiraltyReliability {
  if (mean >= 0.90) return 'A';
  if (mean >= 0.75) return 'B';
  if (mean >= 0.58) return 'C';
  if (mean >= 0.33) return 'D';
  if (mean >= 0.10) return 'E';
  return 'F';
}

/** Credibility grade for a single report, from its own linguistic
 *  hedging plus how specific it is. Independent of who said it. */
export function credibilityFor(
  certainty: 'asserted' | 'attributed' | 'hedged' | 'denied',
  hasLocation: boolean,
  hasActors: boolean,
  hasTime: boolean,
): AdmiraltyCredibility {
  if (certainty === 'denied') return 5;
  const specificity = (hasLocation ? 1 : 0) + (hasActors ? 1 : 0) + (hasTime ? 1 : 0);
  if (certainty === 'asserted')   return specificity >= 3 ? 2 : specificity >= 2 ? 3 : 4;
  if (certainty === 'attributed') return specificity >= 3 ? 3 : 4;
  return specificity >= 2 ? 4 : 5; // hedged
}
