'use client';

import type { IntelEvent } from '@/types/intel';
import { fmtDate, trunc } from '@/lib/utils';
import { useMapStore } from '@/store/useMapStore';

const SRC_COLOR: Record<string, string> = {
  acled: 'border-l-alert',
  firms: 'border-l-fire',
  drone: 'border-l-drone',
  cop:   'border-l-blu',
};

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  'Battles':                   { label: 'COMBAT',    cls: 'bg-alert/10 text-alert border-alert/30' },
  'Violence against civilians':{ label: 'CIVILIANS', cls: 'bg-amb/10   text-amb   border-amb/30' },
  'Explosions/Remote violence':{ label: 'FRAPPE',    cls: 'bg-mag/10   text-mag   border-mag/30' },
  'Strategic developments':    { label: 'STRAT',     cls: 'bg-grn/10   text-grn   border-grn/30' },
  'Drone Strike':              { label: 'STRIKE',    cls: 'bg-alert/10 text-alert border-alert/30' },
  'ISR Patrol':                { label: 'ISR',       cls: 'bg-drone/10 text-drone border-drone/30' },
  'Thermal Anomaly':           { label: 'FIRMS',     cls: 'bg-fire/10  text-fire  border-fire/30' },
};

function badge(type: string) {
  const match = TYPE_BADGE[type] ?? { label: type.substring(0, 6).toUpperCase(), cls: 'bg-b3 text-t3 border-bd' };
  return (
    <span className={`inline-block border rounded px-1 py-0.5 text-3xs font-mono tracking-wider ${match.cls}`}>
      {match.label}
    </span>
  );
}

export default function FeedCard({ event }: { event: IntelEvent }) {
  const selectFeature = useMapStore((s) => s.selectFeature);

  const handleClick = () => {
    if (event.lat !== 0 || event.lon !== 0) {
      selectFeature(event, [event.lon, event.lat]);
    }
  };

  const title = event.location ?? event.id ?? event.type;
  const body  = trunc(event.desc ?? event.notes ?? event.subtype ?? '', 120);
  const meta  = [event.actor1, event.actor2].filter(Boolean).join(' ↔ ');

  return (
    <div
      onClick={handleClick}
      className={`
        border-l-2 bg-b2 hover:bg-b3 transition-colors cursor-pointer
        px-3 py-2.5 rounded-r space-y-1
        ${SRC_COLOR[event.src] ?? 'border-l-bd'}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {badge(event.type)}
          <span className="text-t1 text-xs font-mono">{trunc(title, 32)}</span>
        </div>
        {event.fatalities != null && event.fatalities > 0 && (
          <span className="text-alert text-2xs font-mono font-bold shrink-0">
            {event.fatalities} KIA
          </span>
        )}
      </div>

      {body && <p className="text-t2 text-xs leading-relaxed">{body}</p>}

      <div className="flex items-center gap-3 text-t3 text-2xs font-mono">
        {event.date && <span>{fmtDate(event.date)}</span>}
        {event.time && <span>{event.time}</span>}
        {event.admin1 && <span>{event.admin1}</span>}
        {event.platform && <span className="text-drone">{event.platform}</span>}
        {event.status === 'CONFIRMED STRIKE' && (
          <span className="text-alert font-bold">● CONFIRMÉ</span>
        )}
        {event.status === 'TRACKING — LIVE' && (
          <span className="text-alert animate-pulse-fast font-bold">● LIVE</span>
        )}
      </div>

      {meta && <div className="text-t3 text-2xs font-mono">{trunc(meta, 60)}</div>}
    </div>
  );
}
