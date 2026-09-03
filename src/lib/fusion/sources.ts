/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Source Adapters
   ═══════════════════════════════════════════════════════════════════════

   Four adapters feed the raw topics:

   1. `bridgeIntelEvents` — the existing ACLED / FIRMS / drone feeds,
      re-expressed as RawReports so they enter the same pipeline as
      everything else instead of bypassing it.

   2. `fetchNewsFeeds` — Radio Okapi and Actualité.cd RSS. These are real
      network calls through a CORS relay, and they fail often (the relay
      rate-limits, the outlets rotate their feed paths). Failure is
      expected and handled: the adapter reports its own health and the
      pipeline continues on the other sources.

   3. `SyntheticStream` — a DRC report generator. Its purpose is not
      decoration: it emits *the same incident, multiple times, through
      different source families, with the linguistic variation those
      families actually exhibit* — a Radio Okapi bulletin in formal
      French, three X posts in Swahili with inflated casualty figures and
      hedged framing, an NGO field report a day later with the corrected
      count. That is what makes the deduper, the correlation discount and
      the confidence model observably do their jobs rather than merely
      exist.

   4. `TelecomTelemetry` — per-province connectivity metrics with a
      realistic diurnal cycle, into which outages are injected.
   ═══════════════════════════════════════════════════════════════════════ */

import type { RawReport, SourceType } from './schema';
import type { IntelEvent } from '@/types/intel';
import { PLACES, type Place } from './gazetteer';
import { TOPICS } from './bus';

/* ═══ 1. Bridge from the existing typed feeds ══════════════════════ */

export function bridgeIntelEvents(events: IntelEvent[]): { report: RawReport; topic: string }[] {
  const out: { report: RawReport; topic: string }[] = [];

  for (const e of events) {
    if (e.src === 'acled') {
      const actors = [e.actor1, e.actor2].filter(Boolean).join(' et ');
      const text = [
        e.notes?.trim() ||
        `${e.subtype || e.type} signalé à ${e.location ?? 'localité non précisée'}${actors ? ` impliquant ${actors}` : ''}.`,
        e.fatalities ? `${e.fatalities} morts rapportés.` : '',
        e.location ? `Localité : ${e.location}, ${e.admin1 ?? ''}.` : '',
      ].filter(Boolean).join(' ');

      out.push({
        topic: TOPICS.RAW_NEWS,
        report: {
          source_type: 'acled',
          source_id: `acled:${e.date}:${e.lat.toFixed(3)}:${e.lon.toFixed(3)}:${e.type}`,
          text,
          created_at: e.date ? `${e.date}T12:00:00Z` : new Date().toISOString(),
          geo: { lat: e.lat, lon: e.lon, radius_km: 5 },
          lang: 'fr',
        },
      });
    } else if (e.src === 'firms') {
      out.push({
        topic: TOPICS.RAW_SENSORS,
        report: {
          source_type: 'firms',
          source_id: `firms:${e.date}:${e.time}:${e.lat.toFixed(4)}:${e.lon.toFixed(4)}`,
          text: `Anomalie thermique VIIRS détectée. Puissance radiative ${e.frp?.toFixed(1) ?? '?'} MW, luminosité ${e.brightness?.toFixed(0) ?? '?'} K, confiance capteur ${e.confidence || 'n/a'}.`,
          created_at: firmsTimestamp(e),
          geo: { lat: e.lat, lon: e.lon, radius_km: 0.4 },
          lang: 'fr',
          metrics: { frp: e.frp ?? 0, brightness: e.brightness ?? 0 },
        },
      });
    } else if (e.src === 'drone') {
      out.push({
        topic: TOPICS.RAW_SENSORS,
        report: {
          source_type: 'uas_isr',
          source_id: `uas:${e.id ?? `${e.lat},${e.lon}`}`,
          text: `${e.desc ?? e.type}. Plateforme ${e.platform ?? 'UAS'}, statut ${e.status ?? 'n/a'}.`,
          created_at: new Date().toISOString(),
          geo: { lat: e.lat, lon: e.lon, radius_km: 0.5 },
          lang: 'fr',
        },
      });
    }
  }
  return out;
}

function firmsTimestamp(e: IntelEvent): string {
  if (!e.date) return new Date().toISOString();
  const hhmm = (e.time ?? '0000').padStart(4, '0');
  return `${e.date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`;
}

/* ═══ 2. News RSS ═════════════════════════════════════════════════ */

const FEEDS: { type: SourceType; url: string; label: string }[] = [
  { type: 'radio_okapi',  url: 'https://www.radiookapi.net/rss.xml',   label: 'Radio Okapi' },
  { type: 'actualite_cd', url: 'https://actualite.cd/feed',            label: 'Actualité.cd' },
];

const RELAYS = [
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

export interface FeedResult {
  label: string;
  ok: boolean;
  reports: RawReport[];
  error?: string;
}

/** RSS/Atom item extraction without an XML parser dependency. Feeds in
 *  this region are frequently malformed (unescaped ampersands, mixed
 *  encodings), and a strict DOMParser rejects the whole document over one
 *  bad entity — a regex scan degrades gracefully instead. */
function parseFeedItems(xml: string): { title: string; desc: string; link: string; date: string }[] {
  const items: { title: string; desc: string; link: string; date: string }[] = [];
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const b of blocks.slice(0, 40)) {
    const pick = (tag: string) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      if (!m) return '';
      return decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ')).trim();
    };
    const title = pick('title');
    if (!title) continue;
    items.push({
      title,
      desc: pick('description') || pick('summary') || pick('content:encoded'),
      link: pick('link') || (b.match(/href="([^"]+)"/)?.[1] ?? ''),
      date: pick('pubDate') || pick('published') || pick('updated'),
    });
  }
  return items;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

/** DRC relevance gate. Applied before ingestion, not after — the
 *  reference design filtered inside `on_tweet` *after* the item had
 *  already been pulled through the pipeline. */
const DRC_TERMS = [
  'rdc', 'congo', 'kivu', 'ituri', 'goma', 'bukavu', 'beni', 'butembo',
  'bunia', 'uvira', 'masisi', 'rutshuru', 'walikale', 'fizi', 'kalemie',
  'm23', 'fardc', 'adf', 'codeco', 'wazalendo', 'monusco', 'virunga',
];

export function isDrcRelevant(text: string): boolean {
  const t = text.toLowerCase();
  return DRC_TERMS.some((k) => t.includes(k));
}

export async function fetchNewsFeeds(timeoutMs = 12_000): Promise<FeedResult[]> {
  return Promise.all(FEEDS.map(async (feed) => {
    for (const relay of RELAYS) {
      try {
        const res = await fetch(relay(feed.url), { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) continue;
        const xml = await res.text();
        if (!/<item|<entry/i.test(xml)) continue;

        const reports = parseFeedItems(xml)
          .map((it): RawReport | null => {
            const text = `${it.title}. ${it.desc}`.slice(0, 1200);
            if (!isDrcRelevant(text)) return null;
            const ts = Date.parse(it.date);
            return {
              source_type: feed.type,
              source_id: it.link || `${feed.type}:${it.title.slice(0, 60)}`,
              handle: feed.label,
              url: it.link,
              text,
              created_at: new Date(Number.isFinite(ts) ? ts : Date.now()).toISOString(),
              lang: 'fr',
            };
          })
          .filter((r): r is RawReport => r !== null);

        return { label: feed.label, ok: true, reports };
      } catch { /* try the next relay */ }
    }
    return { label: feed.label, ok: false, reports: [], error: 'relais indisponible' };
  }));
}

/* ═══ 3. Synthetic DRC stream ═════════════════════════════════════ */

interface Incident {
  place: Place;
  type: 'clash' | 'shelling' | 'massacre' | 'abduction' | 'displacement' | 'looting' | 'roadblock' | 'mine' | 'ied';
  actors: [string, string?];
  truth: { fatalities: number; injured: number; displaced: number };
  at: number;
}

/* Weighted hotspot selection — incidents are not uniform over the AOR.
   These weights reflect the actual 2024–2026 conflict geography. */
const HOTSPOTS: { name: string; w: number; types: Incident['type'][]; actors: [string, string?][] }[] = [
  { name: 'Sake',        w: 9, types: ['clash', 'shelling', 'displacement'], actors: [['M23', 'FARDC'], ['M23', 'Wazalendo']] },
  { name: 'Kibumba',     w: 7, types: ['clash', 'shelling'],                 actors: [['M23', 'FARDC']] },
  { name: 'Rutshuru',    w: 7, types: ['clash', 'roadblock', 'displacement'],actors: [['M23', 'FARDC'], ['M23', 'Wazalendo']] },
  { name: 'Kitshanga',   w: 6, types: ['clash', 'looting', 'displacement'],  actors: [['M23', 'Nyatura'], ['Wazalendo', 'M23']] },
  { name: 'Masisi',      w: 6, types: ['clash', 'looting'],                  actors: [['M23', 'APCLS'], ['Nyatura', 'Wazalendo']] },
  { name: 'Rubaya',      w: 4, types: ['mine', 'roadblock'],                 actors: [['M23'], ['Wazalendo']] },
  { name: 'Minova',      w: 5, types: ['clash', 'displacement'],             actors: [['M23', 'FARDC']] },
  { name: 'Beni',        w: 7, types: ['massacre', 'abduction', 'ied'],      actors: [['ADF', 'Civils'], ['ADF', 'FARDC']] },
  { name: 'Oicha',       w: 5, types: ['massacre', 'abduction'],             actors: [['ADF', 'Civils']] },
  { name: 'Eringeti',    w: 4, types: ['massacre', 'ied'],                   actors: [['ADF', 'Civils']] },
  { name: 'Komanda',     w: 4, types: ['massacre', 'abduction'],             actors: [['ADF', 'Civils']] },
  { name: 'Djugu',       w: 6, types: ['massacre', 'displacement', 'looting'],actors: [['CODECO', 'Civils'], ['CODECO', 'Zaïre / FPIC']] },
  { name: 'Drodro',      w: 4, types: ['massacre', 'displacement'],          actors: [['CODECO', 'Civils']] },
  { name: 'Mongbwalu',   w: 3, types: ['mine', 'clash'],                     actors: [['CODECO', 'FARDC']] },
  { name: 'Uvira',       w: 4, types: ['clash', 'roadblock'],                actors: [['Twirwaneho', 'FARDC'], ['RED-Tabara', 'FARDC']] },
  { name: 'Minembwe',    w: 4, types: ['clash', 'displacement'],             actors: [['Twirwaneho', 'Wazalendo']] },
  { name: 'Fizi',        w: 3, types: ['clash', 'looting'],                  actors: [['Mai-Mai Yakutumba', 'FARDC']] },
  { name: 'Kamituga',    w: 3, types: ['mine', 'roadblock'],                 actors: [['Raïa Mutomboki']] },
  { name: 'Walikale',    w: 3, types: ['roadblock', 'mine', 'clash'],        actors: [['Raïa Mutomboki', 'FARDC'], ['Wazalendo']] },
  { name: 'Kanyabayonga',w: 4, types: ['clash', 'displacement'],             actors: [['M23', 'FARDC']] },
  { name: 'Lubero',      w: 3, types: ['clash', 'looting'],                  actors: [['M23', 'Wazalendo'], ['Mai-Mai Mazembe', 'FARDC']] },
  { name: 'Bunagana',    w: 2, types: ['roadblock', 'clash'],                actors: [['M23', 'FARDC']] },
];

const PLACE_BY_NAME = new Map(PLACES.map((p) => [p.name, p]));

/* ── Phrase banks, per source family ────────────────────────────── */

const TYPE_PHRASES: Record<Incident['type'], { fr: string[]; sw: string[]; ln: string[] }> = {
  clash: {
    fr: ['de violents affrontements ont éclaté', 'des accrochages sont signalés', 'des combats ont opposé', 'une offensive a été lancée'],
    sw: ['mapigano makali yamezuka', 'mapambano yameripotiwa', 'vita vimeanza'],
    ln: ['bitumba ebandi', 'etumba esalemi'],
  },
  shelling: {
    fr: ['des obus sont tombés', 'un bombardement a visé', 'des tirs d\'artillerie ont frappé', 'des mortiers ont été tirés sur'],
    sw: ['mabomu yameanguka', 'makombora yamepiga'],
    ln: ['babeti na mabomu'],
  },
  massacre: {
    fr: ['un massacre a été perpétré', 'des civils ont été massacrés', 'une attaque meurtrière a visé les civils'],
    sw: ['mauaji yametokea', 'raia wameuawa kikatili'],
    ln: ['bato ebele bakufi'],
  },
  abduction: {
    fr: ['plusieurs personnes ont été enlevées', 'des civils ont été pris en otage', 'un enlèvement a été signalé'],
    sw: ['watu wametekwa nyara', 'raia wamechukuliwa mateka'],
    ln: ['bakangi bato'],
  },
  displacement: {
    fr: ['des milliers d\'habitants ont fui', 'une vague de déplacement est signalée', 'la population a pris la fuite'],
    sw: ['wakazi wamekimbia', 'watu wengi wamehama'],
    ln: ['bato bakimi mboka'],
  },
  looting: {
    fr: ['des maisons ont été pillées', 'du bétail a été emporté', 'des pillages sont rapportés'],
    sw: ['nyumba zimeporwa', 'mifugo imechukuliwa'],
    ln: ['bayibi biloko'],
  },
  roadblock: {
    fr: ['une barrière illégale a été érigée', 'des taxes illégales sont prélevées', 'l\'axe est bloqué'],
    sw: ['kizuizi kimewekwa', 'barabara imefungwa'],
    ln: ['nzela ekangami'],
  },
  mine: {
    fr: ['le carré minier a été investi', 'des creuseurs ont été chassés du site minier', 'le contrôle du site minier a changé de mains'],
    sw: ['eneo la machimbo limevamiwa', 'wachimbaji wamefukuzwa'],
    ln: ['esika ya mine ebotolami'],
  },
  ied: {
    fr: ['un engin explosif improvisé a explosé', 'une bombe artisanale a détoné'],
    sw: ['kifaa cha kulipuka kimelipuka'],
    ln: ['bombe epanzani'],
  },
};

/* Time phrases are selected by how long *after* the incident a report was
   filed, not at random. A wire story filed 30 h later says "hier"; a
   tweet filed 20 minutes later says "ce matin". Getting this right is
   what lets the extractor's relative-time resolution recover the true
   incident time from the prose — and it is the difference between the
   deduper seeing one incident and seeing three. */
const TIME_PHRASES: { maxLagH: number; fr: string[]; sw: string[]; ln: string[] }[] = [
  { maxLagH: 6,  fr: ['ce matin', 'cet après-midi', 'il y a quelques heures', 'en ce moment'], sw: ['asubuhi ya leo', 'sasa hivi'], ln: ['na tongo'] },
  { maxLagH: 14, fr: ['ce matin', 'dans la nuit', 'aux premières heures', 'cette nuit'],       sw: ['usiku wa manane', 'asubuhi ya leo'], ln: ['na butu'] },
  { maxLagH: 30, fr: ['hier soir', 'hier', 'dans la nuit de la veille'],                        sw: ['jana usiku', 'jioni ya jana'], ln: ['lobi na butu'] },
  { maxLagH: 999,fr: ['avant-hier', 'il y a deux jours', 'en début de semaine'],                sw: ['juzi', 'wiki iliyopita'], ln: ['lobi'] },
];

const HEDGES_FR = ['aurait', 'selon des sources locales', 'selon des témoins', 'des informations non confirmées font état de'];

let seedCounter = 0;

/** Deterministic-ish RNG so a session's stream is reproducible when
 *  seeded, which matters for demonstrating the same fusion behaviour
 *  twice. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SyntheticStream {
  private rnd: () => number;
  private incidents: Incident[] = [];
  /** Active offensive: a hotspot whose incident rate is multiplied for a
   *  bounded period. Conflict is not stationary — it comes in campaigns
   *  along an axis, and a stream without them gives the spatio-temporal
   *  scan nothing real to find, which makes the detector look broken when
   *  it is in fact correctly reporting no anomaly. */
  private campaign: { hotspot: string; until: number; multiplier: number } | null = null;

  constructor(seed = 20260903) {
    this.rnd = mulberry32(seed);
  }

  private pick<T>(xs: T[]): T { return xs[Math.floor(this.rnd() * xs.length)]; }

  /** Neighbouring hotspots move together — an offensive on Sake pulls in
   *  Kitshanga, Masisi and Minova, not a random locality 400 km away. */
  private campaignCluster(seedName: string): Set<string> {
    const seedPlace = PLACE_BY_NAME.get(seedName);
    if (!seedPlace) return new Set([seedName]);
    const near = HOTSPOTS.filter((h) => {
      const p = PLACE_BY_NAME.get(h.name);
      if (!p) return false;
      const dLat = (p.lat - seedPlace.lat) * 110.57;
      const dLon = (p.lon - seedPlace.lon) * 111.32 * Math.cos((p.lat * Math.PI) / 180);
      return Math.hypot(dLat, dLon) <= 32;
    });
    return new Set(near.map((h) => h.name));
  }

  private weightedHotspot(now: number) {
    // Start or expire a campaign.
    if (this.campaign && now > this.campaign.until) this.campaign = null;
    if (!this.campaign && this.rnd() < 0.012) {
      const seed = HOTSPOTS[Math.floor(this.rnd() * HOTSPOTS.length)];
      this.campaign = {
        hotspot: seed.name,
        until: now + (36 + this.rnd() * 96) * 3600_000,
        multiplier: 5 + this.rnd() * 7,
      };
    }

    const boosted = this.campaign ? this.campaignCluster(this.campaign.hotspot) : null;
    const weightOf = (h: typeof HOTSPOTS[number]) =>
      boosted?.has(h.name) ? h.w * this.campaign!.multiplier : h.w;

    const total = HOTSPOTS.reduce((s, h) => s + weightOf(h), 0);
    let r = this.rnd() * total;
    for (const h of HOTSPOTS) { r -= weightOf(h); if (r <= 0) return h; }
    return HOTSPOTS[0];
  }

  /** The offensive currently in progress, for the UI to label. */
  activeCampaign(now = Date.now()): { hotspot: string; until: number } | null {
    return this.campaign && now <= this.campaign.until
      ? { hotspot: this.campaign.hotspot, until: this.campaign.until }
      : null;
  }

  /** Create a new ground-truth incident. */
  newIncident(at = Date.now()): Incident | null {
    const spot = this.weightedHotspot(at);
    const place = PLACE_BY_NAME.get(spot.name)
      ?? PLACES.find((p) => p.name.toLowerCase().includes(spot.name.toLowerCase()));
    if (!place) return null;

    const type = this.pick(spot.types);
    const actors = this.pick(spot.actors);

    // Casualty magnitude by type, long-tailed.
    const base = { clash: 6, shelling: 5, massacre: 14, abduction: 0, displacement: 0, looting: 1, roadblock: 0, mine: 2, ied: 3 }[type];
    const fatalities = base === 0 ? 0 : Math.max(0, Math.round(base * (0.3 + this.rnd() * 1.8)));

    const inc: Incident = {
      place, type, actors,
      truth: {
        fatalities,
        injured: Math.round(fatalities * (0.6 + this.rnd() * 1.4)),
        displaced: type === 'displacement' || type === 'clash'
          ? Math.round(500 + this.rnd() * 22_000) : 0,
      },
      at: at - Math.floor(this.rnd() * 8 * 3600_000),
    };
    this.incidents.push(inc);
    if (this.incidents.length > 60) this.incidents.shift();
    return inc;
  }

  /** Emit one report *about* an incident, from a given source family.
   *  Each family distorts differently — that distortion is the whole
   *  point: it is what the fusion layer has to see through. */
  report(inc: Incident, sourceType: SourceType): RawReport {
    const id = `syn-${Date.now().toString(36)}-${(seedCounter++).toString(36)}`;
    const place = inc.place.name;
    const [a1, a2] = inc.actors;

    // Reporting delay by family: wires are slowest, social is instant.
    const delayH = {
      radio_okapi: 3, actualite_cd: 4, acled: 30, ocha: 24, monusco: 8,
      twitter_unverified: 0.3, twitter_verified: 1, telegram: 0.5,
      ngo_field: 14, civil_society: 10, sms_gateway: 1, fardc: 6,
    }[sourceType as string] ?? 5;
    const lagH = delayH * (0.5 + this.rnd());
    const created = new Date(inc.at + lagH * 3600_000).toISOString();

    // Casualty distortion: social media inflates, official sources
    // understate, field reports are closest to truth.
    const bias = {
      twitter_unverified: 2.2, telegram: 1.8, twitter_verified: 1.3, facebook: 2.0,
      fardc: 0.45, gov_provincial: 0.6,
      ngo_field: 1.0, ocha: 1.0, acled: 1.0, monusco: 0.95,
      radio_okapi: 1.15, actualite_cd: 1.2, civil_society: 1.25, sms_gateway: 1.4,
    }[sourceType as string] ?? 1.2;
    const fat = Math.round(inc.truth.fatalities * bias * (0.75 + this.rnd() * 0.5));

    const lang: 'fr' | 'sw' | 'ln' =
      sourceType === 'twitter_unverified' || sourceType === 'sms_gateway'
        ? (this.rnd() < 0.4 ? 'sw' : this.rnd() < 0.12 ? 'ln' : 'fr')
        : 'fr';

    const phrases = TYPE_PHRASES[inc.type];
    const verb = this.pick(phrases[lang] ?? phrases.fr);
    const band = TIME_PHRASES.find((b) => lagH <= b.maxLagH) ?? TIME_PHRASES[TIME_PHRASES.length - 1];
    const when = this.pick(band[lang] ?? band.fr);

    let text: string;
    if (lang === 'sw') {
      text = `${when.charAt(0).toUpperCase() + when.slice(1)}, ${verb} ${place}${a2 ? `, ${a1} na ${a2}` : ` na ${a1}`}. ${fat > 0 ? `Watu ${fat} wameuawa.` : ''} ${inc.truth.displaced > 0 ? `Wakazi wengi wamekimbia.` : ''}`;
    } else if (lang === 'ln') {
      text = `${when}, ${verb} na ${place}. ${a1}${a2 ? ` na ${a2}` : ''}. ${fat > 0 ? `Bato ${fat} bakufi.` : ''}`;
    } else {
      const hedge = ['twitter_unverified', 'telegram', 'facebook', 'sms_gateway'].includes(sourceType) && this.rnd() < 0.55
        ? `${this.pick(HEDGES_FR)} ` : '';
      const actorClause = a2 ? `entre ${a1} et ${a2}` : `impliquant ${a1}`;
      text = `${capitalise(when)}, ${hedge}${verb} à ${place} ${actorClause}. ` +
        (fat > 0 ? `Un bilan provisoire fait état de ${fat} morts` : 'Aucun bilan n\'est disponible dans l\'immédiat') +
        (inc.truth.injured > 0 && fat > 0 ? ` et de ${Math.round(inc.truth.injured * bias)} blessés. ` : '. ') +
        (inc.truth.displaced > 500 ? `Des milliers d'habitants ont fui vers ${nearbyRefuge(inc.place)}. ` : '') +
        `${inc.place.territory ?? inc.place.province}, ${inc.place.province}.`;
    }

    const handle = {
      twitter_unverified: this.pick(['@KivuAlerte', '@InfoNordKivu237', '@RDC_Urgence', '@BeniLive24']),
      twitter_verified: this.pick(['@ActualiteCD', '@RadioOkapi', '@MONUSCO']),
      telegram: this.pick(['t.me/kivu_reports', 't.me/ituri_info', 't.me/rdc_securite']),
      ngo_field: this.pick(['NRC Nord-Kivu', 'MSF Rutshuru', 'Caritas Butembo', 'Oxfam Sud-Kivu']),
      civil_society: this.pick(['Société civile Beni', 'Baraza la Wazee Masisi', 'CRD Ituri']),
      radio_okapi: 'Radio Okapi',
      actualite_cd: 'Actualité.cd',
      sms_gateway: this.pick(['SMS-243-Nord', 'SMS-243-Sud']),
    }[sourceType as string];

    return {
      source_type: sourceType,
      source_id: id,
      handle,
      text: text.replace(/\s+/g, ' ').trim(),
      created_at: created,
      lang,
      // Only a minority of social posts carry real coordinates, and when
      // they do it's the poster's location, not the incident's.
      geo: sourceType === 'twitter_unverified' && this.rnd() < 0.12
        ? { lat: inc.place.lat + (this.rnd() - 0.5) * 0.15, lon: inc.place.lon + (this.rnd() - 0.5) * 0.15, radius_km: 12 }
        : undefined,
    };
  }

  /**
   * One tick of the stream. Occasionally starts a new incident; then emits
   * reports about recent incidents from a realistic mix of source
   * families — deliberately including echo chambers (several social posts
   * about one incident) so the correlation discount is exercised.
   */
  tick(now = Date.now()): { report: RawReport; topic: string }[] {
    const out: { report: RawReport; topic: string }[] = [];

    // Incident rate rises during a campaign, not just its geography.
    const inCampaign = !!this.campaign && now <= this.campaign.until;
    const rate = inCampaign ? 0.95 : 0.45;
    const births = inCampaign ? 2 : 1;
    for (let b = 0; b < births; b++) {
     if (this.rnd() < rate || this.incidents.length < 3) {
      const inc = this.newIncident(now);
      if (inc) {
        // Break the story on fast sources first.
        const breakers: SourceType[] = ['twitter_unverified', 'telegram', 'sms_gateway'];
        const n = 1 + Math.floor(this.rnd() * 3);
        for (let i = 0; i < n; i++) {
          out.push({ report: this.report(inc, this.pick(breakers)), topic: TOPICS.RAW_SOCIAL });
        }
      }
     }
    }

    // Follow-up reporting on recent incidents.
    const recent = this.incidents.filter((i) => now - i.at < 36 * 3600_000);
    for (const inc of recent) {
      if (this.rnd() > 0.30) continue;
      const roll = this.rnd();
      if (roll < 0.30) {
        out.push({ report: this.report(inc, this.pick(['radio_okapi', 'actualite_cd'] as SourceType[])), topic: TOPICS.RAW_NEWS });
      } else if (roll < 0.55) {
        out.push({ report: this.report(inc, this.pick(['ngo_field', 'civil_society'] as SourceType[])), topic: TOPICS.RAW_FIELD });
      } else if (roll < 0.72) {
        out.push({ report: this.report(inc, 'monusco'), topic: TOPICS.RAW_FIELD });
      } else if (roll < 0.82) {
        out.push({ report: this.report(inc, 'fardc'), topic: TOPICS.RAW_NEWS });
      } else {
        // Social echo — several accounts, one underlying story.
        const k = 1 + Math.floor(this.rnd() * 4);
        for (let i = 0; i < k; i++) {
          out.push({ report: this.report(inc, 'twitter_unverified'), topic: TOPICS.RAW_SOCIAL });
        }
      }
    }
    return out;
  }

  /**
   * Seed the window with a plausible history.
   *
   * Two densities, deliberately. The recent window gets full reporting
   * density because that is what the analyst works on. The preceding
   * weeks get a sparse spine — enough to give the spatio-temporal scan a
   * baseline rate to test against, without flooding the dedupe window.
   * Without that baseline the scan statistic has no null to compare to
   * and reports nothing, which is the difference between "7 incidents
   * near Sake" and "a significant cluster forming near Sake".
   */
  backfill(recentHours = 72, baselineDays = 30, now = Date.now()): { report: RawReport; topic: string }[] {
    const out: { report: RawReport; topic: string }[] = [];

    /* Historical spine: one or two incidents per sampling, every 4 h,
       with single-source reporting only (no multi-source echo, which
       would blow up the dedupe window for no analytic gain).

       Density is set to ~4–6 incidents/day, which is the order ACLED
       actually records across Nord-Kivu, Sud-Kivu and Ituri combined.
       This is not cosmetic: the spatio-temporal scan estimates each
       cylinder's expected rate from this period, and a thin baseline
       makes those estimates so uncertain that no real excess can clear
       the multiple-testing correction. Starving the baseline doesn't
       make the detector quiet, it makes it blind. */
    for (let h = baselineDays * 24; h > recentHours; h -= 4) {
      const t = now - h * 3600_000;
      if (this.rnd() > 0.80) continue;
      const n = this.rnd() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const inc = this.newIncident(t);
        if (!inc) continue;
        out.push({
          report: this.report(inc, this.pick(['radio_okapi', 'actualite_cd', 'ngo_field'] as SourceType[])),
          topic: TOPICS.RAW_NEWS,
        });
      }
    }

    // Full-density recent window. An offensive is forced to open partway
    // through it so the seeded state always contains one genuine
    // emerging cluster for the scan statistic to find — and so the
    // detector's output can be checked against a known ground truth
    // rather than merely trusted.
    const campaignStart = Math.floor(recentHours * 0.55);
    for (let h = recentHours; h > 0; h -= 2) {
      const t = now - h * 3600_000;
      if (h <= campaignStart && !this.campaign) {
        /* Open the front on a *previously quieter* axis. An escalation
           where fighting was already heaviest is the one an analyst
           already knows about; a front opening where the baseline was
           thin is the one that has to be caught, and it is the case a
           scan statistic exists to detect. */
        const quiet = HOTSPOTS.filter((h2) => h2.w <= 4);
        const seed = quiet[Math.floor(this.rnd() * quiet.length)] ?? HOTSPOTS[0];
        this.campaign = {
          hotspot: seed.name,
          until: t + (60 + this.rnd() * 60) * 3600_000,
          multiplier: 18 + this.rnd() * 10,
        };
      }
      out.push(...this.tick(t));
    }
    return out;
  }
}

function capitalise(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function nearbyRefuge(p: Place): string {
  const candidates = PLACES
    .filter((q) => q.province === p.province && q.name !== p.name && (q.pop ?? 0) > 40_000)
    .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0));
  return candidates[0]?.name ?? 'les localités voisines';
}

/* ═══ 4. Telecom telemetry ════════════════════════════════════════ */

export const MONITORED_PROVINCES = [
  'Nord-Kivu', 'Sud-Kivu', 'Ituri', 'Tanganyika', 'Maniema',
] as const;

/** Baseline subscribers per province, in thousands of concurrent users. */
const SUBSCRIBER_BASE: Record<string, number> = {
  'Nord-Kivu': 820, 'Sud-Kivu': 690, 'Ituri': 430,
  'Tanganyika': 210, 'Maniema': 140,
};

/** Diurnal shape: fraction of daily peak by UTC hour. DRC is UTC+2, so
 *  the evening peak sits around 17:00–19:00 UTC. */
const DIURNAL = [
  0.22, 0.18, 0.16, 0.15, 0.16, 0.22, 0.34, 0.48, 0.62, 0.72, 0.78, 0.82,
  0.84, 0.86, 0.88, 0.92, 0.97, 1.00, 0.98, 0.88, 0.72, 0.56, 0.40, 0.29,
];

export class TelecomTelemetry {
  private rnd: () => number;
  /** province → { untilMs, severity } while an outage is in progress. */
  private outages = new Map<string, { until: number; severity: number }>();

  constructor(seed = 77) { this.rnd = mulberry32(seed); }

  sample(province: string, at: Date): number {
    const base = SUBSCRIBER_BASE[province] ?? 100;
    const h = at.getUTCHours();
    const frac = DIURNAL[h];
    // Weekend traffic runs slightly lower and flatter.
    const day = at.getUTCDay();
    const weekend = day === 0 || day === 6 ? 0.92 : 1;
    let v = base * frac * weekend * (0.96 + this.rnd() * 0.08);

    const out = this.outages.get(province);
    if (out) {
      if (at.getTime() > out.until) this.outages.delete(province);
      else v *= 1 - out.severity;
    }
    return Math.round(v);
  }

  /** Inject an outage — deliberate shutdown, tower damage, or fibre cut. */
  injectOutage(province: string, hours: number, severity = 0.7, from = Date.now()): void {
    this.outages.set(province, { until: from + hours * 3600_000, severity });
  }

  isOutageActive(province: string, at = Date.now()): boolean {
    const o = this.outages.get(province);
    return !!o && at <= o.until;
  }

  /** Emit telemetry as sensor reports so connectivity anomalies flow
   *  through the same pipeline as everything else. */
  report(province: string, value: number, at: Date): RawReport {
    return {
      source_type: 'telecom',
      source_id: `telecom:${province}:${at.toISOString()}`,
      handle: `Opérateur agrégé — ${province}`,
      text: `Télémétrie de connectivité mobile, ${province} : ${value} milliers d'abonnés actifs simultanés.`,
      created_at: at.toISOString(),
      lang: 'fr',
      metrics: { active_users_k: value },
    };
  }
}
