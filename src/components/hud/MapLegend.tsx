'use client';

import { useState } from 'react';
import { useMapStore } from '@/store/useMapStore';

const MARKERS: { color: string; label: string; layer: string }[] = [
  { color: '#e03030', label: 'Battles',            layer: 'acled' },
  { color: '#c83048', label: 'Explosions/frappes', layer: 'acled' },
  { color: '#d09820', label: 'Violence civils',    layer: 'acled' },
  { color: '#20c880', label: 'Dév. stratégiques',  layer: 'acled' },
  { color: '#e06020', label: 'FIRMS thermique',    layer: 'firms' },
  { color: '#18d8f0', label: 'UAV / ISR',          layer: 'drone' },
  { color: '#c83048', label: 'Positions mil.',     layer: 'mil'   },
];

const ZONES: { color: string; label: string }[] = [
  { color: '#e03030', label: 'Zone hostile (M23/RDF)' },
  { color: '#d09820', label: 'Zone contestée' },
  { color: '#18c8e0', label: 'Surveillance frontière' },
];

export default function MapLegend() {
  const [open, setOpen] = useState(true);
  const layers = useMapStore((s) => s.layers);

  return (
    <div className="absolute bottom-3 right-3 z-hud hidden md:block">
      <div className="panel shadow-panel w-44">
        <button
          onClick={() => setOpen((v) => !v)}
          className="panel-header w-full px-2.5 py-1 flex items-center justify-between hover:bg-b3/40 transition-colors"
        >
          <span className="mvn-label">LÉGENDE</span>
          <span className="text-t3 text-2xs font-mono">{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div className="px-2.5 py-2 space-y-1.5">
            <div className="mvn-label mb-1">ÉVÉNEMENTS</div>
            {MARKERS.map(({ color, label, layer }) => (
              <div
                key={label}
                className={`flex items-center gap-2 transition-opacity ${
                  layers[layer as keyof typeof layers] ? 'opacity-100' : 'opacity-30'
                }`}
              >
                <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="text-t2 text-2xs font-mono">{label}</span>
              </div>
            ))}
            <div className="mvn-label mt-2 mb-1">ZONES</div>
            {ZONES.map(({ color, label }) => (
              <div key={label} className={`flex items-center gap-2 ${layers.zone ? 'opacity-100' : 'opacity-30'}`}>
                <span className="w-3 h-2 shrink-0 border" style={{ borderColor: color, background: `${color}22` }} />
                <span className="text-t2 text-2xs font-mono">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
