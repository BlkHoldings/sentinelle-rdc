'use client';

import { useState, useMemo } from 'react';
import { useFeedStore } from '@/store/useFeedStore';
import { useMapStore } from '@/store/useMapStore';
import { DRONE_ISR } from '@/data/drones';
import type { IntelEvent } from '@/types/intel';

type ActivityTab = 'ALL' | 'ALERTS' | 'REPORTS' | 'MOVEMENTS' | 'FIRES';

const ACT_TABS: ActivityTab[] = ['ALL', 'ALERTS', 'REPORTS', 'MOVEMENTS', 'FIRES'];

function filterActivity(events: IntelEvent[], tab: ActivityTab): IntelEvent[] {
  if (tab === 'ALL')       return events;
  if (tab === 'ALERTS')    return events.filter((e) => (e.fatalities ?? 0) >= 5 || e.type === 'Battles');
  if (tab === 'REPORTS')   return events.filter((e) => e.type === 'Strategic developments');
  if (tab === 'MOVEMENTS') return events.filter((e) => {
    const n = (e.notes ?? '').toLowerCase();
    return n.includes('déplac') || n.includes('deplac') || n.includes('refuge') || n.includes('idp') || n.includes('pdis');
  });
  if (tab === 'FIRES')     return events.filter((e) =>
    e.src === 'drone' || e.src === 'firms' || e.type === 'Explosions/Remote violence',
  );
  return events;
}

function eventDot(e: IntelEvent): string {
  if (e.src === 'drone') return 'bg-drone';
  if (e.src === 'firms') return 'bg-fire';
  const map: Record<string, string> = {
    'Battles':                    'bg-alert',
    'Explosions/Remote violence': 'bg-mag',
    'Violence against civilians': 'bg-amb',
    'Strategic developments':     'bg-grn',
  };
  return map[e.type] ?? 'bg-t3';
}

export default function BottomPanels() {
  const [actTab, setActTab] = useState<ActivityTab>('ALL');
  const events        = useFeedStore((s) => s.events);
  const selectFeature = useMapStore((s) => s.selectFeature);

  const acledEvents = useMemo(() => events.filter((e) => e.src === 'acled'), [events]);
  const sorted      = useMemo(() => [...events].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [events]);
  const displayed   = useMemo(() => filterActivity(sorted, actTab).slice(0, 40), [sorted, actTab]);

  // Timeline: most recent events across all sources
  const timelineEvts = useMemo(() =>
    sorted.filter((e) => e.date).slice(0, 18),
    [sorted],
  );

  // Latest ISR
  const latestISR = DRONE_ISR.slice(0, 4);

  return (
    <div className="flex h-[185px] shrink-0 border-t border-b3 bg-b1 overflow-hidden">

      {/* ── TIMELINE ─────────────────────────────────────── */}
      <div className="flex flex-col w-[240px] shrink-0 border-r border-b3">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="mvn-label">TIMELINE — 7J</span>
          <span className="text-t3 text-2xs font-mono">{timelineEvts.length} EVT</span>
        </div>

        {/* Horizontal timeline */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative h-4">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-b3" />
            {timelineEvts.map((e, i) => {
              const pct = timelineEvts.length === 1 ? 50 : (i / (timelineEvts.length - 1)) * 100;
              return (
                <button
                  key={i}
                  onClick={() => selectFeature(e, [e.lon, e.lat])}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
                  style={{ left: `${pct}%` }}
                  title={`${e.type} — ${e.location ?? ''}`}
                >
                  <div className={`w-2 h-2 ${eventDot(e)} border border-b0 group-hover:scale-150 transition-transform`} />
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-t3 text-2xs font-mono mt-1">
            <span>J-7</span><span>J-4</span><span>J-2</span><span>AUJ</span>
          </div>
        </div>

        {/* Recent items */}
        <div className="flex-1 overflow-y-auto divide-y divide-b3/40">
          {timelineEvts.slice(0, 5).map((e, i) => (
            <button
              key={i}
              onClick={() => selectFeature(e, [e.lon, e.lat])}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-b2/60 transition-colors text-left"
            >
              <div className={`w-1.5 h-1.5 shrink-0 ${eventDot(e)}`} />
              <span className="text-t3 text-2xs font-mono shrink-0">{e.date?.slice(5)}</span>
              <span className="text-t2 text-2xs font-mono truncate">{e.location ?? e.type}</span>
              {(e.fatalities ?? 0) > 0 && (
                <span className="text-alert text-2xs font-mono font-bold shrink-0">▲{e.fatalities}</span>
              )}
            </button>
          ))}
        </div>

        <div className="panel-header px-3 py-1 shrink-0">
          <button className="text-t3 text-2xs font-mono hover:text-blu transition-colors">VIEW FULL TIMELINE</button>
        </div>
      </div>

      {/* ── RECENT ACTIVITY ──────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-b3">
        <div className="panel-header px-3 py-1.5 shrink-0 flex items-center justify-between">
          <span className="mvn-label">RECENT ACTIVITY</span>
          <span className="text-t3 text-2xs font-mono">{displayed.length} ITEMS</span>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-b3 shrink-0">
          {ACT_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActTab(t)}
              className={`
                flex-1 py-1 text-2xs font-mono transition-colors
                ${actTab === t
                  ? 'text-t1 border-b-2 border-blu bg-blu/[0.07]'
                  : 'text-t3 hover:text-t2 hover:bg-b2/50'}
              `}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Event list */}
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
                <div className={`w-1.5 h-1.5 mt-0.5 shrink-0 ${eventDot(e)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-t3 text-2xs font-mono shrink-0">{e.date?.slice(5) ?? ''}</span>
                    <span className="text-t2 text-2xs font-mono truncate">{e.type}</span>
                    {(e.fatalities ?? 0) > 0 && (
                      <span className="text-alert text-2xs font-mono font-bold shrink-0">▲{e.fatalities}</span>
                    )}
                  </div>
                  <div className="text-t3 text-2xs font-mono truncate">{e.location ?? e.desc ?? ''}</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="panel-header px-3 py-1 shrink-0">
          <button className="text-t3 text-2xs font-mono hover:text-blu transition-colors">VIEW ALL ACTIVITY</button>
        </div>
      </div>

      {/* ── ISR INTERCEPT ────────────────────────────────── */}
      <div className="flex flex-col w-[230px] shrink-0">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="mvn-label">ISR INTERCEPT</span>
          <span className="text-t3 text-2xs font-mono">LATEST</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-b3/40">
          {latestISR.map((rec) => {
            const isStrike = rec.classification === 'strike' || rec.classification === 'strike_bda';
            return (
              <button
                key={rec.id}
                onClick={() => selectFeature(
                  { src: 'drone', type: rec.type, lat: rec.lat, lon: rec.lon,
                    desc: rec.desc, platform: rec.platform, status: rec.status,
                    id: rec.id, time: rec.time, date: '', classification: rec.classification },
                  [rec.lon, rec.lat],
                )}
                className="w-full text-left px-3 py-2 hover:bg-b2/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-cyn text-2xs font-mono font-bold">{rec.id}</span>
                  <span className="text-t3 text-2xs font-mono">{rec.time}</span>
                </div>
                <div className="text-t2 text-2xs font-mono">{rec.platform}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-2xs font-mono ${isStrike ? 'text-alert' : 'text-grn'}`}>
                    {rec.status}
                  </span>
                  <span className="text-t3 text-2xs font-mono">{rec.type}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="panel-header px-3 py-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 bg-grn animate-pulse-slow shrink-0" />
            <span className="text-t3 text-2xs font-mono">MONUSCO ISR ACTIVE</span>
          </div>
        </div>
      </div>

    </div>
  );
}
