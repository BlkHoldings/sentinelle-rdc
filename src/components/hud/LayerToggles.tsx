'use client';

import { useMapStore } from '@/store/useMapStore';
import type { LayerKey } from '@/types/intel';

const LAYERS: { key: LayerKey; label: string; dot: string }[] = [
  { key: 'acled',  label: 'ACLED',  dot: 'bg-alert' },
  { key: 'firms',  label: 'FIRMS',  dot: 'bg-fire'  },
  { key: 'heat',   label: 'HEAT',   dot: 'bg-fire'  },
  { key: 'drone',  label: 'UAV',    dot: 'bg-drone' },
  { key: 'mil',    label: 'FORCES', dot: 'bg-mag'   },
  { key: 'zone',   label: 'ZONES',  dot: 'bg-pur'   },
  { key: 'ref',    label: 'REF',    dot: 'bg-t3'    },
  { key: 'routes', label: 'ROUTES', dot: 'bg-amb'   },
];

export default function LayerToggles() {
  const layers      = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  return (
    <div className="absolute bottom-9 right-3 z-hud">
      <div className="panel shadow-panel">

        <div className="panel-header px-2.5 py-1 flex items-center gap-1.5">
          <div className="w-1 h-1 bg-blu shrink-0" />
          <span className="mvn-label">LAYER CTRL</span>
        </div>

        <div className="p-1">
          {LAYERS.map(({ key, label, dot }) => {
            const active = layers[key];
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={`
                  mvn-row w-full text-left transition-colors
                  ${active ? 'bg-b1' : 'opacity-50 hover:opacity-80'}
                `}
              >
                <div className={`w-1.5 h-1.5 shrink-0 ${dot} ${active ? '' : 'opacity-30'}`} />
                <span className={`text-2xs font-mono ${active ? 'text-t1' : 'text-t3'}`}>
                  {label}
                </span>
                <div className={`ml-auto w-2 h-2 border ${
                  active ? 'border-blu bg-blu/20' : 'border-b3'
                }`}>
                  {active && <div className="w-full h-full scale-50 bg-blu" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
