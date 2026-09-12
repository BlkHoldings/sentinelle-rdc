'use client';

import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { toMGRS, formatLatLon } from '@/lib/mgrs';

/** Grid resolution implied by the MGRS digit count, for the readout. */
const PRECISION_LABEL: Record<number, string> = {
  3: '100 m',
  4: '10 m',
  5: '1 m',
};

export default function CoordHUD() {
  const cursor    = useMapStore((s) => s.cursor);
  const precision = useMapStore((s) => s.precision);
  const [mgrs, setMgrs] = useState('');

  useEffect(() => {
    if (!cursor) { setMgrs(''); return; }
    toMGRS(cursor.lat, cursor.lon, precision).then(setMgrs);
  }, [cursor, precision]);

  return (
    <div className="absolute bottom-3 left-3 z-hud pointer-events-none hidden md:block">
      <div className="panel animate-slide-up shadow-panel w-60">
        <div className="panel-header px-2.5 py-1 flex items-center gap-1.5">
          <div className="w-1 h-1 bg-cyn shrink-0" />
          <span className="mvn-label">CURSOR TRACK</span>
          <span className="mvn-label ml-auto text-t3">{PRECISION_LABEL[precision]}</span>
        </div>
        {cursor ? (
          <div className="px-2.5 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="mvn-label w-10 shrink-0">LATLON</span>
              <span className="text-t2 font-mono text-2xs tracking-wide">
                {formatLatLon(cursor.lat, cursor.lon, precision === 5 ? 6 : precision === 4 ? 5 : 4)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mvn-label w-10 shrink-0">MGRS</span>
              <span className="text-cyn font-mono text-xs font-bold tracking-widest">
                {mgrs || cursor.mgrs || '——'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mvn-label w-10 shrink-0">ALT</span>
              {/* Undefined means the DEM tile has not resolved here yet.
                  Saying so beats printing a zero that reads as sea level
                  in a theatre whose valley floors sit near 900 m. */}
              <span className="text-t2 font-mono text-2xs tracking-wide">
                {cursor.elevation == null
                  ? <span className="text-t3">MNT non chargé</span>
                  : <>{Math.round(cursor.elevation)} m <span className="text-t3">MNT ~30 m</span></>}
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
