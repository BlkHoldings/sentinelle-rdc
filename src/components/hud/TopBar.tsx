'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useFeedStore } from '@/store/useFeedStore';
import { exportCSV } from '@/lib/utils';
import type { ApiHealth } from '@/types/intel';

const healthColor: Record<ApiHealth, string> = {
  idle:    'bg-t3',
  loading: 'bg-amb animate-pulse-fast',
  ok:      'bg-grn',
  error:   'bg-alert',
};

const API_LABELS: { key: keyof ReturnType<typeof useApiStore['getState']>['status']; label: string }[] = [
  { key: 'acled',      label: 'ACLED' },
  { key: 'firms',      label: 'FIRMS' },
  { key: 'copernicus', label: 'COP' },
  { key: 'drone',      label: 'UAV' },
];

export default function TopBar({ onRefresh }: { onRefresh?: () => void }) {
  const router   = useRouter();
  const session  = useAuthStore((s) => s.session);
  const logout   = useAuthStore((s) => s.logout);
  const status   = useApiStore((s) => s.status);
  const events   = useFeedStore((s) => s.events);
  const { auto, countdown, setAuto } = useRefreshStore();

  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().split(' ')[4] + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <header className="absolute top-0 left-0 right-0 h-10 bg-b1/90 backdrop-blur-sm border-b border-bd flex items-center px-3 gap-3 z-header">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full bg-alert animate-pulse-slow" />
        <span className="font-mono font-bold text-xs tracking-widest text-t1">SENTINELLE-RDC</span>
        <span className="text-t3 text-2xs hidden sm:block">v2.0</span>
      </div>

      <div className="w-px h-5 bg-bd" />

      {/* Clock */}
      <div className="font-mono text-xs text-grn tracking-widest shrink-0">{clock}</div>

      {/* API health dots */}
      <div className="hidden md:flex items-center gap-2">
        {API_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${healthColor[status[key]]}`} />
            <span className="text-t3 text-2xs font-mono">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAuto(!auto)}
          className={`px-2 py-1 rounded text-2xs font-mono border transition-colors ${
            auto
              ? 'bg-grn/10 border-grn/30 text-grn'
              : 'bg-b2 border-bd text-t3'
          }`}
          title="Basculer l'actualisation automatique"
        >
          {auto ? `⟳ ${countdown}s` : '⟳ OFF'}
        </button>

        {/* Manual refresh */}
        <button
          onClick={onRefresh}
          className="px-2 py-1 rounded text-2xs font-mono border border-bd bg-b2 text-t2 hover:text-t1 transition-colors"
          title="Actualiser maintenant"
        >
          ↺
        </button>

        {/* CSV export */}
        <button
          onClick={() => exportCSV(events as unknown as Record<string, unknown>[])}
          className="px-2 py-1 rounded text-2xs font-mono border border-bd bg-b2 text-t2 hover:text-t1 transition-colors"
          title="Exporter CSV"
        >
          ⬇ CSV
        </button>

        <div className="w-px h-5 bg-bd" />

        {/* Session info */}
        {session && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-t3 text-2xs font-mono uppercase">{session.clearance}</span>
            <span className="text-t2 text-2xs font-mono">{session.user}</span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="px-2 py-1 rounded text-2xs font-mono border border-bd bg-b2 text-alert/70 hover:text-alert transition-colors"
          title="Déconnexion"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
