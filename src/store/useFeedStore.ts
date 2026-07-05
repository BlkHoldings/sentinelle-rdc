'use client';

import { create } from 'zustand';
import type { IntelEvent } from '@/types/intel';

export type FeedTab     = 'all' | 'acled' | 'firms' | 'drone' | 'mil';
export type FeedPill    = 'all' | 'battle' | 'strike' | 'civilian' | 'humanitarian';
export type TimeRange   = '24h' | '72h' | '7d' | '30d' | 'all';
export type ClassFilter = 'TOUS' | 'SECRET' | 'CLASSIFIÉ' | 'NON-CLASSIFIÉ';

interface FeedState {
  events:         IntelEvent[];
  activeTab:      FeedTab;
  activePill:     FeedPill;
  searchQuery:    string;
  timeRange:      TimeRange;
  classFilter:    ClassFilter;
  setEvents:      (events: IntelEvent[]) => void;
  addEvents:      (events: IntelEvent[]) => void;
  setTab:         (tab: FeedTab) => void;
  setPill:        (pill: FeedPill) => void;
  setSearch:      (q: string) => void;
  setTimeRange:   (r: TimeRange) => void;
  setClassFilter: (c: ClassFilter) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  events:      [],
  activeTab:   'all',
  activePill:  'all',
  searchQuery: '',
  timeRange:   '7d',
  classFilter: 'TOUS',

  setEvents(events) { set({ events }); },

  addEvents(events) {
    set((s) => {
      const existing = new Set(s.events.map((e) => `${e.src}-${e.date}-${e.lat}-${e.lon}`));
      const fresh = events.filter((e) => !existing.has(`${e.src}-${e.date}-${e.lat}-${e.lon}`));
      return { events: [...fresh, ...s.events] };
    });
  },

  setTab(tab)          { set({ activeTab: tab }); },
  setPill(pill)        { set({ activePill: pill }); },
  setSearch(q)         { set({ searchQuery: q }); },
  setTimeRange(r)      { set({ timeRange: r }); },
  setClassFilter(c)    { set({ classFilter: c }); },
}));

/** Security classification derived from the collection source. */
export function classificationOf(e: IntelEvent): ClassFilter {
  if (e.src === 'drone') return 'SECRET';         // MONUSCO UAS / mil sources
  if (e.src === 'cop')   return 'CLASSIFIÉ';      // satellite tasking catalog
  return 'NON-CLASSIFIÉ';                         // ACLED / FIRMS (public data)
}

/** Canonical filter pipeline shared by map, panels and exports. */
export function applyFilters(
  events: IntelEvent[],
  opts: { query?: string; timeRange?: TimeRange; classFilter?: ClassFilter },
): IntelEvent[] {
  const { query = '', timeRange = 'all', classFilter = 'TOUS' } = opts;
  let out = events;

  const cutoff = cutoffForRange(timeRange);
  if (cutoff) out = out.filter((e) => !e.date || e.date >= cutoff);

  if (classFilter !== 'TOUS') {
    out = out.filter((e) => classificationOf(e) === classFilter);
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    out = out.filter((e) =>
      [e.type, e.subtype, e.location, e.admin1, e.actor1, e.actor2, e.notes, e.desc, e.platform]
        .some((f) => f?.toLowerCase().includes(q)),
    );
  }
  return out;
}

export function cutoffForRange(range: TimeRange): string | null {
  if (range === 'all') return null;
  const days = range === '24h' ? 1 : range === '72h' ? 3 : range === '7d' ? 7 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function filteredEvents(
  events:    IntelEvent[],
  tab:       FeedTab,
  pill:      FeedPill,
  query:     string,
  timeRange: TimeRange = 'all',
): IntelEvent[] {
  let out = events;

  if (timeRange !== 'all') {
    const cutoff = cutoffForRange(timeRange);
    if (cutoff) out = out.filter((e) => !e.date || e.date >= cutoff);
  }

  if (tab !== 'all') {
    out = out.filter((e) => e.src === tab);
  }

  if (pill !== 'all') {
    out = out.filter((e) => {
      const t = (e.type + (e.subtype ?? '')).toLowerCase();
      if (pill === 'battle')       return t.includes('battle') || t.includes('clash');
      if (pill === 'strike')       return t.includes('drone') || t.includes('strike') || t.includes('explo') || t.includes('shell');
      if (pill === 'civilian')     return t.includes('civilian') || t.includes('violence');
      if (pill === 'humanitarian') return e.src === 'firms' || t.includes('idp') || t.includes('humanitarian');
      return true;
    });
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    out = out.filter((e) =>
      [e.type, e.subtype, e.location, e.admin1, e.actor1, e.actor2, e.notes, e.desc, e.platform]
        .some((f) => f?.toLowerCase().includes(q)),
    );
  }

  return out.slice(0, 300);
}
