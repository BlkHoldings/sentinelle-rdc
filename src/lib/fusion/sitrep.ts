/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — SITREP Generation
   ═══════════════════════════════════════════════════════════════════════

   The reference `generate_sitrep` hard-coded its own trends:

       report += "- Increase in armed clashes in Rutshuru territory
                  compared to last week.\n"

   A situation report whose "trends" section is a string literal is worse
   than no trends section — it will state a rise on a week when incidents
   fell, and an analyst who catches that once discards the whole product.

   Everything below is computed from the event window: period-over-period
   deltas per territory with a significance test, actor activity shifts,
   detected spatio-temporal clusters, connectivity anomalies, and an
   explicit confidence-and-gaps section naming what the collection did
   *not* see. Nothing in the output is asserted that was not measured.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  EVENT_TYPE_LABEL, EVENT_TYPE_SEVERITY,
  type FusedEvent, type EventType,
} from './schema';
import { spatioTemporalScan, type ScanCluster, type ProvinceMonitor, isOutage } from './anomaly';
import { settlementsWithin } from './geo';

export interface SitrepOptions {
  province?: string;      // omit for all-AOR
  periodHours?: number;   // reporting period, default 24 h
  now?: number;
  analyst?: string;
  monitors?: ProvinceMonitor[];
  /** Minimum confidence for an event to be cited in the highlights. */
  minConfidence?: number;
  classification?: string;
}

export interface TrendLine {
  label: string;
  current: number;
  previous: number;
  deltaPct: number | null;
  /** Whether the change exceeds Poisson noise for these counts. */
  significant: boolean;
  direction: 'up' | 'down' | 'flat';
}

export interface Sitrep {
  title: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  province: string;
  classification: string;
  counts: {
    total: number;
    confirmed: number;
    corroborated: number;
    unverified: number;
    disputed: number;
    fatalities: number;
    fatalitiesRange: [number, number];
    displaced: number;
  };
  highlights: FusedEvent[];
  trends: TrendLine[];
  clusters: ScanCluster[];
  connectivity: { province: string; status: string; detail: string }[];
  actorActivity: { actor: string; current: number; previous: number; deltaPct: number | null }[];
  gaps: string[];
  text: string;
}

/* ── Poisson significance ────────────────────────────────────────
   With small counts, a jump from 3 to 6 incidents is not evidence of
   anything. Two Poisson counts differ significantly at roughly 95 % when
   |a − b| > 1.96·√(a + b). Cheap, and it prevents the report from
   narrating noise as a trend — the single most common failure mode in
   automated situational reporting. */
function poissonSignificant(a: number, b: number): boolean {
  if (a + b < 5) return false;
  return Math.abs(a - b) > 1.96 * Math.sqrt(a + b);
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null; // null = "from zero"
  return ((cur - prev) / prev) * 100;
}

function inWindow(e: FusedEvent, start: number, end: number): boolean {
  const t = new Date(e.timestamp).getTime();
  return Number.isFinite(t) && t >= start && t < end;
}

function matchesProvince(e: FusedEvent, province?: string): boolean {
  if (!province) return true;
  return e.geo?.admin.province === province;
}

/* ── Main generator ──────────────────────────────────────────────── */

export function generateSitrep(events: FusedEvent[], opts: SitrepOptions = {}): Sitrep {
  const now = opts.now ?? Date.now();
  const periodH = opts.periodHours ?? 24;
  const periodMs = periodH * 3600_000;
  const end = now;
  const start = now - periodMs;
  const prevStart = start - periodMs;

  const province = opts.province;
  const minConf = opts.minConfidence ?? 0.45;
  const classification = opts.classification ?? 'SECRET // REL TO USA, COD, UNMISS';

  const scoped = events.filter((e) => matchesProvince(e, province) && e.status !== 'rejected' && e.status !== 'merged');
  const current = scoped.filter((e) => inWindow(e, start, end));
  const previous = scoped.filter((e) => inWindow(e, prevStart, start));

  /* ── Counts ──────────────────────────────────────────────────── */
  const fatalities = current.reduce((s, e) => s + (e.casualties.fatalities ?? 0), 0);
  const fatLow = current.reduce((s, e) => s + (e.casualties.fatalities_range?.[0] ?? e.casualties.fatalities ?? 0), 0);
  const fatHigh = current.reduce((s, e) => s + (e.casualties.fatalities_range?.[1] ?? e.casualties.fatalities ?? 0), 0);
  const displaced = current.reduce((s, e) => s + (e.casualties.displaced ?? 0), 0);

  const counts: Sitrep['counts'] = {
    total: current.length,
    confirmed:    current.filter((e) => e.status === 'confirmed').length,
    corroborated: current.filter((e) => e.status === 'corroborated').length,
    unverified:   current.filter((e) => e.status === 'unverified').length,
    disputed:     current.filter((e) => e.status === 'disputed').length,
    fatalities,
    fatalitiesRange: [fatLow, fatHigh],
    displaced,
  };

  /* ── Highlights: highest priority, above the credibility floor ── */
  const highlights = [...current]
    .filter((e) => e.confidence >= minConf)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  /* ── Trends ──────────────────────────────────────────────────── */
  const trends: TrendLine[] = [];

  // By event type
  const typeCount = (list: FusedEvent[]) => {
    const m = new Map<EventType, number>();
    for (const e of list) m.set(e.event_type, (m.get(e.event_type) ?? 0) + 1);
    return m;
  };
  const curTypes = typeCount(current);
  const prevTypes = typeCount(previous);
  const allTypes = new Set([...curTypes.keys(), ...prevTypes.keys()]);

  for (const t of allTypes) {
    const c = curTypes.get(t) ?? 0;
    const p = prevTypes.get(t) ?? 0;
    if (c + p < 2) continue;
    trends.push({
      label: EVENT_TYPE_LABEL[t],
      current: c, previous: p,
      deltaPct: pctDelta(c, p),
      significant: poissonSignificant(c, p),
      direction: c > p ? 'up' : c < p ? 'down' : 'flat',
    });
  }

  // By territory
  const terrCount = (list: FusedEvent[]) => {
    const m = new Map<string, number>();
    for (const e of list) {
      const k = e.geo?.admin.territory ?? e.geo?.admin.province;
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const curTerr = terrCount(current);
  const prevTerr = terrCount(previous);
  for (const k of new Set([...curTerr.keys(), ...prevTerr.keys()])) {
    const c = curTerr.get(k) ?? 0;
    const p = prevTerr.get(k) ?? 0;
    if (c + p < 3) continue;
    trends.push({
      label: `Territoire — ${k}`,
      current: c, previous: p,
      deltaPct: pctDelta(c, p),
      significant: poissonSignificant(c, p),
      direction: c > p ? 'up' : c < p ? 'down' : 'flat',
    });
  }

  trends.sort((a, b) => {
    if (a.significant !== b.significant) return a.significant ? -1 : 1;
    return Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous);
  });

  /* ── Actor activity ──────────────────────────────────────────── */
  const actorCount = (list: FusedEvent[]) => {
    const m = new Map<string, number>();
    for (const e of list) for (const a of e.actors) m.set(a, (m.get(a) ?? 0) + 1);
    return m;
  };
  const curActors = actorCount(current);
  const prevActors = actorCount(previous);
  const actorActivity = [...new Set([...curActors.keys(), ...prevActors.keys()])]
    .map((a) => ({
      actor: a,
      current: curActors.get(a) ?? 0,
      previous: prevActors.get(a) ?? 0,
      deltaPct: pctDelta(curActors.get(a) ?? 0, prevActors.get(a) ?? 0),
    }))
    .filter((x) => x.current + x.previous >= 2)
    .sort((a, b) => b.current - a.current)
    .slice(0, 8);

  /* ── Emerging clusters ───────────────────────────────────────── */
  const geoEvents = scoped.filter((e) => e.location);
  const clusters = spatioTemporalScan(
    geoEvents
      .filter((e) => new Date(e.timestamp).getTime() >= now - 7 * 86_400_000)
      .map((e) => ({
        lat: e.location!.lat, lon: e.location!.lon,
        t: new Date(e.timestamp).getTime(),
        w: e.confidence * (0.5 + EVENT_TYPE_SEVERITY[e.event_type]),
      })),
    geoEvents
      .filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t < now - 7 * 86_400_000 && t >= now - 60 * 86_400_000;
      })
      .map((e) => ({ lat: e.location!.lat, lon: e.location!.lon, t: new Date(e.timestamp).getTime() })),
    { now, replicas: 99, maxClusters: 4 },
  );

  /* ── Connectivity ────────────────────────────────────────────── */
  const connectivity = (opts.monitors ?? [])
    .filter((m) => !province || m.province === province)
    .map((m) => {
      const out = isOutage(m);
      const hit = m.lastHit;
      return {
        province: m.province,
        status: out ? 'DÉGRADÉ' : hit ? 'SURVEILLÉ' : 'NOMINAL',
        detail: out && hit
          ? `Chute de ${Math.round((1 - hit.value / Math.max(1, hit.expected)) * 100)} % sous la ligne de base horaire (z = ${hit.z}), ${m.runLength} relevés consécutifs.`
          : hit
            ? `Écart ponctuel détecté (z = ${hit.z}), non soutenu.`
            : 'Aucun écart significatif sur la période.',
      };
    });

  /* ── Collection gaps ─────────────────────────────────────────
     Naming what was NOT observed is the part analysts actually need and
     the part automated reports almost always omit. */
  const gaps = computeGaps(current, scoped, province, connectivity);

  const sitrep: Sitrep = {
    title: `SITREP — ${province ?? 'ZONE D\'OPÉRATIONS EST'}`,
    generatedAt: new Date(now).toISOString(),
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    province: province ?? 'Est RDC (Nord-Kivu, Sud-Kivu, Ituri)',
    classification,
    counts, highlights, trends, clusters, connectivity, actorActivity, gaps,
    text: '',
  };

  sitrep.text = renderSitrep(sitrep, opts.analyst, periodH);
  return sitrep;
}

/* ── Gap analysis ────────────────────────────────────────────────── */

function computeGaps(
  current: FusedEvent[],
  all: FusedEvent[],
  province: string | undefined,
  connectivity: { province: string; status: string }[],
): string[] {
  const gaps: string[] = [];

  const singleSource = current.filter((e) => e.independent_sources <= 1);
  if (singleSource.length) {
    gaps.push(
      `${singleSource.length} événement(s) sur ${current.length} reposent sur une seule famille de sources — corroboration indépendante requise avant exploitation.`,
    );
  }

  const unlocated = current.filter((e) => !e.location);
  if (unlocated.length) {
    gaps.push(`${unlocated.length} rapport(s) non géolocalisables — aucun toponyme reconnu dans le texte source.`);
  }

  const disputed = current.filter((e) => e.status === 'disputed');
  if (disputed.length) {
    gaps.push(`${disputed.length} événement(s) contestés : les sources divergent sur la nature ou l'ampleur des faits.`);
  }

  // Territories that were active last month but silent this period —
  // silence is a signal, and usually means access loss, not peace.
  const monthAgo = Date.now() - 30 * 86_400_000;
  const historicTerr = new Set(
    all.filter((e) => new Date(e.timestamp).getTime() >= monthAgo)
       .map((e) => e.geo?.admin.territory).filter(Boolean) as string[],
  );
  const currentTerr = new Set(
    current.map((e) => e.geo?.admin.territory).filter(Boolean) as string[],
  );
  const silent = [...historicTerr].filter((t) => !currentTerr.has(t));
  if (silent.length) {
    gaps.push(
      `Aucun rapport reçu sur la période depuis : ${silent.slice(0, 6).join(', ')}${silent.length > 6 ? `, +${silent.length - 6}` : ''}. Absence de rapport ≠ absence d'incident.`,
    );
  }

  const degraded = connectivity.filter((c) => c.status === 'DÉGRADÉ');
  if (degraded.length) {
    gaps.push(
      `Collecte réduite en ${degraded.map((c) => c.province).join(', ')} : coupure de connectivité active, le volume de rapports y est structurellement sous-estimé.`,
    );
  }

  // Reporting latency
  const lags = current
    .map((e) => (new Date(e.source.ingested_at).getTime() - new Date(e.timestamp).getTime()) / 3600_000)
    .filter((h) => Number.isFinite(h) && h >= 0);
  if (lags.length) {
    const median = [...lags].sort((a, b) => a - b)[Math.floor(lags.length / 2)];
    if (median > 6) {
      gaps.push(`Latence médiane de remontée : ${median.toFixed(1)} h — les événements des dernières heures sont probablement sous-représentés.`);
    }
  }

  if (province) {
    gaps.push(`Périmètre restreint à ${province} ; les effets transfrontaliers et inter-provinciaux ne sont pas couverts par ce rapport.`);
  }

  return gaps;
}

/* ── Rendering ───────────────────────────────────────────────────── */

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return `${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

function fmtDTG(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

/** Names a cluster by the settlements it actually covers. "Axe
 *  Sake–Kirotshe–Minova" is something an analyst can act on; a decimal
 *  coordinate pair is something they have to go look up. */
function describeCluster(c: ScanCluster): string {
  const near = settlementsWithin(c.lat, c.lon, c.radius_km).slice(0, 3);
  const where = near.length
    ? (near.length > 1 ? `axe ${near.map((p) => p.name).join('–')}` : near[0].name)
    : `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`;
  const terr = near[0]?.territory ? ` (${near[0].territory}, ${near[0].province})` : '';
  return `${where}${terr} — rayon ${c.radius_km} km, fenêtre ${c.window_h} h`;
}

function confBand(c: number): string {
  if (c >= 0.85) return 'ÉLEVÉE';
  if (c >= 0.65) return 'MODÉRÉE';
  if (c >= 0.45) return 'FAIBLE';
  return 'TRÈS FAIBLE';
}

export function renderSitrep(s: Sitrep, analyst?: string, periodH = 24): string {
  const L: string[] = [];

  L.push(s.classification);
  L.push('');
  L.push(`${s.title}`);
  L.push(`Période couverte : ${fmtDateTime(s.periodStart)} — ${fmtDateTime(s.periodEnd)} (${periodH} h)`);
  L.push(`Généré : ${fmtDateTime(s.generatedAt)}${analyst ? ` par ${analyst}` : ''}`);
  L.push('');

  /* 1. SITUATION */
  L.push('1. SITUATION GÉNÉRALE');
  L.push(`   Événements retenus sur la période : ${s.counts.total}`);
  L.push(`   ├─ confirmés (adjudication analyste) : ${s.counts.confirmed}`);
  L.push(`   ├─ corroborés (≥2 familles de sources) : ${s.counts.corroborated}`);
  L.push(`   ├─ non vérifiés : ${s.counts.unverified}`);
  L.push(`   └─ contestés : ${s.counts.disputed}`);
  const [lo, hi] = s.counts.fatalitiesRange;
  L.push(
    `   Décès rapportés : ${s.counts.fatalities}` +
    (hi > lo ? ` (fourchette inter-sources ${lo}–${hi})` : ''),
  );
  if (s.counts.displaced > 0) {
    L.push(`   Déplacements rapportés : ~${s.counts.displaced.toLocaleString('fr-FR')} personnes`);
  }
  L.push('');

  /* 2. FAITS SAILLANTS */
  L.push('2. FAITS SAILLANTS');
  if (!s.highlights.length) {
    L.push('   Aucun événement au-dessus du seuil de crédibilité sur la période.');
  }
  for (const e of s.highlights) {
    const place = e.location?.place_name ?? 'localisation indéterminée';
    const terr = e.geo?.admin.territory ? `, ${e.geo.admin.territory}` : '';
    L.push(
      `   • ${fmtDTG(e.timestamp)} | ${EVENT_TYPE_LABEL[e.event_type]} — ${place}${terr}`,
    );
    const bits: string[] = [];
    if (e.actors.length) bits.push(`acteurs : ${e.actors.join(' / ')}`);
    if (e.casualties.fatalities != null && e.casualties.fatalities > 0) {
      bits.push(
        `${e.casualties.fatalities} tué(s)` +
        (e.casualties.fatalities_range && e.casualties.fatalities_range[1] > e.casualties.fatalities_range[0]
          ? ` [${e.casualties.fatalities_range[0]}–${e.casualties.fatalities_range[1]}]` : ''),
      );
    }
    if (e.casualties.displaced) bits.push(`~${e.casualties.displaced.toLocaleString('fr-FR')} déplacés`);
    if (bits.length) L.push(`     ${bits.join(' ; ')}`);
    L.push(
      `     Confiance ${confBand(e.confidence)} (${e.confidence.toFixed(2)}) ` +
      `— ${e.independent_sources} famille(s) de sources, ${e.provenance.length} rapport(s) ; priorité ${e.priority}`,
    );
    if (e.geo?.population_at_risk) {
      L.push(`     Population estimée dans le rayon d'incertitude : ~${e.geo.population_at_risk.toLocaleString('fr-FR')} (modélisée)`);
    }
  }
  L.push('');

  /* 3. TENDANCES */
  L.push(`3. TENDANCES (période courante vs ${periodH} h précédentes)`);
  const shown = s.trends.slice(0, 8);
  if (!shown.length) L.push('   Volume insuffisant pour établir une tendance.');
  for (const t of shown) {
    const arrow = t.direction === 'up' ? '▲' : t.direction === 'down' ? '▼' : '=';
    const pct = t.deltaPct == null
      ? 'nouveau (aucun précédent)'
      : `${t.deltaPct > 0 ? '+' : ''}${t.deltaPct.toFixed(0)} %`;
    const flag = t.significant ? '' : '  [non significatif — bruit de Poisson]';
    L.push(`   ${arrow} ${t.label} : ${t.previous} → ${t.current} (${pct})${flag}`);
  }
  L.push('');

  /* 4. CLUSTERS */
  L.push('4. CONCENTRATIONS SPATIO-TEMPORELLES');
  L.push('   (balayage de Kulldorff ; p-value de Monte-Carlo sur le maximum,');
  L.push('    corrigée du nombre de cylindres testés)');
  const sig = s.clusters.filter((c) => c.significant);
  const watch = s.clusters.filter((c) => !c.significant);
  if (!s.clusters.length) {
    L.push('   Aucune concentration au-delà de la variation attendue.');
  }
  for (const c of sig) {
    L.push(`   ◈ SIGNIFICATIF — ${describeCluster(c)}`);
    L.push(
      `     ${c.events} événements ; observé ${c.observed} vs attendu ${c.expected} ` +
      `(risque relatif ×${c.rr}, LLR ${c.llr}, p = ${c.p})`,
    );
  }
  for (const c of watch) {
    L.push(`   ○ À SURVEILLER — ${describeCluster(c)}`);
    L.push(
      `     ${c.events} événements ; observé ${c.observed} vs attendu ${c.expected} ` +
      `(×${c.rr}, p = ${c.p} — NON significatif après correction)`,
    );
  }
  L.push('');

  /* 5. CONNECTIVITÉ */
  if (s.connectivity.length) {
    L.push('5. CONNECTIVITÉ MOBILE');
    for (const c of s.connectivity) {
      L.push(`   ${c.status.padEnd(10)} ${c.province} — ${c.detail}`);
    }
    L.push('');
  }

  /* 6. ACTIVITÉ DES ACTEURS */
  if (s.actorActivity.length) {
    L.push('6. ACTIVITÉ DES ACTEURS');
    for (const a of s.actorActivity) {
      const pct = a.deltaPct == null ? 'nouveau' : `${a.deltaPct > 0 ? '+' : ''}${a.deltaPct.toFixed(0)} %`;
      L.push(`   ${a.actor.padEnd(24)} ${String(a.previous).padStart(3)} → ${String(a.current).padStart(3)}  (${pct})`);
    }
    L.push('');
  }

  /* 7. LACUNES */
  L.push('LACUNES DE COLLECTE ET RÉSERVES');
  for (const g of s.gaps) L.push(`   – ${g}`);
  if (!s.gaps.length) L.push('   – Aucune lacune structurelle identifiée sur la période.');
  L.push('');

  L.push('NOTE MÉTHODOLOGIQUE');
  L.push('   Les scores de confiance sont issus d\'une fusion bayésienne en log-cotes avec');
  L.push('   décote de corrélation intra-famille : plusieurs reprises d\'une même source ne');
  L.push('   valent pas plusieurs corroborations. Les densités de population et les');
  L.push('   populations exposées sont modélisées, non mesurées. Les tendances marquées');
  L.push('   « non significatif » ne doivent pas être rapportées comme des évolutions.');
  L.push('');
  L.push(s.classification);

  return L.join('\n');
}
