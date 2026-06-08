'use client';

import { useFeedStore } from '@/store/useFeedStore';
import { useAuthStore } from '@/store/useAuthStore';
import { todayFR } from '@/lib/utils';

export default function IntelPanel() {
  const session  = useAuthStore((s) => s.session);
  const events   = useFeedStore((s) => s.events);

  const acledCount  = events.filter((e) => e.src === 'acled').length;
  const firmsCount  = events.filter((e) => e.src === 'firms').length;
  const droneCount  = events.filter((e) => e.src === 'drone').length;
  const totalKIA    = events.reduce((acc, e) => acc + (e.fatalities ?? 0), 0);
  const strikes     = events.filter((e) =>
    (e.classification === 'strike' || (e.type ?? '').toLowerCase().includes('drone strike')),
  ).length;

  if (session?.level === 'analyst') return null;

  return (
    <div className="absolute top-14 left-3 z-hud w-48 pointer-events-none animate-fade-in">
      <div className="bg-b1/90 backdrop-blur-sm border border-bd rounded overflow-hidden">
        <div className="bg-alert/10 border-b border-alert/30 px-2.5 py-1.5">
          <div className="text-alert text-2xs font-mono tracking-widest uppercase font-bold">
            MENACE ÉLEVÉE
          </div>
          <div className="text-t3 text-2xs font-mono mt-0.5">{todayFR()}</div>
        </div>
        <div className="p-2.5 space-y-1.5 font-mono text-2xs">
          <Stat label="Événements ACLED" value={acledCount} color="text-alert" />
          <Stat label="Anomalies thermiques" value={firmsCount} color="text-fire" />
          <Stat label="Sorties UAV" value={droneCount} color="text-drone" />
          <Stat label="Frappes drone" value={strikes} color="text-alert" />
          <div className="border-t border-bd pt-1.5">
            <Stat label="Total KIA (signalés)" value={totalKIA} color="text-alert" bold />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-t3">{label}</span>
      <span className={`${color} font-bold ${bold ? 'text-xs' : ''}`}>{value}</span>
    </div>
  );
}
