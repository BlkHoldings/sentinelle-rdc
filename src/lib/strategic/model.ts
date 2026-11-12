/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Strategic record model
   ═══════════════════════════════════════════════════════════════════════

   The evidence-first core: infrastructure, energy, mining, trade and
   policy records, each traceable to its sources.

   Two fields are kept deliberately apart, because conflating them is the
   commonest way an analytic product misleads its reader:

   • `confidence` — the analyst's judgement of how well the evidence
     supports the assessment. A judgement about reasoning.
   • `status`     — where the record stands in verification. A fact
     about process.

   A record can be high-confidence and still a draft nobody has reviewed,
   or verified and low-confidence (reviewed, sourced, and still genuinely
   uncertain). Collapsing the two into one "reliability" badge hides
   exactly the cases a reader most needs to see.

   Everything here is pure — no React, no storage — so it can be tested
   directly and reused unchanged when a server-side store replaces the
   browser one.
   ═══════════════════════════════════════════════════════════════════════ */

export const SECTORS = ['Énergie', 'Mines', 'Infrastructure', 'Commerce', 'Politique publique'] as const;
export type Sector = (typeof SECTORS)[number];

export type Confidence = 'high' | 'medium' | 'low';

export type VerificationStatus =
  | 'draft'        // entered, nothing checked
  | 'in_review'    // submitted for a second pair of eyes
  | 'verified'     // sources checked by a reviewer
  | 'disputed'     // sources materially disagree
  | 'archived';    // withdrawn from active use, kept for the record

/** On what basis may this source be held and used? */
export const ACCESS_BASES = [
  'Publication ouverte',
  'Licence ouverte (CC / ODbL)',
  'Licence commerciale',
  'Document transmis avec autorisation',
  'À déterminer',
] as const;
export type AccessBasis = (typeof ACCESS_BASES)[number];

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  /** URL or document reference. One of the two must identify the source. */
  url: string;
  /** ISO date the source was published; '' when unknown. */
  published: string;
  /** ISO date the analyst retrieved it. */
  retrieved: string;
  access: AccessBasis;
  notes: string;
}

export interface StrategicRecord {
  id: string;
  title: string;
  sector: Sector;
  country: string;
  region: string;
  summary: string;
  confidence: Confidence;
  status: VerificationStatus;
  /** Named systems, organisations or projects this record concerns.
   *  Organisation- and project-level only — never private individuals. */
  entities: string[];
  sources: SourceRef[];
  /** Optional point for the map. */
  lat?: number;
  lon?: number;
  /** Seed content shipped with the build. Shown with a visible label
   *  wherever the record appears; never presented as a finding. */
  illustrative: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/* ── Display ─────────────────────────────────────────────────────── */

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Élevée', medium: 'Moyenne', low: 'Faible',
};

export const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: '#3fb984', medium: '#e2a336', low: '#e5484d',
};

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  draft: 'Brouillon',
  in_review: 'En revue',
  verified: 'Vérifié',
  disputed: 'Contesté',
  archived: 'Archivé',
};

export const STATUS_COLOR: Record<VerificationStatus, string> = {
  draft: '#9aa3b0',
  in_review: '#58c4dc',
  verified: '#3fb984',
  disputed: '#e5484d',
  archived: '#7f8896',
};

/**
 * How a record's standing reads in one line.
 *
 * Always names both axes. "Élevée" alone would let a reader assume the
 * record had been checked; this never lets confidence stand in for
 * verification.
 */
export function standingLabel(r: Pick<StrategicRecord, 'confidence' | 'status' | 'sources'>): string {
  const src = r.sources.length === 0
    ? 'aucune source'
    : `${r.sources.length} source${r.sources.length > 1 ? 's' : ''}`;
  return `Confiance ${CONFIDENCE_LABEL[r.confidence].toLowerCase()} · ${STATUS_LABEL[r.status].toLowerCase()} · ${src}`;
}

/* ── Validation ──────────────────────────────────────────────────── */

export type FieldErrors = Partial<Record<string, string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validateSource(s: SourceRef, today = new Date().toISOString().slice(0, 10)): FieldErrors {
  const e: FieldErrors = {};
  if (!s.title.trim()) e.title = 'Titre de la source requis';
  if (!s.publisher.trim()) e.publisher = 'Éditeur ou organisme requis';
  if (!s.url.trim()) e.url = 'URL ou référence documentaire requise';
  else if (/^https?:/i.test(s.url)) {
    try { new URL(s.url); } catch { e.url = 'URL mal formée'; }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(s.url)) {
    // Anything with a scheme that is not http(s) — javascript:, data:, … —
    // would be rendered as a link an analyst might click.
    e.url = 'Seules les URL http(s) ou une référence textuelle sont acceptées';
  }
  if (s.published) {
    if (!isRealDate(s.published)) e.published = 'Date invalide (AAAA-MM-JJ)';
    else if (s.published > today) e.published = 'Date de publication dans le futur';
  }
  if (!isRealDate(s.retrieved)) e.retrieved = 'Date de consultation requise (AAAA-MM-JJ)';
  else if (s.retrieved > today) e.retrieved = 'Date de consultation dans le futur';
  else if (s.published && isRealDate(s.published) && s.retrieved < s.published) {
    e.retrieved = 'Consultée avant sa publication';
  }
  return e;
}

export function validateRecord(r: StrategicRecord): FieldErrors {
  const e: FieldErrors = {};
  const title = r.title.trim();
  if (title.length < 8) e.title = 'Titre trop court pour être descriptif (8 caractères minimum)';
  else if (title.length > 140) e.title = 'Titre limité à 140 caractères';
  if (!SECTORS.includes(r.sector)) e.sector = 'Secteur inconnu';
  if (!r.country.trim()) e.country = 'Pays ou ensemble régional requis';
  if (r.summary.trim().length < 20) e.summary = 'Résumé trop court (20 caractères minimum)';

  const hasLat = r.lat != null, hasLon = r.lon != null;
  if (hasLat !== hasLon) e.coords = 'Latitude et longitude vont ensemble';
  else if (hasLat && (Number.isNaN(r.lat!) || r.lat! < -90 || r.lat! > 90)) e.coords = 'Latitude hors bornes';
  else if (hasLon && (Number.isNaN(r.lon!) || r.lon! < -180 || r.lon! > 180)) e.coords = 'Longitude hors bornes';

  /* Process rules. These are what make the status field mean something:
     a record cannot be called verified, or even be sent for review, on
     the strength of no evidence at all. */
  if ((r.status === 'verified' || r.status === 'in_review') && r.sources.length === 0) {
    e.status = 'Au moins une source est requise avant la mise en revue';
  }
  if (r.confidence === 'high' && r.sources.length < 2) {
    e.confidence = 'Une confiance élevée demande au moins deux sources';
  }

  r.sources.forEach((s, i) => {
    const se = validateSource(s);
    for (const [k, v] of Object.entries(se)) e[`sources.${i}.${k}`] = v;
  });
  return e;
}

/* ── Filtering ───────────────────────────────────────────────────── */

export interface RecordFilter {
  query?: string;
  sector?: Sector | 'all';
  status?: VerificationStatus | 'all' | 'active';
}

/** Lower-case and strip accents, so "energie" finds "Énergie". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterRecords(records: StrategicRecord[], f: RecordFilter): StrategicRecord[] {
  const terms = fold(f.query ?? '').split(/\s+/).filter(Boolean);
  return records.filter((r) => {
    if (f.sector && f.sector !== 'all' && r.sector !== f.sector) return false;
    // 'active' is the default view: everything except the archive.
    if (f.status === 'active' || f.status == null) { if (r.status === 'archived') return false; }
    else if (f.status !== 'all' && r.status !== f.status) return false;
    if (!terms.length) return true;
    const hay = fold([
      r.title, r.summary, r.country, r.region, r.sector, ...r.entities,
      ...r.sources.map((s) => `${s.title} ${s.publisher}`),
    ].join(' '));
    // Every term must match: adding a word narrows the result.
    return terms.every((t) => hay.includes(t));
  });
}

/* ── Attention index ─────────────────────────────────────────────────
   A 0–100 score of how much a record needs an analyst's time — not how
   important or risky its subject is. Every point is attributable to a
   named, checkable property of the record, and the breakdown is shown
   beside the score: a number nobody can decompose is a number nobody
   should act on. */

export interface AttentionFactor { label: string; points: number }
export interface Attention { score: number; factors: AttentionFactor[] }

export function daysSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : Math.max(0, (now - t) / 86_400_000);
}

export function attentionIndex(r: StrategicRecord, now = Date.now()): Attention {
  const f: AttentionFactor[] = [];
  if (r.status === 'archived') return { score: 0, factors: [{ label: 'Archivé', points: 0 }] };

  if (r.sources.length === 0) f.push({ label: 'Aucune source rattachée', points: 35 });
  else if (r.sources.length === 1) f.push({ label: 'Source unique, non recoupée', points: 15 });

  if (r.status === 'disputed') f.push({ label: 'Sources en désaccord', points: 30 });
  else if (r.status === 'draft') f.push({ label: 'Jamais relu', points: 15 });
  else if (r.status === 'in_review') f.push({ label: 'En attente de relecture', points: 10 });

  if (r.confidence === 'low') f.push({ label: 'Confiance faible', points: 15 });
  else if (r.confidence === 'medium') f.push({ label: 'Confiance moyenne', points: 5 });

  const age = daysSince(r.updatedAt, now);
  if (age > 180) f.push({ label: `Non mis à jour depuis ${Math.round(age)} jours`, points: 20 });
  else if (age > 60) f.push({ label: `Non mis à jour depuis ${Math.round(age)} jours`, points: 10 });

  const undated = r.sources.filter((s) => !s.published).length;
  if (undated) f.push({ label: `${undated} source${undated > 1 ? 's' : ''} sans date de publication`, points: 5 });

  const unclear = r.sources.filter((s) => s.access === 'À déterminer').length;
  if (unclear) f.push({ label: `Base d’accès non établie (${unclear})`, points: 10 });

  if (r.illustrative) f.push({ label: 'Contenu illustratif — à remplacer', points: 10 });

  return { score: Math.min(100, f.reduce((a, x) => a + x.points, 0)), factors: f };
}

/* ── Entities ────────────────────────────────────────────────────── */

export interface EntitySummary {
  name: string;
  records: StrategicRecord[];
  sectors: Sector[];
  /** Other entities named in the same records, with the co-occurrence count. */
  linked: { name: string; shared: number }[];
}

export function summariseEntities(records: StrategicRecord[]): EntitySummary[] {
  const by = new Map<string, StrategicRecord[]>();
  for (const r of records) {
    if (r.status === 'archived') continue;
    for (const raw of r.entities) {
      const name = raw.trim();
      if (!name) continue;
      const list = by.get(name);
      if (list) list.push(r); else by.set(name, [r]);
    }
  }
  return [...by.entries()].map(([name, recs]) => {
    const co = new Map<string, number>();
    for (const r of recs) for (const other of r.entities) {
      const o = other.trim();
      if (o && o !== name) co.set(o, (co.get(o) ?? 0) + 1);
    }
    return {
      name, records: recs,
      sectors: [...new Set(recs.map((r) => r.sector))],
      linked: [...co.entries()].map(([n, shared]) => ({ name: n, shared }))
        .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name)),
    };
  }).sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name));
}

/* ── Construction ────────────────────────────────────────────────── */

export function newId(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function blankSource(today = new Date().toISOString().slice(0, 10)): SourceRef {
  return {
    id: newId('src'), title: '', publisher: '', url: '', published: '',
    retrieved: today, access: 'À déterminer', notes: '',
  };
}

export function blankRecord(author: string): StrategicRecord {
  const now = new Date().toISOString();
  return {
    id: newId('rec'), title: '', sector: 'Énergie', country: 'RD Congo', region: '',
    summary: '', confidence: 'low', status: 'draft', entities: [], sources: [],
    illustrative: false, createdAt: now, updatedAt: now, createdBy: author,
  };
}
