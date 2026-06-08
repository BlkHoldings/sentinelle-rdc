'use client';

import { useApiStore } from '@/store/useApiStore';

export default function LoadingOverlay() {
  const status = useApiStore((s) => s.status);
  const isLoading = Object.values(status).some((v) => v === 'loading');

  if (!isLoading) return null;

  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-header mt-2 pointer-events-none">
      <div className="bg-b1/90 backdrop-blur-sm border border-blu/30 rounded px-3 py-1.5 flex items-center gap-2">
        <div className="w-3 h-3 border border-blu border-t-transparent rounded-full animate-spin-slow" />
        <span className="font-mono text-xs text-blu tracking-wider">ACTUALISATION…</span>
      </div>
    </div>
  );
}
