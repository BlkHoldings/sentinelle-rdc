'use client';

import { useState, useMemo } from 'react';
import { useFeedStore, filteredEvents, type FeedTab, type FeedPill } from '@/store/useFeedStore';
import { DRONE_ISR } from '@/data/drones';
import { MIL_POSITIONS } from '@/data/military';
import FeedCard from './FeedCard';
import type { IntelEvent } from '@/types/intel';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'all',   label: 'Tous' },
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
  const [open, setOpen]  = useState(true);
  const events           = useFeedStore((s) => s.events);
  const activeTab        = useFeedStore((s) => s.activeTab);
  const activePill       = useFeedStore((s) => s.activePill);
  const searchQuery      = useFeedStore((s) => s.searchQuery);
  const setTab           = useFeedStore((s) => s.setTab);
  const setPill          = useFeedStore((s) => s.setPill);
  const setSearch        = useFeedStore((s) => s.setSearch);

  const allEvents = useMemo(
    () => [...events, ...DRONE_EVENTS, ...MIL_EVENTS],
    [events],
  );

  const displayed = useMemo(
    () => filteredEvents(allEvents, activeTab, activePill, searchQuery),
    [allEvents, activeTab, activePill, searchQuery],
  );

  const totalKIA  = useMemo(() => events.reduce((a, e) => a + (e.fatalities ?? 0), 0), [events]);
  const acledN    = events.filter((e) => e.src === 'acled').length;
  const firmsN    = events.filter((e) => e.src === 'firms').length;

  return (
    <>
      {/* Toggle pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          absolute top-16 right-4 z-panel
          flex items-center gap-1.5 px-3 py-1.5 rounded-full
          glass text-t2 text-xs font-medium hover:text-white
          transition-all shadow-panel
        "
      >
        <span className="w-1 h-1 rounded-full bg-blu" />
        {open ? 'Masquer flux' : 'Flux intel'}
      </button>

      {/* Panel */}
      <div
        className={`
          absolute top-11 right-0 bottom-0 z-panel
          w-80 flex flex-col
          bg-b0/92 backdrop-blur-3xl
          border-l border-white/[0.06]
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Stats row */}
        <div className="grid grid-cols-4 border-b border-white/[0.06] shrink-0">
          {[
            { label: 'ACLED', value: acledN,         color: 'text-alert' },
            { label: 'FIRMS', value: firmsN,          color: 'text-fire'  },
            { label: 'UAV',   value: DRONE_ISR.length, color: 'text-drone' },
            { label: 'KIA',   value: totalKIA,         color: 'text-alert' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-3 gap-0.5">
              <span className={`font-mono font-bold text-base ${color}`}>{value}</span>
              <span className="text-t3 text-2xs font-mono uppercase">{label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] shrink-0 bg-b1/40">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex-1 py-2.5 text-xs font-medium transition-all duration-150
                ${activeTab === t.id
                  ? 'text-white border-b-2 border-blu'
                  : 'text-t3 hover:text-t2'}
              `}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-white/[0.06] shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-t3 text-xs pointer-events-none">⌕</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans le flux…"
              className="
                w-full bg-b3/50 border border-white/[0.08] rounded-xl
                pl-8 pr-3 py-2 text-white text-xs
                placeholder:text-t3
                focus:outline-none focus:border-blu/40 focus:bg-b3/80
                transition-all
              "
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-white/[0.06] shrink-0 overflow-x-auto">
          {PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPill(p.id)}
              className={`
                shrink-0 px-2.5 py-1 rounded-full text-2xs font-medium border transition-all duration-150
                ${activePill === p.id
                  ? 'bg-blu/[0.15] border-blu/40 text-blu'
                  : 'bg-transparent border-white/10 text-t3 hover:border-white/20 hover:text-t2'}
              `}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {displayed.length === 0 ? (
            <div className="text-t3 text-xs text-center py-12 font-medium">
              Aucun événement correspondant
            </div>
          ) : (
            displayed.map((e, i) => (
              <FeedCard key={`${e.src}-${e.date}-${e.lat}-${e.lon}-${i}`} event={e} />
            ))
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-white/[0.06] shrink-0 text-t3 text-2xs font-mono text-right">
          {displayed.length.toLocaleString()} événements
        </div>
      </div>
    </>
  );
}
