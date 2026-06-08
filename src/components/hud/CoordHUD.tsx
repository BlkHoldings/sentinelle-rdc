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

  if (!cursor) {
    return (
      <div className="absolute bottom-8 left-3 z-hud font-mono pointer-events-none">
        <div className="bg-b1/80 backdrop-blur-sm border border-bd rounded px-2.5 py-1.5 text-t3 text-2xs">
          Déplacer le curseur sur la carte
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-8 left-3 z-hud font-mono pointer-events-none animate-slide-up">
      <div className="bg-b1/90 backdrop-blur-sm border border-grn/30 rounded px-3 py-2 space-y-0.5">
        <div className="text-grn text-xs tracking-wider">
          {formatLatLon(cursor.lat, cursor.lon)}
        </div>
        <div className="text-cyn text-xs tracking-widest font-bold">
          {mgrs || cursor.mgrs || '…'}
        </div>
      </div>
    </div>
  );
}
