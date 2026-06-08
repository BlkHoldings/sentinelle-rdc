'use client';

import { useMapStore } from '@/store/useMapStore';
import type { LayerKey } from '@/types/intel';

const LAYERS: { key: LayerKey; label: string; color: string }[] = [
  { key: 'acled',  label: 'ACLED',   color: 'text-alert' },
  { key: 'firms',  label: 'FIRMS',   color: 'text-fire'  },
  { key: 'heat',   label: 'CHALEUR', color: 'text-fire'  },
  { key: 'drone',  label: 'UAV',     color: 'text-drone' },
  { key: 'mil',    label: 'FORCES',  color: 'text-mag'   },
  { key: 'zone',   label: 'ZONES',   color: 'text-pur'   },
  { key: 'ref',    label: 'REF',     color: 'text-t3'    },
  { key: 'routes', label: 'ROUTES',  color: 'text-amb'   },
];

export default function LayerToggles() {
  const layers     = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  return (
    <div className="absolute bottom-8 right-3 z-hud">
      <div className="bg-b1/90 backdrop-blur-sm border border-bd rounded overflow-hidden">
        <div className="text-t3 text-2xs font-mono tracking-widest px-2.5 py-1.5 border-b border-bd uppercase">
          Couches
        </div>
        <div className="grid grid-cols-2 gap-px p-0.5">
          {LAYERS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`
                px-2 py-1 rounded text-2xs font-mono tracking-widest transition-all
                ${layers[key]
                  ? `${color} bg-b3`
                  : 'text-t3 bg-transparent opacity-40'}
              `}
            >
              {layers[key] ? '● ' : '○ '}{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
