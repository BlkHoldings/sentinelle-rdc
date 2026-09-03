/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Armed Actor Lexicon
   ═══════════════════════════════════════════════════════════════════════

   Generic NER tags "M23" as a product code, "Wazalendo" as O, and
   "FARDC" as ORG with no notion that it is a state actor. Worse, it will
   happily emit "Nord" and "Kivu" as separate ORG spans. A curated actor
   lexicon with alias/orthography variants is the only thing that gets
   actor extraction above chance on Kivu reporting.

   Aliases cover: official French names, English press forms, Swahili and
   Lingala renderings, common abbreviations, and the orthographic drift
   seen on social media (e.g. "wazalendos", "M-23", "codeco/urdpc").
   ═══════════════════════════════════════════════════════════════════════ */

import { foldKey } from './gazetteer';

export type ActorSide =
  | 'state'          // FARDC, PNC, ANR
  | 'state_allied'   // Wazalendo coalition, allied Mai-Mai, SAMIDRC
  | 'nsag'           // non-state armed group
  | 'foreign_state'  // RDF, UPDF, BNDF
  | 'peacekeeping'   // MONUSCO, FIB
  | 'criminal'
  | 'civilian';

export interface Actor {
  name: string;
  side: ActorSide;
  /** Primary provinces of operation — used to sanity-check extractions
   *  (an "ADF" mention geolocated to Uvira is worth flagging). */
  aor: string[];
  /** Typical event repertoire — feeds the classifier's actor prior. */
  repertoire: string[];
  aliases: string[];
  /** Rough strength estimate, for the entity order-of-battle panel. */
  strength?: string;
}

export const ACTORS: Actor[] = [
  {
    name: 'M23', side: 'nsag',
    aor: ['Nord-Kivu', 'Sud-Kivu'],
    repertoire: ['armed_clash', 'shelling', 'displacement', 'troop_movement', 'roadblock'],
    strength: '6 000–8 000',
    aliases: [
      'm23', 'm 23', 'm-23', 'mouvement du 23 mars', 'mouvement du 23 mars',
      'afc m23', 'afc', 'alliance fleuve congo', 'rebelles du m23',
      'waasi wa m23', 'batu ya m23',
    ],
  },
  {
    name: 'FARDC', side: 'state',
    aor: ['Nord-Kivu', 'Sud-Kivu', 'Ituri', 'Tanganyika', 'Maniema'],
    repertoire: ['armed_clash', 'shelling', 'airstrike', 'troop_movement', 'arrest'],
    strength: '~130 000 national',
    aliases: [
      'fardc', 'f a r d c', 'forces armees de la republique democratique du congo',
      'forces armees congolaises', 'armee congolaise', 'armee nationale',
      'jeshi la congo', 'jeshi la fardc', 'basoda ya congo', 'militaires fardc',
      'ufardc', 'fac',
    ],
  },
  {
    name: 'ADF', side: 'nsag',
    aor: ['Nord-Kivu', 'Ituri'],
    repertoire: ['massacre', 'abduction', 'arson', 'ied', 'armed_clash'],
    strength: '1 500–2 500',
    aliases: [
      'adf', 'a d f', 'allied democratic forces', 'adf nalu', 'adf-nalu',
      'forces democratiques alliees', 'mtm', 'madina at tauheed wau mujahedeen',
      'iscap', 'etat islamique en afrique centrale', 'daesh adf',
      'rebelles adf', 'wauaji wa adf',
    ],
  },
  {
    name: 'CODECO', side: 'nsag',
    aor: ['Ituri'],
    repertoire: ['massacre', 'armed_clash', 'arson', 'displacement', 'mine_incident'],
    strength: '3 000–5 000 (fragmenté)',
    aliases: [
      'codeco', 'co deco', 'cooperative pour le developpement du congo',
      'cooperative pour le developpement economique du congo',
      'urdpc codeco', 'urdpc', 'ald codeco', 'miliciens codeco', 'milice codeco',
    ],
  },
  {
    name: 'Zaïre / FPIC', side: 'nsag',
    aor: ['Ituri'],
    repertoire: ['massacre', 'armed_clash', 'arson', 'displacement'],
    strength: '1 000–2 000',
    aliases: [
      'zaire', 'milice zaire', 'miliciens zaire', 'fpic',
      'force patriotique et integrationniste du congo', 'groupe zaire',
    ],
  },
  {
    name: 'FRPI', side: 'nsag',
    aor: ['Ituri'],
    repertoire: ['armed_clash', 'looting', 'roadblock', 'sexual_violence'],
    aliases: ['frpi', 'force de resistance patriotique de l ituri', 'force de resistance patriotique'],
  },
  {
    name: 'FDLR', side: 'nsag',
    aor: ['Nord-Kivu', 'Sud-Kivu'],
    repertoire: ['armed_clash', 'looting', 'abduction', 'mine_incident'],
    strength: '1 000–1 500',
    aliases: [
      'fdlr', 'f d l r', 'forces democratiques de liberation du rwanda',
      'fdlr foca', 'foca', 'interahamwe', 'cnrd', 'cnrd ubwiyunge',
    ],
  },
  {
    name: 'Wazalendo', side: 'state_allied',
    aor: ['Nord-Kivu', 'Sud-Kivu'],
    repertoire: ['armed_clash', 'roadblock', 'looting', 'troop_movement'],
    strength: 'coalition, 10 000+ estimé',
    aliases: [
      'wazalendo', 'wazalendos', 'vdp', 'volontaires pour la defense de la patrie',
      'patriotes', 'groupe wazalendo', 'coalition wazalendo', 'mwazalendo',
    ],
  },
  {
    name: 'Nyatura', side: 'nsag',
    aor: ['Nord-Kivu'],
    repertoire: ['armed_clash', 'looting', 'roadblock', 'abduction'],
    aliases: [
      'nyatura', 'nyatura cmc', 'cmc nyatura', 'collectif des mouvements pour le changement',
      'nyatura fdp', 'nyatura jm',
    ],
  },
  {
    name: 'APCLS', side: 'nsag',
    aor: ['Nord-Kivu'],
    repertoire: ['armed_clash', 'roadblock', 'troop_movement'],
    aliases: [
      'apcls', 'alliance des patriotes pour un congo libre et souverain',
      'alliance des patriotes',
    ],
  },
  {
    name: 'Raïa Mutomboki', side: 'nsag',
    aor: ['Sud-Kivu', 'Maniema'],
    repertoire: ['armed_clash', 'looting', 'mine_incident', 'roadblock'],
    aliases: [
      'raia mutomboki', 'raia mutomboki', 'rm', 'raiya mutomboki',
      'milice raia mutomboki',
    ],
  },
  {
    name: 'Mai-Mai Yakutumba', side: 'nsag',
    aor: ['Sud-Kivu'],
    repertoire: ['armed_clash', 'roadblock', 'looting'],
    aliases: [
      'yakutumba', 'mai mai yakutumba', 'mayi mayi yakutumba', 'mmy',
      'william amuri yakutumba',
    ],
  },
  {
    name: 'Mai-Mai Mazembe', side: 'nsag',
    aor: ['Nord-Kivu'],
    repertoire: ['armed_clash', 'abduction', 'looting'],
    aliases: ['mazembe', 'mai mai mazembe', 'mayi mayi mazembe'],
  },
  {
    name: 'Mai-Mai Kifuafua', side: 'nsag',
    aor: ['Nord-Kivu', 'Sud-Kivu'],
    repertoire: ['armed_clash', 'roadblock'],
    aliases: ['kifuafua', 'mai mai kifuafua', 'mayi mayi kifuafua'],
  },
  {
    name: 'Twirwaneho', side: 'nsag',
    aor: ['Sud-Kivu'],
    repertoire: ['armed_clash', 'displacement', 'arson'],
    aliases: ['twirwaneho', 'twirwaneho gumino', 'gumino', 'autodefense banyamulenge'],
  },
  {
    name: 'Biloze Bishambuke', side: 'nsag',
    aor: ['Sud-Kivu'],
    repertoire: ['armed_clash', 'arson', 'looting'],
    aliases: ['biloze bishambuke', 'biloze', 'bishambuke', 'android'],
  },
  {
    name: 'RED-Tabara', side: 'nsag',
    aor: ['Sud-Kivu'],
    repertoire: ['armed_clash', 'troop_movement'],
    aliases: [
      'red tabara', 'red-tabara', 'resistance pour un etat de droit',
      'resistance pour un etat de droit au burundi',
    ],
  },
  {
    name: 'FNL', side: 'nsag',
    aor: ['Sud-Kivu'],
    repertoire: ['armed_clash', 'looting'],
    aliases: ['fnl', 'forces nationales de liberation', 'fnl nzabampema'],
  },
  {
    name: 'RDF', side: 'foreign_state',
    aor: ['Nord-Kivu', 'Sud-Kivu'],
    repertoire: ['armed_clash', 'shelling', 'troop_movement'],
    aliases: [
      'rdf', 'r d f', 'rwanda defence force', 'rwanda defense force',
      'armee rwandaise', 'forces rwandaises', 'militaires rwandais',
      'jeshi la rwanda', 'rpa',
    ],
  },
  {
    name: 'UPDF', side: 'foreign_state',
    aor: ['Nord-Kivu', 'Ituri'],
    repertoire: ['armed_clash', 'airstrike', 'troop_movement'],
    aliases: [
      'updf', 'u p d f', 'uganda people s defence force', 'armee ougandaise',
      'forces ougandaises', 'operation shujaa', 'shujaa', 'jeshi la uganda',
    ],
  },
  {
    name: 'MONUSCO', side: 'peacekeeping',
    aor: ['Nord-Kivu', 'Sud-Kivu', 'Ituri'],
    repertoire: ['troop_movement', 'humanitarian_access', 'armed_clash'],
    aliases: [
      'monusco', 'monuc', 'mission de l organisation des nations unies',
      'casques bleus', 'onu rdc', 'fib', 'brigade d intervention',
      'force intervention brigade', 'walinda amani',
    ],
  },
  {
    name: 'SAMIDRC', side: 'peacekeeping',
    aor: ['Nord-Kivu', 'Sud-Kivu'],
    repertoire: ['troop_movement', 'armed_clash'],
    aliases: [
      'samidrc', 'sami drc', 'sadc mission in drc', 'mission de la sadc',
      'forces de la sadc', 'sandf', 'contingent sud africain',
    ],
  },
  {
    name: 'PNC', side: 'state',
    aor: ['Nord-Kivu', 'Sud-Kivu', 'Ituri'],
    repertoire: ['arrest', 'protest', 'roadblock'],
    aliases: [
      'pnc', 'police nationale congolaise', 'police nationale', 'la police',
      'polisi', 'agents de la pnc',
    ],
  },
  {
    name: 'ANR', side: 'state',
    aor: ['Nord-Kivu', 'Sud-Kivu', 'Ituri'],
    repertoire: ['arrest'],
    aliases: ['anr', 'agence nationale de renseignement', 'services de renseignement'],
  },
  {
    name: 'Civils', side: 'civilian',
    aor: [],
    repertoire: ['displacement', 'protest', 'massacre'],
    aliases: [
      'civils', 'population civile', 'populations civiles', 'habitants',
      'villageois', 'raia', 'wananchi', 'bato ya mboka', 'deplaces',
      'societe civile',
    ],
  },
];

/* ── Alias index ────────────────────────────────────────────────── */

const ACTOR_INDEX = new Map<string, Actor>();
const ACTOR_FIRST_TOKEN = new Map<string, Actor[]>();

for (const a of ACTORS) {
  for (const raw of [a.name, ...a.aliases]) {
    const k = foldKey(raw);
    if (!k) continue;
    if (!ACTOR_INDEX.has(k)) ACTOR_INDEX.set(k, a);
    const head = k.split(' ')[0];
    const bucket = ACTOR_FIRST_TOKEN.get(head);
    if (bucket) { if (!bucket.includes(a)) bucket.push(a); }
    else ACTOR_FIRST_TOKEN.set(head, [a]);
  }
}

export const MAX_ACTOR_TOKENS = Math.max(
  ...[...ACTOR_INDEX.keys()].map((k) => k.split(' ').length),
);

export function lookupActor(name: string): Actor | undefined {
  return ACTOR_INDEX.get(foldKey(name));
}

export function actorCandidatesFor(token: string): Actor[] {
  return ACTOR_FIRST_TOKEN.get(token) ?? [];
}

export function actorByName(name: string): Actor | undefined {
  return ACTORS.find((a) => a.name === name);
}

/** Two actors on opposing sides make an `armed_clash` far more likely
 *  than two actors on the same side — used as a classifier prior. */
export function areOpposed(a: string, b: string): boolean {
  const x = actorByName(a), y = actorByName(b);
  if (!x || !y || x.name === y.name) return false;
  const blocA: ActorSide[] = ['state', 'state_allied', 'peacekeeping'];
  const inA = (s: ActorSide) => blocA.includes(s);
  if (inA(x.side) && inA(y.side)) return false;
  if (x.side === 'civilian' || y.side === 'civilian') return false;
  // Foreign states are opposed to the DRC state bloc; NSAGs to everyone
  // and to each other (Ituri and the Hauts Plateaux are intra-NSAG wars).
  return inA(x.side) !== inA(y.side) || (x.side === 'nsag' && y.side === 'nsag');
}

export const SIDE_COLOR: Record<ActorSide, string> = {
  state:         'text-blu',
  state_allied:  'text-cyn',
  nsag:          'text-alert',
  foreign_state: 'text-mag',
  peacekeeping:  'text-grn',
  criminal:      'text-amb',
  civilian:      'text-t2',
};

export const SIDE_LABEL: Record<ActorSide, string> = {
  state:         'ÉTAT',
  state_allied:  'ALLIÉ ÉTAT',
  nsag:          'GROUPE ARMÉ',
  foreign_state: 'ÉTAT ÉTRANGER',
  peacekeeping:  'MAINTIEN PAIX',
  criminal:      'CRIMINEL',
  civilian:      'CIVIL',
};
