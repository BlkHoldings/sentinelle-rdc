'use client';

import { useFeedStore } from '@/store/useFeedStore';
import { useMapStore } from '@/store/useMapStore';
import { DRONE_ISR } from '@/data/drones';
import { MIL_POSITIONS } from '@/data/military';
import type { LayerKey } from '@/types/intel';

export default function LayerToggles() {
  const layers      = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const events      = useFeedStore((s) => s.events);

  const acledN = events.filter((e) => e.src === 'acled').length;
  const firmsN = events.filter((e) => e.src === 'firms').length;
  const droneN = events.filter((e) => e.src === 'drone').length || DRONE_ISR.length;

  const CHIPS: { key: LayerKey; label: string; count?: number; dot: string }[] = [
    { key: 'acled',  label: 'ACLED',   count: acledN,           dot: 'bg-alert' },
    { key: 'firms',  label: 'FIRMS',   count: firmsN,           dot: 'bg-fire'  },
    { key: 'heat',   label: 'HEAT',                             dot: 'bg-fire'  },
    { key: 'drone',  label: 'UAV',     count: droneN,           dot: 'bg-drone' },
    { key: 'mil',    label: 'MIL',     count: MIL_POSITIONS.length, dot: 'bg-mag' },
    { key: 'zone',   label: 'ZONE M23',                         dot: 'bg-alert' },
    { key: 'ref',    label: 'VILLES',                           dot: 'bg-t3'    },
    { key: 'routes', label: 'ROUTES',                           dot: 'bg-amb'   },
  ];

  return (
    <div className="absolute top-14 left-3 z-hud flex flex-wrap gap-1 pt-1.5">
      {CHIPS.map(({ key, label, count, dot }) => {
        const active = layers[key];
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`
              flex items-center gap-1 px-1.5 py-0.5 text-2xs font-mono border transition-colors
              ${active
                ? 'border-b3 bg-b1/90 text-t2'
                : 'border-b3/40 bg-b0/60 text-t3 opacity-60 hover:opacity-90'}
            `}
          >
            <div className={`w-1 h-1 shrink-0 ${dot} ${active ? '' : 'opacity-30'}`} />
            <span>{label}</span>
            {count !== undefined && (
              <span className={`font-bold ml-0.5 ${
                active && count > 0 ? 'text-t1' : 'text-t3'
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
