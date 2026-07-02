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
    <div className="absolute bottom-9 left-4 z-hud pointer-events-none">
      {cursor ? (
        <div className="glass rounded-2xl px-4 py-2.5 animate-slide-up shadow-panel">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-grn shrink-0" />
              <span className="text-white font-mono text-xs font-medium tracking-wider">
                {formatLatLon(cursor.lat, cursor.lon)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-drone shrink-0" />
              <span className="text-drone font-mono text-xs font-bold tracking-widest">
                {mgrs || cursor.mgrs || '…'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl px-4 py-2 opacity-40">
          <span className="text-t3 text-2xs font-mono">Déplacer le curseur</span>
        </div>
      )}
    </div>
  );
}
