/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Entity & Attribute Extraction
   ═══════════════════════════════════════════════════════════════════════

   Replaces `spacy.load("xx_ent_wiki_sm")` with a domain-tuned extractor:

     1. Fold accents/orthography, tokenise.
     2. Greedy longest-match against the gazetteer and actor lexicon with
        a bounded lookahead window (multi-word names like "Parc National
        des Virunga" or "Mouvement du 23 Mars" match as one span).
     3. Bounded Damerau–Levenshtein fallback for social-media misspellings
        ("Butembu" → Butembo, "Kitchanga" → Kitshanga), gated on length so
        short tokens can't fuzzy-match into the wrong entity.
     4. Casualty extraction over digits *and* spelled-out numerals in
        French, Swahili and Lingala.
     5. Temporal resolution of relative expressions ("hier soir", "jana
        usiku", "lobi", "il y a trois jours") against the report's own
        publication time, with an explicit uncertainty band.
     6. Epistemic hedging detection — the piece the reference spec is
        missing entirely. "Le M23 aurait attaqué" and "Le M23 a attaqué"
        must not produce the same credibility. Hedges, attributions and
        explicit denials all move the Admiralty credibility grade.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  foldKey, lookupPlace, PLACES, MAX_PLACE_TOKENS,
  PROVINCE_CENTROIDS, type Place,
} from './gazetteer';
import {
  lookupActor, ACTORS, MAX_ACTOR_TOKENS, type Actor,
} from './actors';

const placeKeys = (p: Place) => [p.name, ...(p.aliases ?? [])].map(foldKey);
const actorKeys = (a: Actor) => [a.name, ...a.aliases].map(foldKey);

export interface Span {
  text: string;
  start: number;   // token index
  end: number;     // token index, exclusive
  /** 1.0 for exact alias match, <1 for fuzzy. */
  score: number;
}

export interface PlaceMatch extends Span { place: Place }
export interface ActorMatch extends Span { actor: Actor }

export type Certainty = 'asserted' | 'attributed' | 'hedged' | 'denied';

export interface Extraction {
  lang: 'fr' | 'sw' | 'ln' | 'en' | 'unknown';
  places: PlaceMatch[];
  actors: ActorMatch[];
  casualties: {
    fatalities?: number;
    injured?: number;
    abducted?: number;
    displaced?: number;
  };
  /** Resolved event time, or null when the text carries no time cue. */
  when: { iso: string; uncertainty_min: number } | null;
  certainty: Certainty;
  /** The hedging/attribution cue that set `certainty`, for explainability. */
  certainty_cue?: string;
  tokens: string[];
}

/* ── Tokenisation ────────────────────────────────────────────────── */

export function tokenize(text: string): string[] {
  return foldKey(text).split(' ').filter(Boolean);
}

/* ── Bounded Damerau–Levenshtein ─────────────────────────────────
   Returns edit distance, or `max + 1` as soon as it provably exceeds
   `max`. Early exit keeps this cheap inside the hot matching loop. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let cur: number[] = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur; cur = new Array(n + 1);
  }
  return prev[n];
}

/** Fuzzy tolerance scales with length: no fuzz below 5 chars (too many
 *  false hits — "Beni"/"Bени"/"Deni"), 1 edit to 8 chars, 2 above. */
function fuzzBudget(len: number): number {
  if (len < 5) return 0;
  if (len <= 8) return 1;
  return 2;
}

/* ── Generic longest-match scanner ──────────────────────────────── */

interface ScanHit<T> { entity: T; start: number; end: number; score: number; text: string }

function scan<T>(
  tokens: string[],
  maxSpan: number,
  candidatesFor: (tok: string) => T[],
  keysOf: (e: T) => string[],
  exact: (phrase: string) => T | undefined,
): ScanHit<T>[] {
  const hits: ScanHit<T>[] = [];
  const consumed = new Array<boolean>(tokens.length).fill(false);

  // Longest span first so "Mai-Mai Yakutumba" wins over "Yakutumba".
  for (let span = Math.min(maxSpan, tokens.length); span >= 1; span--) {
    for (let i = 0; i + span <= tokens.length; i++) {
      let free = true;
      for (let k = i; k < i + span; k++) if (consumed[k]) { free = false; break; }
      if (!free) continue;

      const phrase = tokens.slice(i, i + span).join(' ');
      const hit = exact(phrase);
      if (hit) {
        hits.push({ entity: hit, start: i, end: i + span, score: 1, text: phrase });
        for (let k = i; k < i + span; k++) consumed[k] = true;
        continue;
      }

      // Fuzzy only for single tokens — multi-word fuzzy explodes the
      // candidate space and produces nonsense matches.
      if (span !== 1) continue;
      const budget = fuzzBudget(phrase.length);
      if (budget === 0) continue;

      let best: T | undefined;
      let bestD = budget + 1;
      for (const cand of candidatesFor(phrase)) {
        for (const key of keysOf(cand)) {
          if (key.includes(' ')) continue;
          const d = editDistance(phrase, key, budget);
          if (d < bestD) { bestD = d; best = cand; }
        }
      }
      if (best && bestD <= budget) {
        hits.push({
          entity: best, start: i, end: i + 1,
          score: 1 - bestD * 0.2, text: phrase,
        });
        consumed[i] = true;
      }
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/* Fuzzy candidate pools keyed on first letter, built lazily. */
const placeByLetter = new Map<string, Place[]>();
const actorByLetter = new Map<string, Actor[]>();

/** Candidate pool for fuzzy matching: entities with any alias whose first
 *  token starts with `letter`. A 1–2 edit typo rarely changes letter 1,
 *  so this prunes the search space by ~25× at negligible recall cost. */
function placesStartingWith(letter: string): Place[] {
  let v = placeByLetter.get(letter);
  if (!v) {
    v = PLACES.filter((p) => placeKeys(p).some((k) => k[0] === letter));
    placeByLetter.set(letter, v);
  }
  return v;
}

function actorsStartingWith(letter: string): Actor[] {
  let v = actorByLetter.get(letter);
  if (!v) {
    v = ACTORS.filter((a) => actorKeys(a).some((k) => k[0] === letter));
    actorByLetter.set(letter, v);
  }
  return v;
}

/* ── Language detection ──────────────────────────────────────────
   Trigram-free, marker-word based. Good enough to route a report to the
   right lexicon; we are not doing translation. */

const LANG_MARKERS: Record<'fr' | 'sw' | 'ln' | 'en', string[]> = {
  fr: ['le','la','les','des','dans','selon','vers','avec','ont','ete','sont','entre','apres','contre','ce','cette','au','aux','du','pour','par','plus','nuit','matin','soir','hier'],
  sw: ['wa','ya','na','katika','kwa','walikuwa','watu','usiku','asubuhi','jana','leo','wamekufa','mji','vita','askari','risasi','wanajeshi','wengi','habari'],
  ln: ['na','ya','mpo','bato','mokolo','lobi','butu','esika','bakufi','mingi','likambo','bitumba','soda','mboka','esalemi'],
  en: ['the','and','was','were','have','been','reported','near','after','with','clash','killed','civilians','sources','forces'],
};

export function detectLanguage(text: string): 'fr' | 'sw' | 'ln' | 'en' | 'unknown' {
  const toks = new Set(tokenize(text));
  let best: 'fr' | 'sw' | 'ln' | 'en' | 'unknown' = 'unknown';
  let bestN = 0;
  (Object.keys(LANG_MARKERS) as ('fr' | 'sw' | 'ln' | 'en')[]).forEach((lang) => {
    let n = 0;
    for (const m of LANG_MARKERS[lang]) if (toks.has(m)) n++;
    // Lingala and Swahili share 'na'/'ya'; require a slightly higher bar
    // for Lingala so Swahili text isn't misrouted.
    const adjusted = lang === 'ln' ? n - 1 : n;
    if (adjusted > bestN) { bestN = adjusted; best = lang; }
  });
  return bestN >= 2 ? best : 'unknown';
}

/* ── Numerals ────────────────────────────────────────────────────── */

const NUMERALS: Record<string, number> = {
  // French
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
  quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  soixante: 60, cent: 100, cents: 100, mille: 1000, milliers: 1000,
  dizaines: 10, centaines: 100,
  // Swahili
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8,
  tisa: 9, kumi: 10, ishirini: 20, thelathini: 30, hamsini: 50, mia: 100, elfu: 1000,
  // Lingala
  moko: 1, mibale: 2, misato: 3, minei: 4, mitano: 5, zomi: 10, nkama: 100, nkoto: 1000,
};

function numAt(tokens: string[], i: number): number | null {
  const t = tokens[i];
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t in NUMERALS) return NUMERALS[t];
  return null;
}

/* Casualty cue words → which bucket they fill. Ordered so that the
   longest/most specific cue is checked first. */
const CASUALTY_CUES: { keys: string[]; field: 'fatalities' | 'injured' | 'abducted' | 'displaced' }[] = [
  { field: 'fatalities', keys: ['morts','mort','tues','tue','tuees','decedes','deces','victimes','cadavres','peris','abattus','wamekufa','waliouawa','waliokufa','marehemu','bakufi','bawei','killed','dead','fatalities'] },
  { field: 'injured',    keys: ['blesses','blesse','blessees','wounded','injured','majeruhi','waliojeruhiwa','bazoki'] },
  { field: 'abducted',   keys: ['enleves','enleve','enlevees','kidnappes','otages','abducted','kidnapped','waliotekwa','watekwa'] },
  { field: 'displaced',  keys: ['deplaces','deplace','deplacees','refugies','fuient','fui','displaced','wakimbizi','waliokimbia','bakimi'] },
];

function extractCasualties(tokens: string[]): Extraction['casualties'] {
  const out: Extraction['casualties'] = {};
  for (let i = 0; i < tokens.length; i++) {
    const cue = CASUALTY_CUES.find((c) => c.keys.includes(tokens[i]));
    if (!cue) continue;
    // Look backwards up to 4 tokens ("au moins douze civils tués"), then
    // forwards up to 3 ("tués: 12", "morts au nombre de 7").
    let n: number | null = null;
    for (let k = 1; k <= 4 && n == null; k++) n = numAt(tokens, i - k);
    for (let k = 1; k <= 3 && n == null; k++) n = numAt(tokens, i + k);
    if (n == null) continue;
    // "des dizaines de morts" → 10 is a floor, not a count; keep the max
    // observed so a later, more specific figure wins.
    const prev = out[cue.field];
    out[cue.field] = prev == null ? n : Math.max(prev, n);
  }
  return out;
}

/* ── Temporal resolution ─────────────────────────────────────────── */

interface TimeCue { keys: string[]; offsetMin: number; uncertaintyMin: number }

const TIME_CUES: TimeCue[] = [
  { keys: ['maintenant','actuellement','sasa','en ce moment'], offsetMin: 0,      uncertaintyMin: 30 },
  { keys: ['ce matin','asubuhi','matin'],                      offsetMin: -300,   uncertaintyMin: 180 },
  { keys: ['cet apres midi','apres midi','mchana'],            offsetMin: -180,   uncertaintyMin: 150 },
  { keys: ['ce soir','soir','jioni'],                          offsetMin: -60,    uncertaintyMin: 120 },
  { keys: ['cette nuit','nuit','usiku','butu'],                offsetMin: -420,   uncertaintyMin: 240 },
  { keys: ['aujourd hui','leo','lelo'],                        offsetMin: -360,   uncertaintyMin: 360 },
  { keys: ['hier','jana','lobi'],                              offsetMin: -1440,  uncertaintyMin: 480 },
  { keys: ['avant hier','juzi'],                               offsetMin: -2880,  uncertaintyMin: 600 },
  { keys: ['la semaine derniere','wiki iliyopita'],            offsetMin: -10080, uncertaintyMin: 3600 },
];

const WEEKDAYS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function resolveTime(
  text: string, tokens: string[], publishedAt: string,
): Extraction['when'] {
  const base = new Date(publishedAt).getTime();
  if (!Number.isFinite(base)) return null;
  const folded = foldKey(text);

  // Explicit clock time — "vers 05h30", "à 21:15", "saa nne".
  const clock = folded.match(/(?:vers|a|autour de|environ)?\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);

  // "il y a N heures/jours"
  const ago = folded.match(/il y a (\d+|un|une|deux|trois|quatre|cinq|six|sept)\s+(minutes?|heures?|jours?)/);
  if (ago) {
    const n = /^\d+$/.test(ago[1]) ? parseInt(ago[1], 10) : (NUMERALS[ago[1]] ?? 1);
    const unit = ago[2].startsWith('minute') ? 1 : ago[2].startsWith('heure') ? 60 : 1440;
    const off = -n * unit;
    return {
      iso: new Date(base + off * 60_000).toISOString(),
      uncertainty_min: unit === 1440 ? 360 : unit === 60 ? 45 : 10,
    };
  }

  for (const cue of TIME_CUES) {
    const hit = cue.keys.find((k) => folded.includes(k));
    if (!hit) continue;
    let t = base + cue.offsetMin * 60_000;
    let unc = cue.uncertaintyMin;
    // A clock time alongside a day cue pins the hour precisely.
    if (clock) {
      const d = new Date(t);
      const hh = parseInt(clock[1], 10);
      const mm = clock[2] ? parseInt(clock[2], 10) : 0;
      if (hh <= 23 && mm <= 59) {
        d.setUTCHours(hh, mm, 0, 0);
        t = d.getTime();
        unc = 45;
      }
    }
    return { iso: new Date(t).toISOString(), uncertainty_min: unc };
  }

  // Bare weekday reference — "dans la nuit de mardi à mercredi".
  const wd = WEEKDAYS.findIndex((d) => tokens.includes(d));
  if (wd >= 0) {
    const now = new Date(base);
    const delta = (now.getUTCDay() - wd + 7) % 7 || 7;
    return {
      iso: new Date(base - delta * 86_400_000).toISOString(),
      uncertainty_min: 720,
    };
  }

  if (clock) {
    const d = new Date(base);
    const hh = parseInt(clock[1], 10);
    const mm = clock[2] ? parseInt(clock[2], 10) : 0;
    if (hh <= 23 && mm <= 59) {
      d.setUTCHours(hh, mm, 0, 0);
      if (d.getTime() > base) d.setUTCDate(d.getUTCDate() - 1);
      return { iso: d.toISOString(), uncertainty_min: 60 };
    }
  }
  return null;
}

/* ── Epistemic certainty ─────────────────────────────────────────
   This is the largest single accuracy win over the reference design.
   Conflict reporting is saturated with conditional and second-hand
   framing; treating "aurait tué 12 personnes" as equivalent to "a tué 12
   personnes" systematically over-confidences the whole feed. */

const DENIAL_CUES = [
  'dement', 'dementi', 'nie', 'nient', 'rejette', 'rejettent', 'faux',
  'infondee', 'infondees', 'aucune attaque', 'pas eu lieu', 'rumeur infondee',
  'denies', 'denied', 'anakanusha', 'si kweli',
];

const HEDGE_CUES = [
  'aurait', 'auraient', 'serait', 'seraient', 'pourrait', 'pourraient',
  'presume', 'presumee', 'suppose', 'supposee', 'non confirme', 'non confirmee',
  'non confirmes', 'a confirmer', 'sous reserve', 'rumeur', 'rumeurs',
  'bruit court', 'on parle de', 'alleged', 'allegedly', 'reportedly',
  'unconfirmed', 'inasemekana', 'yasemekana', 'huenda',
];

const ATTRIBUTION_CUES = [
  'selon', 'd apres', 'affirme', 'affirment', 'declare', 'declarent',
  'rapporte', 'rapportent', 'temoins', 'temoignage', 'sources locales',
  'source locale', 'a indique', 'ont indique', 'according to', 'said',
  'kulingana na', 'alisema', 'walisema', 'vyanzo',
];

function detectCertainty(text: string): { certainty: Certainty; cue?: string } {
  const f = foldKey(text);
  for (const c of DENIAL_CUES)      if (f.includes(c)) return { certainty: 'denied', cue: c };
  for (const c of HEDGE_CUES)       if (f.includes(c)) return { certainty: 'hedged', cue: c };
  for (const c of ATTRIBUTION_CUES) if (f.includes(c)) return { certainty: 'attributed', cue: c };
  return { certainty: 'asserted' };
}

/* ── Public entry point ──────────────────────────────────────────── */

export function extract(text: string, publishedAt: string): Extraction {
  const tokens = tokenize(text);

  const placeHits = scan<Place>(
    tokens, MAX_PLACE_TOKENS,
    (phrase) => placesStartingWith(phrase[0]),
    placeKeys,
    (phrase) => lookupPlace(phrase),
  );
  const actorHits = scan<Actor>(
    tokens, MAX_ACTOR_TOKENS,
    (phrase) => actorsStartingWith(phrase[0]),
    actorKeys,
    (phrase) => lookupActor(phrase),
  );

  const { certainty, cue } = detectCertainty(text);

  return {
    lang: detectLanguage(text),
    places: placeHits.map((h) => ({
      place: h.entity, text: h.text, start: h.start, end: h.end, score: h.score,
    })),
    actors: actorHits.map((h) => ({
      actor: h.entity, text: h.text, start: h.start, end: h.end, score: h.score,
    })),
    casualties: extractCasualties(tokens),
    when: resolveTime(text, tokens, publishedAt),
    certainty,
    certainty_cue: cue,
    tokens,
  };
}

/* ── Geolocation from an extraction ─────────────────────────────── */

/** Picks the best location for an event from the extracted place spans.
 *  Prefers the most specific settlement (smallest radius) over features
 *  and provinces — "affrontements à Kibumba, Nord-Kivu" should resolve to
 *  Kibumba, not to the provincial centroid. */
export function resolveLocation(ex: Extraction): {
  lat: number; lon: number; place_name: string; radius_km: number;
  method: 'gazetteer' | 'admin_centroid' | 'none';
  province?: string; territory?: string;
} | null {
  if (!ex.places.length) return null;

  const specific = ex.places
    .filter((p) => p.place.kind !== 'province' && p.place.kind !== 'feature')
    .sort((a, b) =>
      (b.score - a.score) ||
      (a.place.radius_km - b.place.radius_km) ||
      (a.start - b.start),
    );

  const pick = specific[0] ?? ex.places[0];
  const p = pick.place;

  // Fuzzy-matched places inherit extra positional uncertainty.
  const fuzzPenalty = pick.score < 1 ? 1.5 : 1;

  return {
    lat: p.lat, lon: p.lon,
    place_name: p.name,
    radius_km: p.radius_km * fuzzPenalty,
    method: p.kind === 'province' ? 'admin_centroid' : 'gazetteer',
    province: p.province,
    territory: p.territory,
  };
}

/** Fallback when only a province is named. */
export function provinceCentroid(province: string) {
  return PROVINCE_CENTROIDS[province] ?? null;
}
