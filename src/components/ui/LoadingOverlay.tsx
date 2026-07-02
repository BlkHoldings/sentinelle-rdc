'use client';

import { useApiStore } from '@/store/useApiStore';

export default function LoadingOverlay() {
  const status    = useApiStore((s) => s.status);
  const isLoading = Object.values(status).some((v) => v === 'loading');

  if (!isLoading) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-header mt-2 pointer-events-none animate-slide-up">
      <div className="glass rounded-full px-4 py-2 flex items-center gap-2.5 shadow-panel">
        <div className="w-3.5 h-3.5 border border-blu/30 border-t-blu rounded-full animate-spin-slow" />
        <span className="text-t2 text-xs font-medium tracking-wide">Actualisation…</span>
      </div>
    </div>
  );
}
