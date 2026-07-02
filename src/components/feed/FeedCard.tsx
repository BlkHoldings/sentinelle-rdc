'use client';

import type { IntelEvent } from '@/types/intel';
import { fmtDate, trunc } from '@/lib/utils';
import { useMapStore } from '@/store/useMapStore';

const TYPE_COLOR: Record<string, string> = {
  'Battles':                    '#ff453a',
  'Violence against civilians': '#ff9f0a',
  'Explosions/Remote violence': '#ff375f',
  'Strategic developments':     '#30d158',
  'Drone Strike':               '#ff453a',
  'ISR Patrol':                 '#64d2ff',
  'Reconnaissance':             '#64d2ff',
  'Thermal Anomaly':            '#ff6b00',
  'Night ISR':                  '#bf5af2',
  'Air/drone strike':           '#ff453a',
};

const TYPE_LABEL: Record<string, string> = {
  'Battles':                    'COMBAT',
  'Violence against civilians': 'CIVIL',
  'Explosions/Remote violence': 'FRAPPE',
  'Strategic developments':     'STRAT',
  'Drone Strike':               'STRIKE',
  'ISR Patrol':                 'ISR',
  'Reconnaissance':             'RECON',
  'Thermal Anomaly':            'FIRMS',
  'Night ISR':                  'ISR-IR',
  'Drone Attack (Failed)':      'FAILED',
  'Post-Strike BDA':            'BDA',
  'Maritime Patrol':            'NAVAL',
  'Humanitarian Corridor':      'HUMANI',
};

const SRC_ACCENT: Record<string, string> = {
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

  const title   = event.location ?? event.id ?? event.type;
  const body    = trunc(event.desc ?? event.notes ?? event.subtype ?? '', 130);
  const typeColor = TYPE_COLOR[event.type] ?? '#98989e';
  const typeLabel = TYPE_LABEL[event.type] ?? event.type.substring(0, 7).toUpperCase();
  const isLive  = event.status === 'TRACKING — LIVE';
  const isStrike = event.status === 'CONFIRMED STRIKE';

  return (
    <button
      onClick={handleClick}
      className="
        w-full text-left rounded-2xl p-3.5
        bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08]
        border border-white/[0.05] hover:border-white/[0.10]
        transition-all duration-150 group
      "
    >
      {/* Row 1: badge + title + KIA */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className="shrink-0 font-mono text-2xs font-semibold tracking-widest px-1.5 py-0.5 rounded-md"
          style={{ color: typeColor, background: typeColor + '1a' }}
        >
          {typeLabel}
        </span>
        <span className="flex-1 text-white text-xs font-medium leading-tight">
          {trunc(title, 38)}
        </span>
        {event.fatalities != null && event.fatalities > 0 && (
          <span className="shrink-0 text-alert text-2xs font-mono font-semibold">
            {event.fatalities} KIA
          </span>
        )}
      </div>

      {/* Row 2: body text */}
      {body && (
        <p className="text-t2 text-xs leading-relaxed mb-2 line-clamp-2">{body}</p>
      )}

      {/* Row 3: metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`w-1 h-1 rounded-full shrink-0 ${SRC_ACCENT[event.src] ?? 'bg-t3'}`} />
        {event.date && <span className="text-t3 text-2xs font-mono">{fmtDate(event.date)}</span>}
        {event.time && <span className="text-t3 text-2xs font-mono">{event.time}</span>}
        {event.admin1 && <span className="text-t3 text-2xs">{event.admin1}</span>}
        {event.platform && <span className="text-drone text-2xs font-mono">{event.platform}</span>}
        {isLive && (
          <span className="text-alert text-2xs font-semibold animate-pulse-fast">● LIVE</span>
        )}
        {isStrike && (
          <span className="text-alert text-2xs font-semibold">● CONFIRMÉ</span>
        )}
      </div>
    </button>
  );
}
