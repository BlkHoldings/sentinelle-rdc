/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Confidence Fusion
   ═══════════════════════════════════════════════════════════════════════

   The reference model was:

       confidence = min(0.95, base + 0.1 * n_sources + 0.2 * n_agreeing)

   That is additive in a space where evidence combines multiplicatively,
   and it has a specific failure mode that matters enormously in this
   theatre: **it treats correlated sources as independent**. When one
   Radio Okapi bulletin is reposted by thirty X accounts, the additive
   model reads thirty corroborations and pins confidence at the 0.95 cap.
   In eastern DRC that is not a hypothetical — it is the dominant
   information pattern, and it is exactly how false massacre reports
   propagate.

   This module fuses evidence in **log-odds** instead:

       logit(P) = logit(prior) + Σ  w_i · LLR_i

   where each report's log-likelihood ratio comes from its source's Beta
   posterior mean, and w_i is a *correlation discount*: within a single
   source family, the k-th report is weighted ρ^(k-1) with ρ ≈ 0.35. Thirty
   tweets are therefore worth ≈ 1.54 independent tweets, not thirty. Cross-
   family corroboration — a Radio Okapi bulletin *and* a FIRMS thermal hit
   *and* an NGO field report — is what actually moves the posterior, which
   is the correct epistemics.

   Additional terms the reference model had no notion of:
     • hedged/denied reporting contributes less, or negatively
     • spatio-temporal coherence within the cluster
     • staleness decay toward the prior for uncorroborated single-source
       events (a lone unverified tweet from six days ago is not evidence
       of the same strength it was six days ago)
     • analyst adjudication as a dominating term
   ═══════════════════════════════════════════════════════════════════════ */

import type {
  FusedEvent, ConfidenceFactor, ProvenanceEntry, SourceFamily,
} from './schema';
import { ADMIRALTY_CREDIBILITY } from './schema';
import { posteriorFor, type ReliabilityState } from './reliability';
import { haversineKm } from './gazetteer';

/** Base rate: absent any evidence, how likely is a reported conflict
 *  event in the AOR to be substantially accurate? Deliberately neutral. */
const PRIOR = 0.45;

/** Within-family correlation. ρ=0 would mean reports in the same family
 *  are fully independent; ρ=1 that they carry no new information at all.
 *  0.35 is tuned so that ~5 same-family reports ≈ 1.5 independent ones. */
const RHO: Record<SourceFamily, number> = {
  social:    0.62,  // highest repost/echo rate
  messaging: 0.55,
  press:     0.45,  // Congolese outlets cross-quote heavily
  broadcast: 0.38,
  wire:      0.30,
  official:  0.35,
  field:     0.22,  // independent field networks correlate least
  sensor:    0.10,  // two sensors are near-independent by construction
  imagery:   0.10,
};

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Certainty multiplier on a report's evidential weight. */
const CERTAINTY_W = {
  asserted: 1.0,
  attributed: 0.85,
  hedged: 0.45,
  denied: -0.9,   // an explicit denial is evidence *against*
} as const;

export interface ConfidenceInput {
  provenance: ProvenanceEntry[];
  /** Cluster members' coordinates + times, for the coherence term. */
  members: { lat?: number; lon?: number; timestamp: string }[];
  /** Analyst decisions already recorded on this event. */
  adjudicated?: 'confirm' | 'reject' | null;
  reliability: ReliabilityState;
  now?: number;
}

export interface ConfidenceResult {
  confidence: number;
  factors: ConfidenceFactor[];
  independentSources: number;
  /** Effective independent-report count after correlation discounting. */
  effectiveN: number;
}

export function fuseConfidence(input: ConfidenceInput): ConfidenceResult {
  const now = input.now ?? Date.now();
  const factors: ConfidenceFactor[] = [];
  let L = logit(PRIOR);

  factors.push({
    label: 'Probabilité a priori',
    delta: L,
    detail: `Taux de base ${(PRIOR * 100).toFixed(0)} %`,
  });

  /* ── Analyst adjudication dominates everything else ───────────── */
  if (input.adjudicated === 'confirm') {
    return {
      confidence: 0.97,
      factors: [...factors, { label: 'Confirmé par analyste', delta: 99, detail: 'Adjudication humaine' }],
      independentSources: countFamilies(input.provenance),
      effectiveN: input.provenance.length,
    };
  }
  if (input.adjudicated === 'reject') {
    return {
      confidence: 0.03,
      factors: [...factors, { label: 'Rejeté par analyste', delta: -99, detail: 'Adjudication humaine' }],
      independentSources: countFamilies(input.provenance),
      effectiveN: input.provenance.length,
    };
  }

  /* ── Per-report evidence, discounted within family ────────────── */
  const byFamily = new Map<SourceFamily, ProvenanceEntry[]>();
  for (const p of input.provenance) {
    const arr = byFamily.get(p.source.family);
    if (arr) arr.push(p); else byFamily.set(p.source.family, [p]);
  }

  let effectiveN = 0;

  for (const [family, entries] of byFamily) {
    // Strongest report in a family first, so the full-weight slot goes to
    // the best evidence rather than whichever arrived first.
    const ranked = [...entries].sort((a, b) => b.report_confidence - a.report_confidence);
    const rho = RHO[family];
    let familyLLR = 0;
    let familyWeight = 0;

    ranked.forEach((p, k) => {
      const post = posteriorFor(input.reliability, p.source.type, p.source.handle, now);
      const cred = ADMIRALTY_CREDIBILITY[p.source.credibility].p;

      /* Report likelihood: source reliability tempered by this report's
         own credibility grade. Clamped away from 0/1 so no single report
         can drive the posterior to certainty. */
      const pReport = clamp(0.5 + (post.mean - 0.5) * (0.4 + 0.6 * cred), 0.05, 0.93);
      let llr = logit(pReport) - logit(PRIOR);

      /* Posterior variance shrinkage: a source we have barely observed
         gets pulled toward the neutral prior. sd is ~0.5 for a totally
         unknown source, ~0.02 for a well-characterised one. */
      const shrink = 1 - Math.min(0.6, post.sd * 1.6);
      llr *= shrink;

      /* Hedging / attribution / denial. */
      const certW = certaintyWeight(p);
      llr *= certW;

      /* Contradiction within the cluster flips the sign. */
      if (p.agreement === 'contradict') llr = -Math.abs(llr) * 0.8;
      else if (p.agreement === 'partial') llr *= 0.6;

      /* Correlation discount by rank within family. */
      const w = Math.pow(rho, k);
      familyLLR += llr * w;
      familyWeight += w;
    });

    effectiveN += familyWeight;
    L += familyLLR;

    factors.push({
      label: `Famille « ${FAMILY_LABEL[family]} »`,
      delta: familyLLR,
      detail: `${entries.length} rapport(s) → ${familyWeight.toFixed(2)} indépendant(s) effectif(s) (ρ=${RHO[family]})`,
    });
  }

  /* ── Cross-family corroboration bonus ──────────────────────────
     Independent *kinds* of evidence agreeing is worth more than the sum
     of their individual weights — a thermal signature co-located with a
     field report is a qualitatively stronger claim than either alone. */
  const nFamilies = byFamily.size;
  if (nFamilies >= 2) {
    const bonus = 0.42 * Math.log(nFamilies);
    L += bonus;
    factors.push({
      label: 'Corroboration inter-familles',
      delta: bonus,
      detail: `${nFamilies} familles de sources indépendantes`,
    });
  }

  /* ── Spatio-temporal coherence ─────────────────────────────────
     Reports that agree on *where* and *when* corroborate more strongly
     than reports that merely agree something happened somewhere. */
  const coh = coherence(input.members);
  if (coh !== 0 && input.members.length >= 2) {
    L += coh;
    factors.push({
      label: coh > 0 ? 'Cohérence spatio-temporelle' : 'Incohérence spatio-temporelle',
      delta: coh,
      detail: coh > 0 ? 'Rapports groupés dans l\'espace et le temps' : 'Rapports dispersés — possible confusion d\'événements',
    });
  }

  /* ── Staleness ─────────────────────────────────────────────────
     A single-source event that no one has corroborated in days is weaker
     evidence than it was on day zero; corroborated events do not decay. */
  if (effectiveN < 2) {
    const newest = Math.max(
      ...input.provenance.map((p) => new Date(p.source.published_at).getTime()),
    );
    const ageH = (now - newest) / 3_600_000;
    if (ageH > 24) {
      const penalty = -Math.min(0.85, 0.18 * Math.log2(ageH / 24 + 1));
      L += penalty;
      factors.push({
        label: 'Décroissance (non corroboré)',
        delta: penalty,
        detail: `${Math.round(ageH)} h sans corroboration indépendante`,
      });
    }
  }

  /* Hard clamp: no automated pipeline output is ever certain. Only
     analyst adjudication can exit the [0.05, 0.93] band. */
  const confidence = clamp(sigmoid(L), 0.05, 0.93);

  return {
    confidence,
    factors,
    independentSources: nFamilies,
    effectiveN,
  };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function certaintyWeight(p: ProvenanceEntry): number {
  // Credibility 5 ("improbable") is how the extractor encodes a denial.
  if (p.source.credibility === 5 && p.agreement === 'contradict') return CERTAINTY_W.denied;
  if (p.source.credibility >= 5) return CERTAINTY_W.hedged;
  if (p.source.credibility === 4) return CERTAINTY_W.attributed;
  return CERTAINTY_W.asserted;
}

function countFamilies(prov: ProvenanceEntry[]): number {
  return new Set(prov.map((p) => p.source.family)).size;
}

/** Returns a log-odds adjustment in roughly [-0.6, +0.5] based on how
 *  tightly the cluster's member reports agree on place and time. */
function coherence(members: { lat?: number; lon?: number; timestamp: string }[]): number {
  const geo = members.filter((m) => m.lat != null && m.lon != null);
  let spatial = 0;
  if (geo.length >= 2) {
    let maxD = 0;
    for (let i = 0; i < geo.length; i++) {
      for (let j = i + 1; j < geo.length; j++) {
        maxD = Math.max(maxD, haversineKm(geo[i].lat!, geo[i].lon!, geo[j].lat!, geo[j].lon!));
      }
    }
    spatial = maxD <= 5 ? 0.28 : maxD <= 20 ? 0.12 : maxD <= 50 ? 0 : -0.35;
  }

  const times = members
    .map((m) => new Date(m.timestamp).getTime())
    .filter(Number.isFinite);
  let temporal = 0;
  if (times.length >= 2) {
    const spreadH = (Math.max(...times) - Math.min(...times)) / 3_600_000;
    temporal = spreadH <= 3 ? 0.22 : spreadH <= 12 ? 0.10 : spreadH <= 36 ? 0 : -0.25;
  }
  return spatial + temporal;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

const FAMILY_LABEL: Record<SourceFamily, string> = {
  wire: 'agrégateurs', broadcast: 'radio', press: 'presse', social: 'réseaux sociaux',
  messaging: 'messagerie', field: 'terrain', sensor: 'capteurs', imagery: 'imagerie',
  official: 'officiel',
};

/* ── Priority scoring ────────────────────────────────────────────
   What the analyst should look at first. Deliberately multiplies
   confidence in — a high-severity event we don't believe should not
   outrank a medium-severity event we do. */

export function computePriority(e: FusedEvent, severity: number): number {
  const pop = e.geo?.population_at_risk ?? 0;
  // Log-scaled: the difference between 100 and 1 000 people at risk
  // matters more than between 100 000 and 101 000.
  const popTerm = Math.min(1, Math.log10(1 + pop) / 5);
  const casualtyTerm = Math.min(1, ((e.casualties.fatalities ?? 0) + 0.4 * (e.casualties.injured ?? 0)) / 25);

  const recencyH = (Date.now() - new Date(e.timestamp).getTime()) / 3_600_000;
  const recencyTerm = Math.exp(-Math.max(0, recencyH) / 72); // 3-day e-fold

  const raw =
    0.34 * severity +
    0.22 * casualtyTerm +
    0.18 * popTerm +
    0.26 * recencyTerm;

  return Math.round(100 * raw * (0.35 + 0.65 * e.confidence));
}
