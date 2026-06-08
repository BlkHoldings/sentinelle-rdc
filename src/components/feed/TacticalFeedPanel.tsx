'use client';

import { useState, useMemo } from 'react';
import { useFeedStore, filteredEvents, type FeedTab, type FeedPill } from '@/store/useFeedStore';
import { DRONE_ISR } from '@/data/drones';
import { MIL_POSITIONS } from '@/data/military';
import FeedCard from './FeedCard';
import type { IntelEvent } from '@/types/intel';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'all',   label: 'TOUS' },
  { id: 'acled', label: 'ACLED' },
  { id: 'firms', label: 'FIRMS' },
  { id: 'drone', label: 'UAV' },
];

const PILLS: { id: FeedPill; label: string }[] = [
  { id: 'all',          label: 'Tout' },
  { id: 'battle',       label: 'Combat' },
  { id: 'strike',       label: 'Frappe' },
  { id: 'civilian',     label: 'Civil' },
  { id: 'humanitarian', label: 'Humani.' },
];

const DRONE_EVENTS: IntelEvent[] = DRONE_ISR.map((r) => ({
  src: 'drone', type: r.type, date: '', time: r.time,
  lat: r.lat, lon: r.lon, platform: r.platform,
  status: r.status, classification: r.classification,
  desc: r.desc, id: r.id,
}));

const MIL_EVENTS: IntelEvent[] = MIL_POSITIONS.map((p) => ({
  src: 'drone', type: p.t, lat: p.lt, lon: p.ln,
  location: p.n, notes: p.d, date: '',
}));

export default function TacticalFeedPanel() {
  const [open, setOpen]   = useState(true);
  const events            = useFeedStore((s) => s.events);
  const activeTab         = useFeedStore((s) => s.activeTab);
  const activePill        = useFeedStore((s) => s.activePill);
  const searchQuery       = useFeedStore((s) => s.searchQuery);
  const setTab            = useFeedStore((s) => s.setTab);
  const setPill           = useFeedStore((s) => s.setPill);
  const setSearch         = useFeedStore((s) => s.setSearch);

  const allEvents = useMemo(
    () => [...events, ...DRONE_EVENTS, ...MIL_EVENTS],
    [events],
  );

  const displayed = useMemo(
    () => filteredEvents(allEvents, activeTab, activePill, searchQuery),
    [allEvents, activeTab, activePill, searchQuery],
  );

  const totalKIA = useMemo(
    () => events.reduce((a, e) => a + (e.fatalities ?? 0), 0),
    [events],
  );

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute top-14 right-3 z-panel bg-b1/90 backdrop-blur-sm border border-bd rounded px-2 py-1 text-t2 text-xs font-mono hover:text-t1 transition-colors"
        title={open ? 'Fermer flux' : 'Ouvrir flux'}
      >
        {open ? '▶ FLUX' : '◀ FLUX'}
      </button>

      {/* Panel */}
      <div
        className={`
          absolute top-10 right-0 bottom-0 z-panel
          w-80 flex flex-col
          bg-b1/95 backdrop-blur-sm border-l border-bd
          transition-transform duration-200
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Stats row */}
        <div className="grid grid-cols-4 border-b border-bd divide-x divide-bd shrink-0">
          {[
            { label: 'ACLED',  value: events.filter((e) => e.src === 'acled').length,  color: 'text-alert' },
            { label: 'FIRMS',  value: events.filter((e) => e.src === 'firms').length,  color: 'text-fire'  },
            { label: 'UAV',    value: DRONE_ISR.length,                                 color: 'text-drone' },
            { label: 'KIA',    value: totalKIA,                                          color: 'text-alert' },
          ].map(({ label, value, color }) => (
            <div key={label} className="py-2 px-2 text-center">
              <div className={`font-mono font-bold text-sm ${color}`}>{value}</div>
              <div className="text-t3 text-2xs font-mono">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-bd shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex-1 py-1.5 text-2xs font-mono tracking-widest transition-colors
                ${activeTab === t.id
                  ? 'text-t1 border-b-2 border-blu bg-b2'
                  : 'text-t3 hover:text-t2'}
              `}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-2 py-1.5 border-b border-bd shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-b2 border border-bd rounded px-2.5 py-1.5 text-t1 text-xs font-mono focus:outline-none focus:border-blu placeholder:text-t3"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-bd shrink-0 overflow-x-auto">
          {PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPill(p.id)}
              className={`
                shrink-0 px-2 py-0.5 rounded-full text-2xs font-mono border transition-colors
                ${activePill === p.id
                  ? 'bg-blu/20 border-blu/50 text-blu'
                  : 'bg-b2 border-bd text-t3 hover:text-t2'}
              `}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Feed list */}
        <div className="flex-1 overflow-y-auto space-y-0.5 p-1">
          {displayed.length === 0 ? (
            <div className="text-t3 text-xs font-mono text-center py-8">
              Aucun événement correspondant
            </div>
          ) : (
            displayed.map((e, i) => (
              <FeedCard key={`${e.src}-${e.date}-${e.lat}-${e.lon}-${i}`} event={e} />
            ))
          )}
        </div>

        {/* Count footer */}
        <div className="px-3 py-1.5 border-t border-bd shrink-0 text-t3 text-2xs font-mono text-right">
          {displayed.length} événements affichés
        </div>
      </div>
    </>
  );
}
