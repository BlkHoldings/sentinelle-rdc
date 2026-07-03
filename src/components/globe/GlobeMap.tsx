'use client';

import dynamic from 'next/dynamic';

const GlobeMapInner = dynamic(() => import('./GlobeMapInner'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-b0 flex items-center justify-center z-globe">
      <div className="text-t3 font-mono text-xs tracking-widest animate-pulse-slow">
        INITIALISATION GLOBE…
      </div>
    </div>
  ),
});

export default function GlobeMap() {
  return <GlobeMapInner />;
}
