'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useFeedStore } from '@/store/useFeedStore';
import { exportCSV } from '@/lib/utils';
import type { ApiHealth } from '@/types/intel';

const DOT_COLOR: Record<ApiHealth, string> = {
  idle:    'bg-t3',
  loading: 'bg-amb animate-pulse-fast',
  ok:      'bg-grn',
  error:   'bg-alert',
};

const API_ITEMS = ['acled', 'firms', 'copernicus', 'drone'] as const;

export default function TopBar({ onRefresh }: { onRefresh?: () => void }) {
  const router      = useRouter();
  const session     = useAuthStore((s) => s.session);
  const logout      = useAuthStore((s) => s.logout);
  const status      = useApiStore((s) => s.status);
  const events      = useFeedStore((s) => s.events);
  const { auto, countdown, setAuto } = useRefreshStore();

  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = d.getUTCHours().toString().padStart(2, '0');
      const mm = d.getUTCMinutes().toString().padStart(2, '0');
      const ss = d.getUTCSeconds().toString().padStart(2, '0');
      setClock(`${hh}:${mm}:${ss} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { logout(); router.replace('/'); };

  return (
    <header className="
      absolute top-0 left-0 right-0 h-11 z-header
      flex items-center px-4 gap-3
      bg-b0/80 backdrop-blur-3xl
      border-b border-white/[0.06]
    ">
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="
          w-5 h-5 rounded-md bg-alert
          flex items-center justify-center
          text-white text-xs font-bold
          shadow-[0_2px_8px_rgba(255,69,58,0.4)]
        ">
          S
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">SENTINELLE</span>
        <span className="text-t3 text-xs hidden sm:block font-mono">&nbsp;·&nbsp; DRC-EST</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />

      {/* Live clock */}
      <div className="font-mono text-xs text-grn font-medium tracking-widest shrink-0">
        {clock}
      </div>

      {/* API health pills */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        {API_ITEMS.map((key) => (
          <div key={key} className="flex items-center gap-1 glass-light rounded-full px-2 py-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[status[key]]}`} />
            <span className="text-t2 text-2xs font-mono uppercase">{key === 'copernicus' ? 'COP' : key.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Auto-refresh */}
        <button
          onClick={() => setAuto(!auto)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-mono font-medium
            transition-all duration-150
            ${auto
              ? 'bg-grn/[0.12] text-grn ring-1 ring-grn/30'
              : 'bg-white/[0.06] text-t3 ring-1 ring-white/10 hover:bg-white/[0.09]'}
          `}
        >
          <div className={`w-1 h-1 rounded-full ${auto ? 'bg-grn' : 'bg-t3'}`} />
          {auto ? `${countdown}s` : 'AUTO'}
        </button>

        {/* Manual refresh */}
        <button
          onClick={onRefresh}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 text-t2 hover:text-white transition-all text-sm"
          title="Actualiser"
        >
          ↺
        </button>

        {/* CSV export */}
        <button
          onClick={() => exportCSV(events as unknown as Record<string, unknown>[])}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/10 text-t2 hover:text-white text-2xs font-mono transition-all"
          title="Exporter CSV"
        >
          ↓ CSV
        </button>

        <div className="w-px h-4 bg-white/10 mx-0.5" />

        {/* Clearance badge */}
        {session && (
          <div className="hidden sm:block glass-light rounded-full px-2.5 py-1">
            <span className="text-t2 text-2xs font-mono">{session.clearance.split(' ').map((w) => w[0]).join('')}</span>
            <span className="text-t3 text-2xs font-mono mx-1">·</span>
            <span className="text-t2 text-2xs font-mono">{session.user}</span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-alert/[0.08] hover:bg-alert/[0.16] text-alert/60 hover:text-alert text-xs transition-all"
          title="Déconnexion"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
