'use client';

/* Legend, generated from the layer registry. It lists only layers that
   are being drawn right now, so it describes the map in front of the
   operator rather than every symbol the system is capable of. */

import { useState } from 'react';
import { useMapStore, isShown } from '@/store/useMapStore';
import { useLayerCounts } from '@/hooks/useLayerCounts';
import { LAYERS, type LegendEntry } from '@/lib/layers';

function Swatch({ color, shape = 'dot' }: LegendEntry) {
  if (shape === 'area') {
    return <span className="w-3 h-2 shrink-0 border" style={{ borderColor: color, background: `${color}22` }} />;
  }
  if (shape === 'line') {
    return <span className="w-3 h-0 shrink-0 border-t-2 border-dashed" style={{ borderColor: color }} />;
  }
  if (shape === 'ring') {
    return <span className="w-2 h-2 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: color }} />;
  }
  if (shape === 'square') {
    return <span className="w-2 h-2 shrink-0 border-[1.5px]" style={{ borderColor: color, background: `${color}30` }} />;
  }
  return <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: color }} />;
}

export default function MapLegend() {
  const [open, setOpen] = useState(true);
  const layers = useMapStore((s) => s.layers);
  const solo   = useMapStore((s) => s.solo);
  const counts = useLayerCounts();

  const active = LAYERS.filter((l) => l.legend?.length && isShown({ layers, solo }, l.key));

  return (
    <div className="absolute bottom-10 right-14 z-hud hidden md:block" data-testid="map-legend">
      <div className="panel shadow-panel w-48">
        <button
          onClick={() => setOpen((v) => !v)}
          className="panel-header w-full px-2.5 py-1 flex items-center justify-between hover:bg-b3/40 transition-colors"
        >
          <span className="mvn-label">LÉGENDE</span>
          <span className="text-t3 text-2xs font-mono">
            {active.length} calque{active.length > 1 ? 's' : ''} {open ? '▾' : '▸'}
          </span>
        </button>
        {open && (
          <div className="px-2.5 py-1.5 space-y-2 max-h-[32vh] overflow-y-auto">
            {active.length === 0 && (
              <div className="text-3xs font-mono text-t3">Aucun calque symbolisé n’est affiché.</div>
            )}
            {active.map((l) => (
              <div key={l.key} data-legend={l.key}>
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="mvn-label truncate">{l.label}</span>
                  <span className="text-3xs font-mono text-t3 ml-auto tabular-nums shrink-0">
                    {counts[l.key] ?? '—'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {l.legend!.map((e) => (
                    <div key={e.label} className="flex items-center gap-2">
                      <Swatch {...e} />
                      <span className="text-t2 text-3xs font-mono leading-tight">{e.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
