'use client';

import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { toMGRS, formatLatLon } from '@/lib/mgrs';

export default function CoordHUD() {
  const cursor = useMapStore((s) => s.cursor);
  const [mgrs, setMgrs] = useState('');

  useEffect(() => {
    if (!cursor) { setMgrs(''); return; }
    toMGRS(cursor.lat, cursor.lon).then(setMgrs);
  }, [cursor]);

  return (
    <div className="absolute bottom-3 left-3 z-hud pointer-events-none hidden md:block">
      <div className="panel animate-slide-up shadow-panel w-52">
        <div className="panel-header px-2.5 py-1 flex items-center gap-1.5">
          <div className="w-1 h-1 bg-cyn shrink-0" />
          <span className="mvn-label">CURSOR TRACK</span>
        </div>
        {cursor ? (
          <div className="px-2.5 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="mvn-label w-10 shrink-0">LATLON</span>
              <span className="text-t2 font-mono text-2xs tracking-wide">
                {formatLatLon(cursor.lat, cursor.lon)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mvn-label w-10 shrink-0">MGRS</span>
              <span className="text-cyn font-mono text-xs font-bold tracking-widest">
                {mgrs || cursor.mgrs || '——'}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-2.5 py-2">
            <span className="text-t3 text-2xs font-mono">AWAITING INPUT</span>
          </div>
        )}
      </div>
    </div>
  );
}
