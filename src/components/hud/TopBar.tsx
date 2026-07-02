'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useFeedStore } from '@/store/useFeedStore';
import { exportCSV } from '@/lib/utils';
import type { ApiHealth } from '@/types/intel';

const FEED_STATUS: Record<ApiHealth, { dot: string; label: string }> = {
  idle:    { dot: 'bg-t3',                       label: 'IDLE' },
  loading: { dot: 'bg-amb animate-pulse-fast',   label: 'SYNC' },
  ok:      { dot: 'bg-grn',                      label: 'LIVE' },
  error:   { dot: 'bg-alert animate-pulse-slow', label: 'ERR'  },
};

const API_ITEMS = ['acled', 'firms', 'copernicus', 'drone'] as const;

export default function TopBar({ onRefresh }: { onRefresh?: () => void }) {
  const router   = useRouter();
  const session  = useAuthStore((s) => s.session);
  const logout   = useAuthStore((s) => s.logout);
  const status   = useApiStore((s) => s.status);
  const events   = useFeedStore((s) => s.events);
  const { auto, countdown, setAuto } = useRefreshStore();

  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const d  = new Date();
      const hh = d.getUTCHours().toString().padStart(2, '0');
      const mm = d.getUTCMinutes().toString().padStart(2, '0');
      const ss = d.getUTCSeconds().toString().padStart(2, '0');
      setClock(`${hh}${mm}${ss}Z`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { logout(); router.replace('/'); };

  return (
    <header className="absolute top-0 left-0 right-0 h-14 z-header flex flex-col">

      {/* Classification stripe */}
      <div className="classify h-5 flex items-center justify-center shrink-0">
        SECRET // REL TO USA, COD, UNMISS // SENTINELLE-RDC C2 INTEL
      </div>

      {/* System bar */}
      <div className="flex-1 flex items-center px-3 gap-3 bg-b2 border-b border-b3">

        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-3 bg-alert shrink-0" />
          <span className="text-t1 font-mono font-bold text-xs tracking-widest uppercase">
            SENTINELLE-RDC
          </span>
          <span className="text-t3 text-2xs font-mono hidden sm:block">// C2 INTEL MONITOR</span>
        </div>

        <div className="w-px h-5 bg-b3 shrink-0" />

        {/* Zulu clock */}
        <div className="font-mono text-xs text-grn font-bold tracking-widest shrink-0">
          {clock}
        </div>

        {/* Feed health */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {API_ITEMS.map((key) => {
            const { dot, label } = FEED_STATUS[status[key]];
            return (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 shrink-0 ${dot}`} />
                <span className="text-t3 text-2xs font-mono">
                  {key === 'copernicus' ? 'COP' : key.toUpperCase()}
                </span>
                <span className={`text-2xs font-mono ${
                  status[key] === 'ok'      ? 'text-grn'   :
                  status[key] === 'error'   ? 'text-alert' :
                  status[key] === 'loading' ? 'text-amb'   : 'text-t3'
                }`}>:{label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAuto(!auto)}
            className={`px-2 py-0.5 text-2xs font-mono border transition-colors ${
              auto
                ? 'bg-grn/10 border-grn/50 text-grn'
                : 'border-b3 text-t3 hover:border-t3 hover:text-t2'
            }`}
          >
            {auto ? `AUTO:${countdown}s` : 'AUTO:OFF'}
          </button>

          <button
            onClick={onRefresh}
            className="px-2 py-0.5 border border-b3 text-t3 hover:border-t2 hover:text-t2 text-2xs font-mono transition-colors"
          >
            REFRESH
          </button>

          <button
            onClick={() => exportCSV(events as unknown as Record<string, unknown>[])}
            className="hidden sm:block px-2 py-0.5 border border-b3 text-t3 hover:border-t2 hover:text-t2 text-2xs font-mono transition-colors"
          >
            CSV↓
          </button>

          <div className="w-px h-4 bg-b3 mx-0.5" />

          {session && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-t3 text-2xs font-mono">{session.clearance}</span>
              <span className="text-t3 text-2xs font-mono">|</span>
              <span className="text-t2 text-2xs font-mono uppercase">{session.user}</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="px-2 py-0.5 border border-alert/30 text-alert/50 hover:border-alert hover:text-alert text-2xs font-mono transition-colors"
          >
            LOGOUT
          </button>
        </div>
      </div>
    </header>
  );
}
