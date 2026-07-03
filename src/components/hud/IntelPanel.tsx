'use client';

import { useFeedStore } from '@/store/useFeedStore';
import { useAuthStore } from '@/store/useAuthStore';

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
    <div className="absolute top-14 left-3 z-hud w-48 pointer-events-none animate-fade-in">
      <div className="panel shadow-panel">

        {/* Header */}
        <div className="panel-header px-2.5 py-1 flex items-center gap-1.5">
          <div className="w-1 h-1 bg-alert animate-pulse-slow shrink-0" />
          <span className="mvn-label">SITREP // AOR EST-DRC</span>
        </div>

        {/* Stats grid */}
        <div className="divide-y divide-b3">
          <StatRow label="CONFLITS ARMES" value={acledCount}  color="text-alert" />
          <StatRow label="ANOMALIES FIRMS" value={firmsCount} color="text-fire"  />
          <StatRow label="FRAPPES DRONE"   value={strikes}    color="text-mag"   />
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-alert/[0.06]">
            <span className="mvn-label text-alert">TOTAL KIA</span>
            <span className="font-mono font-bold text-sm text-alert">
              {totalKIA.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Threat level bar */}
        <div className="panel-header px-2.5 py-1 flex items-center justify-between">
          <span className="mvn-label">THREAT LVL</span>
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map((i) => (
              <div
                key={i}
                className={`w-3 h-1.5 ${i <= 4 ? 'bg-alert' : 'bg-b3'}`}
              />
            ))}
            <span className="text-alert text-2xs font-mono font-bold ml-1">CRITICAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: {
  label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="mvn-label">{label}</span>
      <span className={`font-mono font-bold text-xs ${color}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
