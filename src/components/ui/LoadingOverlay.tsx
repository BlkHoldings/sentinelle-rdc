'use client';

import { useApiStore } from '@/store/useApiStore';

export default function LoadingOverlay() {
  const status    = useApiStore((s) => s.status);
  const isLoading = Object.values(status).some((v) => v === 'loading');

  if (!isLoading) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-header mt-1 pointer-events-none animate-slide-up">
      <div className="panel px-3 py-1.5 flex items-center gap-2 shadow-panel">
        <div className="w-2.5 h-2.5 border border-blu/40 border-t-blu animate-spin-slow" />
        <span className="text-t3 text-2xs font-mono tracking-widest">SYS: UPDATING DATA FEEDS</span>
      </div>
    </div>
  );
}
