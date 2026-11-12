/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Derivations over fused events
   ═══════════════════════════════════════════════════════════════════════

   Everything the feed, the detail panel and the analytical views show is
   computed here from the fusion store. Nothing in this file invents a
   value: a chart with no events behind it is an empty chart.

   Pure functions, no React — tested directly in tests/intel.test.ts.
   ═══════════════════════════════════════════════════════════════════════ */

import type { FusedEvent, EventType, EventStatus, ProvenanceEntry, SourceFamily } from '@/lib/fusion/schema';
import type { TimeRange } from '@/store/useFeedStore';

/* ── Provenance honesty ──────────────────────────────────────────────
   The demonstration stream fabricates reports and signs them with the
   names of real outlets. Those entries are recognisable by their source
   id, and every surface that shows a source must mark them: an invented
   report must never be readable as something a real newsroom published. */

export function isSimulatedSource(p: ProvenanceEntry): boolean {
  const id = p.source.id;
  return id.startsWith('syn-') || id.startsWith('telecom:');
}

export type Origin = 'simulated' | 'mixed' | 'collected';

export function originOf(e: FusedEvent): Origin {
  if (!e.provenance.length) return 'collected';
  const sim = e.provenance.filter(isSimulatedSource).length;
  return sim === 0 ? 'collected' : sim === e.provenance.length ? 'simulated' : 'mixed';
}

/* ── Categories ──────────────────────────────────────────────────── */

export type Category = 'conflict' | 'humanitarian' | 'political' | 'sensor' | 'other';

const CATEGORY: Record<EventType, Category> = {
  armed_clash: 'conflict', shelling: 'conflict', airstrike: 'conflict', drone_strike: 'conflict',
  ied: 'conflict', abduction: 'conflict', massacre: 'conflict', sexual_violence: 'conflict',
  looting: 'conflict', arson: 'conflict', roadblock: 'conflict', mine_incident: 'conflict',
  troop_movement: 'conflict',
  displacement: 'humanitarian', humanitarian_access: 'humanitarian',
  protest: 'political', arrest: 'political',
  comms_blackout: 'sensor', thermal_anomaly: 'sensor',
  /* A report the classifier could not place is not thereby a conflict
     event. Counting it as one would inflate the incident figures with
     every unrelated headline that mentions the region. */
  unknown: 'other',
};

export const categoryOf = (e: FusedEvent): Category => CATEGORY[e.event_type];

/* ── Windows and filters ─────────────────────────────────────────── */

const HOURS: Record<TimeRange, number> = { '24h': 24, '72h': 72, '7d': 168, '30d': 720, all: Infinity };

export function windowStart(range: TimeRange, now = Date.now()): number {
  return HOURS[range] === Infinity ? -Infinity : now - HOURS[range] * 3_600_000;
}

/** Events an analyst should see: published, not folded away. */
export function activeEvents(events: FusedEvent[]): FusedEvent[] {
  return events.filter((e) => e.status !== 'merged' && e.status !== 'rejected');
}

export interface FeedFilter {
  range: TimeRange;
  query?: string;
  category?: Category | 'all';
  status?: EventStatus | 'all';
  province?: string | 'all';
  /** Hide events built only from the demonstration stream. */
  hideSimulated?: boolean;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function provinceOf(e: FusedEvent): string {
  return e.geo?.admin.province ?? '';
}

export function filterFeed(events: FusedEvent[], f: FeedFilter, now = Date.now()): FusedEvent[] {
  const from = windowStart(f.range, now);
  const terms = fold(f.query ?? '').split(/\s+/).filter(Boolean);
  return activeEvents(events)
    .filter((e) => {
      const t = new Date(e.timestamp).getTime();
      if (t < from) return false;
      if (f.category && f.category !== 'all' && categoryOf(e) !== f.category) return false;
      if (f.status && f.status !== 'all' && e.status !== f.status) return false;
      if (f.province && f.province !== 'all' && provinceOf(e) !== f.province) return false;
      if (f.hideSimulated && originOf(e) === 'simulated') return false;
      if (!terms.length) return true;
      const hay = fold([
        e.description, e.location?.place_name ?? '', provinceOf(e), e.geo?.admin.territory ?? '',
        ...e.actors, e.source.handle ?? '',
      ].join(' '));
      return terms.every((x) => hay.includes(x));
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/* ── Per-event timestamps ────────────────────────────────────────── */

/** Earliest publication among contributing reports. */
export function firstPublished(e: FusedEvent): string {
  return e.provenance.reduce((m, p) => (p.source.published_at < m ? p.source.published_at : m), e.source.published_at);
}

/** Latest thing that happened to the record: a new report or an adjudication. */
export function lastUpdated(e: FusedEvent): string {
  let m = e.source.ingested_at;
  for (const p of e.provenance) if (p.source.ingested_at > m) m = p.source.ingested_at;
  for (const a of e.adjudications) if (a.at > m) m = a.at;
  return m;
}

/* ── Series for charts ───────────────────────────────────────────── */

export type DayPoint = { day: string; total: number; conflict: number; humanitarian: number; political: number };

/**
 * One point per calendar day (UTC), oldest first, with empty days kept:
 * a quiet day is a data point, and dropping it would draw a straight
 * line through a gap as if activity had been continuous.
 */
export function dailySeries(events: FusedEvent[], days: number, now = Date.now()): DayPoint[] {
  const out: DayPoint[] = [];
  const index = new Map<string, DayPoint>();
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const p = { day, total: 0, conflict: 0, humanitarian: 0, political: 0 };
    out.push(p); index.set(day, p);
  }
  for (const e of activeEvents(events)) {
    const p = index.get(e.timestamp.slice(0, 10));
    if (!p) continue;
    const c = categoryOf(e);
    if (c === 'sensor' || c === 'other') continue;   // not incidents
    p.total++; p[c]++;
  }
  return out;
}

/** Sum a daily series into ISO-week-ish buckets of 7 days, oldest first. */
export function weeklySeries(daily: DayPoint[]): { label: string; total: number }[] {
  const out: { label: string; total: number }[] = [];
  for (let i = daily.length % 7; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    out.push({ label: chunk[0].day.slice(5), total: chunk.reduce((a, d) => a + d.total, 0) });
  }
  return out;
}

export interface Tally { key: string; count: number; fatalities: number; confirmed: number }

export function tallyBy(events: FusedEvent[], key: (e: FusedEvent) => string): Tally[] {
  const m = new Map<string, Tally>();
  for (const e of events) {
    const k = key(e);
    if (!k) continue;
    const t = m.get(k) ?? { key: k, count: 0, fatalities: 0, confirmed: 0 };
    t.count++;
    t.fatalities += e.casualties.fatalities ?? 0;
    if (e.status === 'confirmed' || e.status === 'corroborated') t.confirmed++;
    m.set(k, t);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/* ── Headline indicators ─────────────────────────────────────────── */

export interface Situation {
  total: number;
  conflict: number;
  humanitarian: number;
  political: number;
  /** Share of incidents backed by ≥2 independent families or an analyst. */
  corroboratedShare: number | null;
  fatalities: number;
  displaced: number;
  /** Change in incident count against the preceding window of equal
   *  length; null when the earlier window is empty or the range is open. */
  changePct: number | null;
  simulated: number;
  /** Most recent update across the window, ISO; '' when empty. */
  freshest: string;
}

export function situation(events: FusedEvent[], range: TimeRange, now = Date.now()): Situation {
  const from = windowStart(range, now);
  const inWin = activeEvents(events).filter((e) => { const c = categoryOf(e); return c !== 'sensor' && c !== 'other'; });
  const cur = inWin.filter((e) => new Date(e.timestamp).getTime() >= from);
  const s: Situation = {
    total: cur.length, conflict: 0, humanitarian: 0, political: 0, corroboratedShare: null,
    fatalities: 0, displaced: 0, changePct: null, simulated: 0, freshest: '',
  };
  let backed = 0;
  for (const e of cur) {
    const c = categoryOf(e);
    if (c !== 'sensor' && c !== 'other') s[c]++;
    if (e.status === 'confirmed' || e.status === 'corroborated') backed++;
    s.fatalities += e.casualties.fatalities ?? 0;
    s.displaced += e.casualties.displaced ?? 0;
    if (originOf(e) === 'simulated') s.simulated++;
    const u = lastUpdated(e);
    if (u > s.freshest) s.freshest = u;
  }
  if (cur.length) s.corroboratedShare = backed / cur.length;
  if (Number.isFinite(from)) {
    const span = now - from;
    const prev = inWin.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= from - span && t < from;
    }).length;
    if (prev > 0) s.changePct = ((cur.length - prev) / prev) * 100;
  }
  return s;
}

/* ── Source mix ──────────────────────────────────────────────────── */

export function familyMix(events: FusedEvent[]): { family: SourceFamily; reports: number; simulated: number }[] {
  const m = new Map<SourceFamily, { family: SourceFamily; reports: number; simulated: number }>();
  for (const e of events) for (const p of e.provenance) {
    const t = m.get(p.source.family) ?? { family: p.source.family, reports: 0, simulated: 0 };
    t.reports++;
    if (isSimulatedSource(p)) t.simulated++;
    m.set(p.source.family, t);
  }
  return [...m.values()].sort((a, b) => b.reports - a.reports);
}

/* ── Relative time ───────────────────────────────────────────────── */

export function ago(iso: string, lang: 'fr' | 'en', now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const m = Math.max(0, Math.round((now - t) / 60_000));
  const fr = lang === 'fr';
  if (m < 1) return fr ? 'à l’instant' : 'just now';
  if (m < 60) return fr ? `il y a ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return fr ? `il y a ${h} h` : `${h} h ago`;
  const d = Math.round(h / 24);
  return fr ? `il y a ${d} j` : `${d} d ago`;
}

export const zulu = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.toISOString().slice(0, 16).replace('T', ' ')}Z`;
};
