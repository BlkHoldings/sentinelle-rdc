'use client';

import { useEffect, useState, useCallback } from 'react';
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

interface Props {
  onRefresh?: () => void;
  onToggleIntsum?: () => void;
  intsumOpen?: boolean;
}

export default function TopBar({ onRefresh, onToggleIntsum, intsumOpen }: Props) {
  const router   = useRouter();
  const session  = useAuthStore((s) => s.session);
  const logout   = useAuthStore((s) => s.logout);
  const status   = useApiStore((s) => s.status);
  const events   = useFeedStore((s) => s.events);
  const { auto, countdown, setAuto } = useRefreshStore();

  const [utcClock,    setUtcClock]    = useState('');
  const [gomaTime,    setGomaTime]    = useState('');
  const [utcDate,     setUtcDate]     = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Live clocks */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh  = now.getUTCHours().toString().padStart(2, '0');
      const mm  = now.getUTCMinutes().toString().padStart(2, '0');
      const ss  = now.getUTCSeconds().toString().padStart(2, '0');
      setUtcClock(`${hh}${mm}${ss}Z`);

      const y = now.getUTCFullYear();
      const mo = (now.getUTCMonth() + 1).toString().padStart(2, '0');
      const d  = now.getUTCDate().toString().padStart(2, '0');
      setUtcDate(`${y}-${mo}-${d}`);

      /* Goma is UTC+2 (Central African Time) */
      const gh = ((now.getUTCHours() + 2) % 24).toString().padStart(2, '0');
      const gm = mm;
      setGomaTime(`${gh}${gm}+2`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* Fullscreen tracking */
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleLogout = () => { logout(); router.replace('/'); };

  const isLive = Object.values(status).some((s) => s === 'ok');

  return (
    <header className="absolute top-0 left-0 right-0 h-14 z-header flex flex-col">

      {/* Classification stripe */}
      <div className="classify h-5 flex items-center justify-center shrink-0">
        SECRET // REL TO USA, COD, UNMISS // SENTINELLE-RDC C2 INTEL
      </div>

      {/* System bar */}
      <div className="flex-1 flex items-center px-3 gap-2.5 bg-b2 border-b border-b3 overflow-hidden">

        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-3 bg-alert shrink-0" />
          <span className="text-t1 font-mono font-bold text-xs tracking-widest uppercase">
            SENTINELLE-RDC
          </span>
        </div>

        <div className="w-px h-4 bg-b3 shrink-0" />

        {/* LIVE OPS indicator */}
        <div className="flex items-center gap-1 shrink-0">
          <div className={`w-1.5 h-1.5 shrink-0 ${isLive ? 'bg-alert animate-pulse-slow' : 'bg-t3'}`} />
          <span className={`text-2xs font-mono font-bold ${isLive ? 'text-alert' : 'text-t3'}`}>
            {isLive ? 'LIVE OPS' : 'STANDBY'}
          </span>
        </div>

        <div className="w-px h-4 bg-b3 shrink-0" />

        {/* Date + clocks */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="text-t3 text-2xs font-mono">{utcDate}</span>
          <span className="text-grn text-xs font-mono font-bold tracking-widest">{utcClock}</span>
          <span className="text-t3 text-2xs font-mono">|</span>
          <span className="text-t3 text-2xs font-mono">GOMA</span>
          <span className="text-amb text-2xs font-mono font-bold">{gomaTime}</span>
        </div>

        {/* API health */}
        <div className="hidden lg:flex items-center gap-2.5 shrink-0 ml-1">
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
        <div className="flex items-center gap-1">

          {/* Intelligence Summary toggle */}
          <button
            onClick={onToggleIntsum}
            className={`px-2 py-0.5 text-2xs font-mono border transition-colors ${
              intsumOpen
                ? 'bg-alert/10 border-alert/50 text-alert'
                : 'border-b3 text-t3 hover:border-t3 hover:text-t2'
            }`}
          >
            INTSUM
          </button>

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

          <button
            onClick={toggleFullscreen}
            className={`px-2 py-0.5 border text-2xs font-mono transition-colors ${
              isFullscreen
                ? 'border-cyn/50 text-cyn bg-cyn/10'
                : 'border-b3 text-t3 hover:border-t2 hover:text-t2'
            }`}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '⊠' : '⊡'}
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
