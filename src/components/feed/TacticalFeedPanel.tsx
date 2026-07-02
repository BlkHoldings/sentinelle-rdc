'use client';

import { useState, useMemo } from 'react';
import { useFeedStore, filteredEvents, type FeedTab, type FeedPill } from '@/store/useFeedStore';
import { DRONE_ISR } from '@/data/drones';
import { MIL_POSITIONS } from '@/data/military';
import FeedCard from './FeedCard';
import type { IntelEvent } from '@/types/intel';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'all',   label: 'ALL'   },
  { id: 'acled', label: 'ACLED' },
  { id: 'firms', label: 'FIRMS' },
  { id: 'drone', label: 'UAV'   },
];

const PILLS: { id: FeedPill; label: string }[] = [
  { id: 'all',          label: 'ALL'    },
  { id: 'battle',       label: 'BATTLE' },
  { id: 'strike',       label: 'STRIKE' },
  { id: 'civilian',     label: 'CIV'    },
  { id: 'humanitarian', label: 'HUM'    },
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

  const totalKIA = useMemo(() => events.reduce((a, e) => a + (e.fatalities ?? 0), 0), [events]);
  const acledN   = events.filter((e) => e.src === 'acled').length;
  const firmsN   = events.filter((e) => e.src === 'firms').length;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          absolute top-16 right-0 z-panel
          flex items-center gap-1.5 px-2 py-1
          panel border-l-0 text-t3 text-2xs font-mono
          hover:text-t2 transition-colors
        "
      >
        <span className="w-1 h-1 bg-blu" />
        {open ? 'HIDE' : 'TRACKS'}
      </button>

      {/* Panel */}
      <div
        className={`
          absolute top-14 right-0 bottom-0 z-panel
          w-72 flex flex-col
          panel
          transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Panel header */}
        <div className="panel-header px-2.5 py-1.5 flex items-center gap-2 shrink-0">
          <div className="w-1 h-1 bg-blu shrink-0" />
          <span className="mvn-label">ENTITY TRACKS // AOR EST-DRC</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 border-b border-b3 shrink-0">
          {[
            { label: 'ACLED', value: acledN,           color: 'text-alert' },
            { label: 'FIRMS', value: firmsN,            color: 'text-fire'  },
            { label: 'UAV',   value: DRONE_ISR.length,  color: 'text-drone' },
            { label: 'KIA',   value: totalKIA,           color: 'text-alert' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-2 gap-0.5 border-r border-b3 last:border-r-0">
              <span className={`font-mono font-bold text-sm ${color}`}>{value}</span>
              <span className="mvn-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-b3 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex-1 py-1.5 text-2xs font-mono font-medium transition-colors
                ${activeTab === t.id
                  ? 'text-t1 border-b-2 border-blu bg-blu/[0.08]'
                  : 'text-t3 hover:text-t2 hover:bg-b1/40'}
              `}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-2 py-1.5 border-b border-b3 shrink-0">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-t3 text-xs pointer-events-none font-mono">
              ⌕
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH TRACKS…"
              className="
                w-full bg-b0 border border-b3 focus:border-blu
                pl-7 pr-2 py-1.5 text-t2 text-2xs font-mono
                placeholder:text-t3
                focus:outline-none transition-colors
              "
            />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-b3 shrink-0 overflow-x-auto">
          {PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPill(p.id)}
              className={`
                shrink-0 px-1.5 py-0.5 text-2xs font-mono border transition-colors
                ${activePill === p.id
                  ? 'bg-blu/10 border-blu/50 text-blu'
                  : 'border-b3 text-t3 hover:border-t3 hover:text-t2'}
              `}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="text-t3 text-2xs font-mono text-center py-8">
              NO TRACKS MATCHING FILTER
            </div>
          ) : (
            displayed.map((e, i) => (
              <FeedCard key={`${e.src}-${e.date}-${e.lat}-${e.lon}-${i}`} event={e} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="panel-header px-2.5 py-1 flex items-center justify-between shrink-0">
          <span className="mvn-label">TRACKS</span>
          <span className="text-t3 text-2xs font-mono">{displayed.length.toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}
