'use client';

import { useFeedStore } from '@/store/useFeedStore';
import { useAuthStore } from '@/store/useAuthStore';
import { todayFR } from '@/lib/utils';

export default function IntelPanel() {
  const session = useAuthStore((s) => s.session);
  const events  = useFeedStore((s) => s.events);

  if (session?.level === 'analyst') return null;

  const acledCount = events.filter((e) => e.src === 'acled').length;
  const firmsCount = events.filter((e) => e.src === 'firms').length;
  const strikes    = events.filter((e) =>
    e.classification === 'strike' || (e.type ?? '').toLowerCase().includes('drone strike'),
  ).length;
  const totalKIA   = events.reduce((a, e) => a + (e.fatalities ?? 0), 0);

  return (
    <div className="absolute top-14 left-4 z-hud w-52 pointer-events-none animate-fade-in">
      <div className="glass rounded-2xl overflow-hidden shadow-panel">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-alert animate-pulse-slow" />
            <span className="text-alert text-xs font-semibold tracking-wide uppercase">
              Menace Critique
            </span>
          </div>
          <div className="text-t3 text-2xs font-mono">{todayFR()}</div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 space-y-2">
          <StatRow label="Conflits armés" value={acledCount}  color="text-alert" />
          <StatRow label="Anomalies FIRMS" value={firmsCount} color="text-fire"  />
          <StatRow label="Frappes drone"   value={strikes}    color="text-mag"   />
          <div className="border-t border-white/[0.06] pt-2 mt-2">
            <StatRow label="Total KIA" value={totalKIA} color="text-alert" bold />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color, bold }: {
  label: string; value: number; color: string; bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-t2 text-xs">{label}</span>
      <span className={`font-mono font-semibold ${bold ? 'text-sm' : 'text-xs'} ${color}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
