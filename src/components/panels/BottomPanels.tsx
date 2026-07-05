'use client';

import { useState, useMemo } from 'react';
import { useFeedStore, applyFilters } from '@/store/useFeedStore';
import { useMapStore } from '@/store/useMapStore';
import CommsIntercept from '@/components/panels/CommsIntercept';
import type { IntelEvent } from '@/types/intel';

type ActivityTab = 'ALL' | 'ALERTS' | 'REPORTS' | 'MOVEMENTS' | 'FIRES';

const ACT_TABS: ActivityTab[] = ['ALL', 'ALERTS', 'REPORTS', 'MOVEMENTS', 'FIRES'];

function filterActivity(events: IntelEvent[], tab: ActivityTab): IntelEvent[] {
  if (tab === 'ALL')       return events;
  if (tab === 'ALERTS')    return events.filter((e) => (e.fatalities ?? 0) >= 5 || e.type === 'Battles');
  if (tab === 'REPORTS')   return events.filter((e) => e.type === 'Strategic developments');
  if (tab === 'MOVEMENTS') return events.filter((e) => {
    const n = (e.notes ?? '').toLowerCase();
    return n.includes('déplac') || n.includes('deplac') || n.includes('refuge') || n.includes('idp');
  });
  if (tab === 'FIRES')     return events.filter((e) =>
    e.src === 'drone' || e.src === 'firms' || e.type === 'Explosions/Remote violence',
  );
  return events;
}

/* Severity icon for each event */
function EventIcon({ e }: { e: IntelEvent }) {
  if (e.src === 'drone') {
    const isStrike = e.type === 'Explosions/Remote violence' ||
      (e.classification === 'strike' || e.classification === 'strike_bda');
    return (
      <div className={`w-5 h-5 shrink-0 flex items-center justify-center text-xs font-bold
        ${isStrike ? 'bg-alert/20 text-alert' : 'bg-drone/20 text-drone'}`}>
        {isStrike ? '✦' : '◈'}
      </div>
    );
  }
  if (e.src === 'firms') {
    return <div className="w-5 h-5 shrink-0 flex items-center justify-center text-xs bg-fire/20 text-fire">⊕</div>;
  }
  const map: Record<string, { bg: string; text: string; sym: string }> = {
    'Battles':                    { bg: 'bg-alert/20', text: 'text-alert', sym: '▲' },
    'Explosions/Remote violence': { bg: 'bg-mag/20',   text: 'text-mag',   sym: '◆' },
    'Violence against civilians': { bg: 'bg-amb/20',   text: 'text-amb',   sym: '▲' },
    'Strategic developments':     { bg: 'bg-grn/20',   text: 'text-grn',   sym: '●' },
  };
  const s = map[e.type] ?? { bg: 'bg-b3', text: 'text-t3', sym: '○' };
  return (
    <div className={`w-5 h-5 shrink-0 flex items-center justify-center text-xs font-bold ${s.bg} ${s.text}`}>
      {s.sym}
    </div>
  );
}

interface Props {
  /** On phones, show only this section full-height; null hides the strip */
  mobileSection?: 'activity' | 'comms' | null;
}

export default function BottomPanels({ mobileSection = null }: Props) {
  const [actTab, setActTab]   = useState<ActivityTab>('ALL');
  const [actAll, setActAll]   = useState(false);
  const [tlFull, setTlFull]   = useState(false);
  const events        = useFeedStore((s) => s.events);
  const searchQuery   = useFeedStore((s) => s.searchQuery);
  const timeRange     = useFeedStore((s) => s.timeRange);
  const classFilter   = useFeedStore((s) => s.classFilter);
  const selectFeature = useMapStore((s) => s.selectFeature);

  const filtered = useMemo(
    () => applyFilters(events, { query: searchQuery, timeRange, classFilter }),
    [events, searchQuery, timeRange, classFilter],
  );
  const sorted    = useMemo(() =>
    [...filtered].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [filtered]);
  const displayed = useMemo(
    () => filterActivity(sorted, actTab).slice(0, actAll ? 500 : 40),
    [sorted, actTab, actAll],
  );

  /* Timeline events */
  const timelineEvts = useMemo(() => sorted.filter((e) => e.date).slice(0, 20), [sorted]);

  return (
    <div
      className={`${mobileSection ? 'flex flex-1 min-h-0' : 'hidden'} md:flex md:flex-none md:h-[185px] shrink-0 border-t border-b3 bg-b1 overflow-hidden`}
    >

      {/* ── TIMELINE — desktop only ──────────── */}
      <div className="hidden md:flex flex-col w-[230px] shrink-0 border-r border-b3">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="mvn-label">TIMELINE</span>
          <span className="text-t3 text-2xs font-mono">PAST 24H</span>
        </div>

        {/* Horizontal line with dots */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative h-4">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-b3" />
            {timelineEvts.map((e, i) => {
              const pct = timelineEvts.length === 1 ? 50 : (i / (timelineEvts.length - 1)) * 100;
              const dot =
                e.src === 'drone' ? 'bg-drone' :
                e.src === 'firms' ? 'bg-fire' :
                e.type === 'Battles' ? 'bg-alert' :
                e.type === 'Explosions/Remote violence' ? 'bg-mag' :
                e.type === 'Violence against civilians' ? 'bg-amb' : 'bg-grn';
              return (
                <button
                  key={i}
                  onClick={() => selectFeature(e, [e.lon, e.lat])}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                  style={{ left: `${pct}%` }}
                  title={`${e.type} — ${e.location ?? ''}`}
                >
                  <div className={`w-2 h-2 ${dot} border border-b0 group-hover:scale-150 transition-transform`} />
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-t3 text-2xs font-mono">
            <span>12:00</span><span>18:00</span><span>00:00</span><span>06:00</span><span>NOW</span>
          </div>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto divide-y divide-b3/40">
          {timelineEvts.slice(0, tlFull ? timelineEvts.length : 4).map((e, i) => (
            <button
              key={i}
              onClick={() => selectFeature(e, [e.lon, e.lat])}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-b2/60 transition-colors text-left"
            >
              <EventIcon e={e} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-t3 text-2xs font-mono shrink-0">{e.date?.slice(5)}</span>
                  <span className="text-t2 text-2xs font-mono truncate">{e.type}</span>
                </div>
                <div className="text-t3 text-2xs font-mono truncate">{e.location ?? ''}</div>
              </div>
              {(e.fatalities ?? 0) > 0 && (
                <span className="text-alert text-2xs font-mono font-bold ml-auto shrink-0">▲{e.fatalities}</span>
              )}
            </button>
          ))}
        </div>

        <div className="panel-header px-3 py-1 shrink-0">
          <button
            onClick={() => setTlFull((v) => !v)}
            className={`text-2xs font-mono transition-colors ${tlFull ? 'text-blu' : 'text-t3 hover:text-blu'}`}
          >
            {tlFull ? '▲ COLLAPSE TIMELINE' : 'VIEW FULL TIMELINE'}
          </button>
        </div>
      </div>

      {/* ── RECENT ACTIVITY ──────────────────── */}
      <div className={`${mobileSection === 'activity' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 md:border-r border-b3`}>
        <div className="panel-header px-3 py-1.5 shrink-0 flex items-center justify-between">
          <span className="mvn-label">RECENT ACTIVITY</span>
          <span className="text-t3 text-2xs font-mono">{displayed.length} ITEMS</span>
        </div>

        <div className="flex border-b border-b3 shrink-0">
          {ACT_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActTab(t)}
              className={`flex-1 py-1 text-2xs font-mono transition-colors ${
                actTab === t
                  ? 'text-t1 border-b-2 border-blu bg-blu/[0.07]'
                  : 'text-t3 hover:text-t2 hover:bg-b2/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="text-t3 text-2xs font-mono text-center py-5">NO ACTIVITY</div>
          ) : (
            displayed.map((e, i) => (
              <button
                key={i}
                onClick={() => selectFeature(e, [e.lon, e.lat])}
                className="w-full flex items-start gap-2 px-3 py-1.5 border-b border-b3/40 hover:bg-b2/60 transition-colors text-left"
              >
                <EventIcon e={e} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-t3 text-2xs font-mono shrink-0">{e.date?.slice(5) ?? ''}</span>
                    <span className="text-t2 text-2xs font-mono truncate">
                      {e.location ? `${e.type} — ${e.location}` : e.type}
                    </span>
                    {(e.fatalities ?? 0) > 0 && (
                      <span className="text-alert text-2xs font-mono font-bold shrink-0">▲{e.fatalities}</span>
                    )}
                  </div>
                  <div className="text-t3 text-2xs font-mono truncate">{e.notes?.slice(0, 60) ?? e.desc ?? ''}</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="panel-header px-3 py-1 shrink-0">
          <button
            onClick={() => setActAll((v) => !v)}
            className={`text-2xs font-mono transition-colors ${actAll ? 'text-blu' : 'text-t3 hover:text-blu'}`}
          >
            {actAll ? '▲ SHOW RECENT ONLY' : 'VIEW ALL ACTIVITY'}
          </button>
        </div>
      </div>

      {/* ── COMMUNICATIONS INTERCEPT ─────────── */}
      <CommsIntercept mobileActive={mobileSection === 'comms'} />

    </div>
  );
}
