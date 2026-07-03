'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore, type TimeRange } from '@/store/useFeedStore';
import { flyTo } from '@/lib/mapController';
import type { LayerKey } from '@/types/intel';

const TIME_OPTS: { label: string; value: TimeRange }[] = [
  { label: '24H',  value: '24h'  },
  { label: '72H',  value: '72h'  },
  { label: '7J',   value: '7d'   },
  { label: '30J',  value: '30d'  },
  { label: 'TOUT', value: 'all'  },
];

const AOI_OPTS = [
  { label: 'TOUS — RDC',  lon: 24.0, lat: -4.0, zoom: 4.7 },
  { label: 'EST-RDC',     lon: 29.2, lat: -0.8, zoom: 6.8 },
  { label: 'NORD-KIVU',   lon: 29.3, lat: -0.5, zoom: 7.5 },
  { label: 'SUD-KIVU',    lon: 28.6, lat: -2.5, zoom: 7.5 },
  { label: 'ITURI',       lon: 29.7, lat:  1.5, zoom: 7.5 },
  { label: 'MANIEMA',     lon: 27.5, lat: -3.0, zoom: 7.0 },
  { label: 'KATANGA/HAK', lon: 27.5, lat: -7.5, zoom: 6.5 },
  { label: 'KINSHASA',    lon: 15.3, lat: -4.3, zoom: 8.5 },
  { label: 'KASAI',       lon: 23.0, lat: -5.5, zoom: 7.0 },
];

const CLASS_OPTS = ['TOUS', 'SECRET', 'CLASSIFIÉ', 'NON-CLASSIFIÉ'];

const LAYER_META: { key: LayerKey; label: string; dot: string }[] = [
  { key: 'acled',  label: 'ACLED EVENTS', dot: 'bg-alert' },
  { key: 'firms',  label: 'FIRMS THERMAL',dot: 'bg-fire'  },
  { key: 'heat',   label: 'HEAT MAP',     dot: 'bg-fire'  },
  { key: 'drone',  label: 'UAV / DRONE',  dot: 'bg-drone' },
  { key: 'mil',    label: 'MIL POSITIONS',dot: 'bg-mag'   },
  { key: 'zone',   label: 'ZONES M23',    dot: 'bg-alert' },
  { key: 'ref',    label: 'VILLES REF',   dot: 'bg-t3'    },
  { key: 'routes', label: 'AXES ROUTES',  dot: 'bg-amb'   },
];

type MenuKey = 'time' | 'aoi' | 'layers' | 'class';

export default function FilterBar() {
  const layers      = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const timeRange   = useFeedStore((s) => s.timeRange);
  const setTimeRange = useFeedStore((s) => s.setTimeRange);

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [aoiIdx,   setAoiIdx]   = useState(0);
  const [cls,      setCls]      = useState('TOUS');

  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (key: MenuKey) => setOpenMenu((v) => (v === key ? null : key));

  const handleAoi = (idx: number) => {
    setAoiIdx(idx);
    setOpenMenu(null);
    const o = AOI_OPTS[idx];
    flyTo({ longitude: o.lon, latitude: o.lat, zoom: o.zoom, pitch: 0, bearing: 0 });
  };

  const activeLayerCount = (Object.keys(layers) as LayerKey[]).filter((k) => layers[k]).length;
  const timeLabel = TIME_OPTS.find((o) => o.value === timeRange)?.label ?? '7J';

  return (
    <div ref={barRef} className="relative flex items-center gap-1.5 px-3 h-11 bg-b2 border-b border-b3 shrink-0 z-header">

      {/* TIME RANGE */}
      <Dropdown
        open={openMenu === 'time'}
        onToggle={() => toggle('time')}
        tag="TIME"
        value={timeLabel}
      >
        {TIME_OPTS.map((o) => (
          <DropItem
            key={o.value}
            active={timeRange === o.value}
            onClick={() => { setTimeRange(o.value); setOpenMenu(null); }}
          >
            {o.label}
          </DropItem>
        ))}
      </Dropdown>

      <Sep />

      {/* AREA OF INTEREST */}
      <Dropdown
        open={openMenu === 'aoi'}
        onToggle={() => toggle('aoi')}
        tag="AOI"
        value={AOI_OPTS[aoiIdx].label}
      >
        {AOI_OPTS.map((o, i) => (
          <DropItem key={o.label} active={aoiIdx === i} onClick={() => handleAoi(i)}>
            {o.label}
          </DropItem>
        ))}
      </Dropdown>

      <Sep />

      {/* LAYERS */}
      <Dropdown
        open={openMenu === 'layers'}
        onToggle={() => toggle('layers')}
        tag="LAYERS"
        value={`${activeLayerCount}`}
        wide
      >
        {LAYER_META.map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-b2 transition-colors"
          >
            <div className={`w-1.5 h-1.5 shrink-0 ${dot} ${layers[key] ? '' : 'opacity-25'}`} />
            <span className={`text-2xs font-mono flex-1 text-left ${layers[key] ? 'text-t2' : 'text-t3'}`}>
              {label}
            </span>
            <span className={`text-2xs font-mono ${layers[key] ? 'text-grn' : 'text-t3'}`}>
              {layers[key] ? '● ON' : '○ OFF'}
            </span>
          </button>
        ))}
      </Dropdown>

      <Sep />

      {/* CLASSIFICATION */}
      <Dropdown
        open={openMenu === 'class'}
        onToggle={() => toggle('class')}
        tag="CLASS"
        value={cls}
      >
        {CLASS_OPTS.map((o) => (
          <DropItem key={o} active={cls === o} onClick={() => { setCls(o); setOpenMenu(null); }}>
            {o}
          </DropItem>
        ))}
      </Dropdown>

      <div className="flex-1" />

      {/* UTC clock */}
      <UtcClock />

      <Sep />

      {/* More */}
      <button
        className="flex items-center gap-1 px-2 py-1 border border-b3 text-t3 hover:border-t3 hover:text-t2 text-2xs font-mono transition-colors"
        onClick={() => setOpenMenu(null)}
      >
        •••
      </button>
    </div>
  );
}

/* ── Sub-components ── */

function Sep() {
  return <div className="w-px h-5 bg-b3 mx-0.5 shrink-0" />;
}

interface DropdownProps {
  open:     boolean;
  onToggle: () => void;
  tag:      string;
  value:    string;
  wide?:    boolean;
  children: React.ReactNode;
}

function Dropdown({ open, onToggle, tag, value, wide, children }: DropdownProps) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2 py-1 border text-2xs font-mono transition-colors ${
          open
            ? 'border-blu text-t1 bg-blu/10'
            : 'border-b3 text-t3 hover:border-t3 hover:text-t2'
        }`}
      >
        <span className="mvn-label text-t3">{tag}</span>
        <span className="text-t1 font-bold">{value}</span>
        <span className="text-t3 text-xs">▾</span>
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-0.5 z-[100] bg-b1 border border-b3 shadow-float ${
            wide ? 'min-w-[180px]' : 'min-w-[100px]'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropItemProps {
  active:   boolean;
  onClick:  () => void;
  children: React.ReactNode;
}

function DropItem({ active, onClick, children }: DropItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-2xs font-mono transition-colors ${
        active ? 'text-t1 bg-blu/10' : 'text-t3 hover:text-t2 hover:bg-b2'
      }`}
    >
      {children}
    </button>
  );
}

function UtcClock() {
  const [utc,  setUtc]  = useState('');
  const [goma, setGoma] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh  = now.getUTCHours().toString().padStart(2, '0');
      const mm  = now.getUTCMinutes().toString().padStart(2, '0');
      const ss  = now.getUTCSeconds().toString().padStart(2, '0');
      setUtc(`${hh}${mm}${ss}Z`);
      const gh = ((now.getUTCHours() + 2) % 24).toString().padStart(2, '0');
      setGoma(`GOMA ${gh}${mm}+2`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden md:flex items-center gap-2 shrink-0">
      <span className="text-grn text-2xs font-mono font-bold tracking-widest">{utc}</span>
      <span className="text-t3 text-2xs font-mono">|</span>
      <span className="text-amb text-2xs font-mono">{goma}</span>
    </div>
  );
}
