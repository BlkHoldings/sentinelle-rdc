/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Event Type Classifier
   ═══════════════════════════════════════════════════════════════════════

   A weighted-evidence classifier over trilingual cue phrases, with actor
   and casualty priors layered on top. No training data required, which
   matters: there is no labelled Lingala conflict corpus to fine-tune on,
   and a rules model is auditable — an analyst can be shown exactly which
   phrase drove a classification and override it.

   The classifier returns a ranked distribution, not a single label. The
   triage UI shows the runner-up so the analyst can reclassify in one
   keystroke instead of retyping.
   ═══════════════════════════════════════════════════════════════════════ */

import type { EventType } from './schema';
import { foldKey } from './gazetteer';
import { areOpposed, actorByName } from './actors';
import type { Extraction } from './extract';

interface Rule {
  type: EventType;
  /** Weight per matched cue. Strong, unambiguous cues score higher. */
  w: number;
  cues: string[];
}

/* Cues are accent-folded; match is substring-on-folded-text so that
   inflections ("affrontement"/"affrontements") are covered by the stem. */
const RULES: Rule[] = [
  { type: 'armed_clash', w: 3.0, cues: [
    'affrontement', 'accrochage', 'combat', 'echange de tirs', 'echanges de tirs',
    'offensive', 'contre offensive', 'incursion', 'attaque contre les positions',
    'repousse', 'reprise de', 'ligne de front', 'front',
    'mapigano', 'mapambano', 'vita', 'kupigana',
    'bitumba', 'etumba',
    'clash', 'firefight', 'fighting',
  ]},
  { type: 'armed_clash', w: 1.2, cues: ['tirs', 'coups de feu', 'balles', 'risasi', 'gunfire', 'crepitement'] },

  { type: 'shelling', w: 3.5, cues: [
    'obus', 'bombardement', 'bombarde', 'mortier', 'roquette', 'artillerie',
    'tirs d artillerie', 'bombe est tombee', 'shelling', 'mabomu', 'kombora',
  ]},
  { type: 'airstrike', w: 3.5, cues: [
    'frappe aerienne', 'raid aerien', 'avion de chasse', 'sukhoi', 'bombardement aerien',
    'helicoptere de combat', 'airstrike', 'ndege za kivita',
  ]},
  { type: 'drone_strike', w: 3.5, cues: [
    'frappe de drone', 'drone arme', 'attaque de drone', 'drone strike',
    'drone kamikaze', 'uav strike',
  ]},
  { type: 'ied', w: 3.5, cues: [
    'engin explosif', 'eei', 'ied', 'mine artisanale', 'bombe artisanale',
    'explosion d une bombe', 'attentat a la bombe', 'kifaa cha kulipuka',
    'a explose', 'deflagration',
  ]},

  { type: 'massacre', w: 3.8, cues: [
    'massacre', 'tuerie', 'carnage', 'massacres', 'exactions massives',
    'des dizaines de civils tues', 'mauaji', 'mauaji ya halaiki', 'koboma bato',
  ]},
  { type: 'abduction', w: 3.5, cues: [
    'enlevement', 'enleve', 'enleves', 'kidnapping', 'kidnappe', 'rapt',
    'pris en otage', 'otages', 'disparition forcee',
    'utekaji', 'wametekwa', 'kutekwa nyara',
  ]},
  { type: 'sexual_violence', w: 3.8, cues: [
    'viol', 'viols', 'violence sexuelle', 'violences sexuelles', 'agression sexuelle',
    'ubakaji', 'kubakwa', 'rape', 'sexual violence',
  ]},
  { type: 'looting', w: 2.8, cues: [
    'pillage', 'pille', 'pilles', 'saccage', 'vol de betail', 'razzia',
    'depouille', 'uporaji', 'wizi', 'kupora', 'looting', 'looted',
  ]},
  { type: 'arson', w: 3.0, cues: [
    'incendie', 'incendies', 'incendie criminel', 'maisons brulees', 'village brule',
    'reduit en cendres', 'mise a feu', 'moto', 'kuchoma', 'walichoma', 'burned',
  ]},
  { type: 'displacement', w: 3.0, cues: [
    'deplacement', 'deplaces', 'deplacees', 'exode', 'fuient', 'ont fui',
    'refugies', 'vague de deplacement', 'site de deplaces', 'camp de deplaces',
    'wakimbizi', 'wamekimbia', 'kukimbia', 'bakimi', 'displacement', 'fled',
  ]},
  { type: 'roadblock', w: 3.0, cues: [
    'barriere', 'barrieres', 'barrage routier', 'poste de peage illegal',
    'taxation illegale', 'rancon', 'racket', 'tracasserie',
    'kizuizi', 'barabara imefungwa', 'roadblock', 'checkpoint illegal',
  ]},
  { type: 'mine_incident', w: 3.2, cues: [
    'carre minier', 'site minier', 'exploitation miniere', 'creuseurs',
    'coltan', 'cassiterite', 'or artisanal', 'puits d or', 'mine d or',
    'eboulement', 'machimbo', 'wachimbaji', 'mining site',
  ]},
  { type: 'protest', w: 2.8, cues: [
    'manifestation', 'manifestants', 'marche pacifique', 'ville morte',
    'sit in', 'grogne', 'protestation', 'maandamano', 'protest', 'demonstration',
  ]},
  { type: 'arrest', w: 2.5, cues: [
    'arrestation', 'arrete', 'arretes', 'interpelle', 'interpellation',
    'garde a vue', 'ecroue', 'kukamatwa', 'amekamatwa', 'arrested',
  ]},
  { type: 'comms_blackout', w: 3.5, cues: [
    'coupure de reseau', 'reseau coupe', 'panne de reseau', 'internet coupe',
    'coupure d internet', 'blackout', 'sans reseau', 'antenne detruite',
    'mtandao', 'hakuna mtandao', 'network outage', 'shutdown',
  ]},
  { type: 'troop_movement', w: 2.6, cues: [
    'renfort', 'renforts', 'deploiement', 'colonne militaire', 'convoi militaire',
    'progression', 'repli', 'retrait des troupes', 'positionnement',
    'wanajeshi wamefika', 'kupelekwa', 'troop movement', 'reinforcement',
  ]},
  { type: 'humanitarian_access', w: 2.8, cues: [
    'acces humanitaire', 'convoi humanitaire', 'aide humanitaire bloquee',
    'suspension des activites', 'ong suspend', 'corridor humanitaire',
    'msaada wa kibinadamu', 'humanitarian access',
  ]},
  { type: 'thermal_anomaly', w: 4.0, cues: ['anomalie thermique', 'point chaud viirs', 'thermal anomaly'] },
];

/** Cues that suppress a type even when its own cues fire. "Le calme est
 *  revenu après les affrontements" is a situation report, not a clash. */
const SUPPRESSORS: { type: EventType; cues: string[] }[] = [
  { type: 'armed_clash', cues: ['calme est revenu', 'accalmie', 'cessez le feu', 'aucun affrontement', 'situation calme'] },
  { type: 'displacement', cues: ['retour des deplaces', 'sont rentres', 'retour volontaire'] },
];

export interface Classification {
  type: EventType;
  score: number;
  alts: { type: EventType; score: number }[];
  /** Cue phrases that fired, for the explainability panel. */
  evidence: string[];
}

export function classifyEvent(text: string, ex?: Extraction): Classification {
  const f = foldKey(text);
  const scores = new Map<EventType, number>();
  const evidence: string[] = [];

  const bump = (t: EventType, w: number) => scores.set(t, (scores.get(t) ?? 0) + w);

  for (const rule of RULES) {
    for (const cue of rule.cues) {
      if (f.includes(cue)) {
        bump(rule.type, rule.w);
        evidence.push(cue);
        break; // one hit per rule — don't let synonym stuffing inflate
      }
    }
  }

  for (const s of SUPPRESSORS) {
    if (s.cues.some((c) => f.includes(c))) {
      scores.set(s.type, (scores.get(s.type) ?? 0) * 0.25);
    }
  }

  if (ex) {
    /* Actor prior — a group's known repertoire tilts ambiguous text.
       ADF + Beni + "attaque" is a massacre far more often than a clash. */
    const names = [...new Set(ex.actors.map((a) => a.actor.name))];
    for (const n of names) {
      const a = actorByName(n);
      if (!a) continue;
      for (const t of a.repertoire) bump(t as EventType, 0.55);
    }

    /* Two opposed armed actors in one report is the single strongest
       signal for an armed clash. */
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (areOpposed(names[i], names[j])) { bump('armed_clash', 1.8); break; }
      }
    }

    /* Casualty structure. High fatalities with no second armed actor
       reads as a massacre rather than a clash. */
    const { fatalities, abducted, displaced, injured } = ex.casualties;
    if (abducted)  bump('abduction', 1.6);
    if (displaced) bump('displacement', 1.4);
    if (injured && !fatalities) bump('armed_clash', 0.4);
    if (fatalities != null && fatalities >= 8) {
      const armed = names.filter((n) => {
        const a = actorByName(n);
        return a && a.side !== 'civilian';
      });
      if (armed.length <= 1) bump('massacre', 1.9);
      else bump('armed_clash', 0.7);
    }
  }

  if (!scores.size) {
    return { type: 'unknown', score: 0, alts: [], evidence: [] };
  }

  const ranked = [...scores.entries()]
    .map(([type, score]) => ({ type, score }))
    .sort((a, b) => b.score - a.score);

  /* Softmax-normalise so `score` reads as a probability the analyst can
     reason about, rather than an unbounded evidence sum. */
  const expd = ranked.map((r) => ({ ...r, e: Math.exp(r.score / 2) }));
  const z = expd.reduce((s, r) => s + r.e, 0);
  const norm = expd.map((r) => ({ type: r.type, score: r.e / z }));

  return {
    type: norm[0].type,
    score: norm[0].score,
    alts: norm.slice(1, 4),
    evidence: [...new Set(evidence)].slice(0, 6),
  };
}
