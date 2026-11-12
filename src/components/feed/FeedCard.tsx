'use client';

import type { IntelEvent } from '@/types/intel';
import { fmtDate, trunc } from '@/lib/utils';
import { useMapStore } from '@/store/useMapStore';

/* Affiliation color by event type — Maven: red=HOSTILE, amber=UNKNOWN, green=CONFIRM */
const TYPE_COLOR: Record<string, string> = {
  'Battles':                    '#e5484d',
  'Violence against civilians': '#e2a336',
  'Explosions/Remote violence': '#d6577a',
  'Strategic developments':     '#3fb984',
  'Drone Strike':               '#e5484d',
  'ISR Patrol':                 '#6fd3e6',
  'Reconnaissance':             '#6fd3e6',
  'Thermal Anomaly':            '#f0803c',
  'Night ISR':                  '#9d8cff',
  'Air/drone strike':           '#e5484d',
  'Drone Attack (Failed)':      '#e2a336',
  'Post-Strike BDA':            '#e2a336',
  'Maritime Patrol':            '#6f9bff',
  'Humanitarian Corridor':      '#3fb984',
  'Border Monitoring':          '#58c4dc',
  'Road Surveillance':          '#58c4dc',
  'Damage Assessment':          '#e2a336',
  'Artillery Spotting':         '#9d8cff',
};

const TYPE_LABEL: Record<string, string> = {
  'Battles':                    'BATTLE',
  'Violence against civilians': 'VIO-CIV',
  'Explosions/Remote violence': 'EXP-REM',
  'Strategic developments':     'STRAT',
  'Drone Strike':               'STRIKE',
  'ISR Patrol':                 'ISR',
  'Reconnaissance':             'RECON',
  'Thermal Anomaly':            'FIRMS',
  'Night ISR':                  'ISR-IR',
  'Drone Attack (Failed)':      'INTCPTD',
  'Post-Strike BDA':            'BDA',
  'Maritime Patrol':            'NAVAL',
  'Humanitarian Corridor':      'HUMANI',
  'Border Monitoring':          'BORDER',
  'Road Surveillance':          'SURV',
  'Damage Assessment':          'BDA',
  'Artillery Spotting':         'ARTY',
};

const SRC_DOT: Record<string, string> = {
  acled: 'bg-alert',
  firms: 'bg-fire',
  drone: 'bg-drone',
  cop:   'bg-blu',
};

export default function FeedCard({ event }: { event: IntelEvent }) {
  const selectFeature = useMapStore((s) => s.selectFeature);

  const handleClick = () => {
    if (event.lat !== 0 || event.lon !== 0) {
      selectFeature(event, [event.lon, event.lat]);
    }
  };

  const typeColor = TYPE_COLOR[event.type] ?? '#9aa3b0';
  const typeLabel = TYPE_LABEL[event.type] ?? event.type.substring(0, 7).toUpperCase();
  const isLive    = event.status === 'TRACKING — LIVE';
  const isStrike  = event.status === 'CONFIRMED STRIKE';
  const title     = event.location ?? event.id ?? event.type;
  const body      = trunc(event.desc ?? event.notes ?? event.subtype ?? '', 120);

  return (
    <button
      onClick={handleClick}
      className="
        w-full text-left group
        border-b border-b3 hover:bg-blu/[0.05] transition-colors duration-100
      "
      style={{ borderLeft: `2px solid ${typeColor}` }}
    >
      {/* Track header row */}
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
        <span
          className="shrink-0 text-2xs font-bold tracking-widest px-1 py-px"
          style={{ color: typeColor, background: typeColor + '18' }}
        >
          {typeLabel}
        </span>
        <span className="flex-1 text-t1 text-2xs font-medium truncate">
          {trunc(title, 32)}
        </span>
        {event.fatalities != null && event.fatalities > 0 && (
          <span className="shrink-0 text-alert text-2xs font-bold">
            ▲{event.fatalities}KIA
          </span>
        )}
      </div>

      {/* Body text */}
      {body && (
        <p className="text-t3 text-2xs leading-relaxed px-2.5 pb-1.5 line-clamp-2">
          {body}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-2 px-2.5 pb-2 flex-wrap">
        <div className={`w-1 h-1 shrink-0 ${SRC_DOT[event.src] ?? 'bg-t3'}`} />
        {event.date && (
          <span className="text-t3 text-2xs ">{fmtDate(event.date)}</span>
        )}
        {event.time && (
          <span className="text-t3 text-2xs ">{event.time}</span>
        )}
        {event.admin1 && (
          <span className="text-t3 text-2xs ">{event.admin1}</span>
        )}
        {event.platform && (
          <span className="text-drone text-2xs ">{event.platform}</span>
        )}
        {isLive && (
          <span className="text-alert text-2xs font-bold animate-pulse-fast">● LIVE</span>
        )}
        {isStrike && (
          <span className="text-alert text-2xs ">● CONFIRMED</span>
        )}
      </div>
    </button>
  );
}
