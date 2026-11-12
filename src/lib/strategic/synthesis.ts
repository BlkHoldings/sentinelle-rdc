/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Analyst workbench: retrieval and structured brief
   ═══════════════════════════════════════════════════════════════════════

   What this is: keyword retrieval over the records in the workspace,
   assembled into a fixed brief structure by rules.

   What this is not: a language model. No model is connected, nothing
   leaves the browser, and the output contains no sentence that is not
   either a quotation of a record or a count of records. The interface
   says so in as many words, because a rule-built summary dressed as "AI
   analysis" invites a trust it has not earned.

   The structure matches what a model-backed version would be required to
   return — question, synthesis, findings, evidence, confidence,
   limitations, open questions, next steps — so swapping the engine later
   changes the quality of the prose, not the contract with the reader.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  fold, standingLabel,
  type StrategicRecord, type Confidence,
} from './model';

/** Words that carry no retrieval signal in French or English. */
const STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'en', 'dans', 'sur', 'pour',
  'par', 'avec', 'sans', 'que', 'qui', 'quoi', 'quel', 'quels', 'quelle', 'quelles', 'est',
  'sont', 'aux', 'au', 'ce', 'ces', 'se', 'sa', 'son', 'ses', 'il', 'elle', 'ne', 'pas', 'plus',
  'the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'is', 'are', 'what', 'which',
  'how', 'why', 'main', 'principaux', 'principales', 'comment', 'pourquoi',
]);

export function tokenize(q: string): string[] {
  return [...new Set(
    fold(q).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)),
  )];
}

export interface Hit {
  record: StrategicRecord;
  score: number;
  /** Which query terms this record matched, and where. */
  matched: string[];
}

/**
 * Rank records against a question.
 *
 * Field weights reflect how much a match means: a term in the title or
 * the entity list is what the record is *about*; the same term in the
 * summary may be a passing mention.
 */
export function retrieve(question: string, records: StrategicRecord[], limit = 6): Hit[] {
  const terms = tokenize(question);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const r of records) {
    if (r.status === 'archived') continue;
    const title = fold(r.title);
    const ents = fold(r.entities.join(' '));
    const meta = fold(`${r.sector} ${r.country} ${r.region}`);
    const body = fold(r.summary);
    let score = 0;
    const matched: string[] = [];
    for (const t of terms) {
      let s = 0;
      if (title.includes(t)) s += 3;
      if (ents.includes(t)) s += 3;
      if (meta.includes(t)) s += 2;
      if (body.includes(t)) s += 1;
      if (s) { score += s; matched.push(t); }
    }
    if (score) hits.push({ record: r, score, matched });
  }
  return hits.sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
    .slice(0, limit);
}

export interface Brief {
  question: string;
  generatedAt: string;
  /** False when the workspace cannot support an answer at all. */
  sufficient: boolean;
  synthesis: string;
  findings: { text: string; recordId: string }[];
  evidence: { recordId: string; title: string; standing: string; sources: number; illustrative: boolean }[];
  confidence: { level: Confidence | 'none'; rationale: string };
  limitations: string[];
  unresolved: string[];
  nextSteps: string[];
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function buildBrief(question: string, records: StrategicRecord[]): Brief {
  const q = question.trim();
  const hits = retrieve(q, records);
  const terms = tokenize(q);
  const generatedAt = new Date().toISOString();

  if (!hits.length) {
    return {
      question: q, generatedAt, sufficient: false,
      synthesis: terms.length
        ? 'Aucun dossier de l’espace de travail ne correspond à cette question. Il n’y a rien à synthétiser, et aucune réponse n’est proposée.'
        : 'La question ne contient aucun terme exploitable pour la recherche.',
      findings: [], evidence: [],
      confidence: { level: 'none', rationale: 'Aucun élément de preuve retrouvé.' },
      limitations: ['La recherche porte uniquement sur les dossiers saisis dans cet espace de travail.'],
      unresolved: [q],
      nextSteps: [
        'Créer un dossier sur le sujet et y rattacher des sources primaires.',
        'Reformuler la question avec les noms de secteurs, de régions ou d’entités présents dans la bibliothèque.',
      ],
    };
  }

  const recs = hits.map((h) => h.record);
  const verified = recs.filter((r) => r.status === 'verified');
  const disputed = recs.filter((r) => r.status === 'disputed');
  const unsourced = recs.filter((r) => r.sources.length === 0);
  const illustrative = recs.filter((r) => r.illustrative);
  const usable = recs.filter((r) => !r.illustrative && r.sources.length > 0);

  /* The brief can be no more confident than its weakest usable basis,
     and has no basis at all if every hit is seed content or unsourced. */
  let level: Confidence | 'none' = 'none';
  let rationale: string;
  if (!usable.length) {
    rationale = 'Tous les dossiers retrouvés sont illustratifs ou dépourvus de source : ils ne constituent pas une preuve.';
  } else {
    level = usable.reduce<Confidence>(
      (lo, r) => (RANK[r.confidence] < RANK[lo] ? r.confidence : lo), 'high');
    if (!verified.length && level === 'high') level = 'medium';
    rationale = `Plafonnée par le dossier sourcé le moins assuré (${usable.length} dossier${usable.length > 1 ? 's' : ''} exploitable${usable.length > 1 ? 's' : ''}, dont ${verified.length} vérifié${verified.length > 1 ? 's' : ''}).`;
  }

  const sectors = [...new Set(recs.map((r) => r.sector))];
  const regions = [...new Set(recs.map((r) => r.region || r.country))];

  const limitations = [
    'Synthèse assemblée par règles à partir des dossiers de l’espace de travail ; aucun modèle de langage n’est connecté et aucune source externe n’a été consultée.',
  ];
  if (illustrative.length) limitations.push(`${illustrative.length} dossier${illustrative.length > 1 ? 's' : ''} sur ${recs.length} ${illustrative.length > 1 ? 'sont illustratifs' : 'est illustratif'} et ne ${illustrative.length > 1 ? 'doivent' : 'doit'} pas être cité${illustrative.length > 1 ? 's' : ''} comme constat.`);
  if (unsourced.length) limitations.push(`${unsourced.length} dossier${unsourced.length > 1 ? 's' : ''} sans aucune source rattachée.`);
  if (!verified.length) limitations.push('Aucun des dossiers retrouvés n’a été vérifié par un relecteur.');
  const missed = terms.filter((t) => !hits.some((h) => h.matched.includes(t)));
  if (missed.length) limitations.push(`Termes de la question sans aucune correspondance : ${missed.join(', ')}.`);

  const unresolved: string[] = [];
  for (const r of disputed) unresolved.push(`« ${r.title} » — les sources se contredisent ; le désaccord n’est pas tranché.`);
  for (const r of recs) {
    if (r.status === 'draft') unresolved.push(`« ${r.title} » — brouillon jamais relu.`);
  }

  const nextSteps: string[] = [];
  if (unsourced.length) nextSteps.push('Rattacher des sources primaires aux dossiers qui n’en ont pas.');
  if (recs.some((r) => r.sources.length === 1)) nextSteps.push('Recouper les dossiers à source unique par une seconde source indépendante.');
  if (disputed.length) nextSteps.push('Documenter les éléments contradictoires et consigner la position de chaque source.');
  if (recs.some((r) => r.status === 'draft')) nextSteps.push('Soumettre les brouillons à la relecture.');
  nextSteps.push('Faire approuver ce brief par un relecteur avant toute diffusion.');

  return {
    question: q, generatedAt, sufficient: usable.length > 0,
    synthesis:
      `${recs.length} dossier${recs.length > 1 ? 's' : ''} de l’espace de travail ${recs.length > 1 ? 'correspondent' : 'correspond'} à la question, `
      + `couvrant ${sectors.join(', ')} (${regions.slice(0, 4).join(', ')}). `
      + `${verified.length} ${verified.length > 1 ? 'sont vérifiés' : 'est vérifié'}, ${disputed.length} contesté${disputed.length > 1 ? 's' : ''}. `
      + (usable.length
        ? 'Les constats ci-dessous reprennent le résumé de chaque dossier, sans interprétation ajoutée.'
        : 'Aucun n’est à la fois sourcé et non illustratif : ce qui suit est un point de départ de recherche, pas une réponse.'),
    findings: hits.map((h) => ({ text: h.record.summary, recordId: h.record.id })),
    evidence: recs.map((r) => ({
      recordId: r.id, title: r.title, standing: standingLabel(r),
      sources: r.sources.length, illustrative: r.illustrative,
    })),
    confidence: { level, rationale },
    limitations, unresolved, nextSteps,
  };
}

/** Plain-text rendering, for the report body and for export. */
export function briefToMarkdown(b: Brief, titleOf: (id: string) => string): string {
  const L: string[] = [];
  L.push(`# ${b.question}`, '');
  L.push(`_Généré le ${b.generatedAt.slice(0, 16).replace('T', ' ')} UTC — synthèse par règles, sans modèle de langage._`, '');
  L.push('## Synthèse', b.synthesis, '');
  L.push('## Constats');
  if (b.findings.length) b.findings.forEach((f, i) => L.push(`${i + 1}. ${f.text} — [${titleOf(f.recordId)}]`));
  else L.push('Aucun.');
  L.push('', '## Éléments de preuve');
  if (b.evidence.length) b.evidence.forEach((e) => L.push(`- ${e.title} — ${e.standing}${e.illustrative ? ' — ILLUSTRATIF' : ''}`));
  else L.push('Aucun.');
  L.push('', '## Confiance', `${b.confidence.level === 'none' ? 'Non établie' : b.confidence.level} — ${b.confidence.rationale}`);
  L.push('', '## Limites', ...b.limitations.map((x) => `- ${x}`));
  L.push('', '## Questions ouvertes', ...(b.unresolved.length ? b.unresolved.map((x) => `- ${x}`) : ['Aucune relevée.']));
  L.push('', '## Prochaines étapes', ...b.nextSteps.map((x, i) => `${i + 1}. ${x}`));
  return L.join('\n');
}
