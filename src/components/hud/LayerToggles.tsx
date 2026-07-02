'use client';

import { useMapStore } from '@/store/useMapStore';
import type { LayerKey } from '@/types/intel';

const LAYERS: { key: LayerKey; label: string; dot: string }[] = [
  { key: 'acled',  label: 'ACLED',    dot: 'bg-alert' },
  { key: 'firms',  label: 'FIRMS',    dot: 'bg-fire'  },
  { key: 'heat',   label: 'Chaleur',  dot: 'bg-fire'  },
  { key: 'drone',  label: 'UAV',      dot: 'bg-drone' },
  { key: 'mil',    label: 'Forces',   dot: 'bg-mag'   },
  { key: 'zone',   label: 'Zones',    dot: 'bg-pur'   },
  { key: 'ref',    label: 'Réf.',     dot: 'bg-t3'    },
  { key: 'routes', label: 'Routes',   dot: 'bg-amb'   },
];

export default function LayerToggles() {
  const layers      = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  return (
    <div className="absolute bottom-9 right-4 z-hud">
      <div className="glass rounded-2xl overflow-hidden shadow-panel">
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <span className="text-t3 text-2xs font-mono uppercase tracking-widest">Couches</span>
        </div>
        <div className="p-1.5 grid grid-cols-2 gap-0.5">
          {LAYERS.map(({ key, label, dot }) => {
            const active = layers[key];
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium
                  transition-all duration-150
                  ${active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-t3 hover:bg-white/[0.04] hover:text-t2'}
                `}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity ${dot} ${active ? 'opacity-100' : 'opacity-30'}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
