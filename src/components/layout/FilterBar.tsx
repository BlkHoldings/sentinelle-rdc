'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore, applyFilters, type TimeRange, type ClassFilter } from '@/store/useFeedStore';
import { flyTo } from '@/lib/mapController';
import type { LayerKey } from '@/types/intel';
import type { KeyboardEvent } from 'react';

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

const CLASS_OPTS: ClassFilter[] = ['TOUS', 'SECRET', 'CLASSIFIÉ', 'NON-CLASSIFIÉ'];

/** Trigger a client-side file download. */
function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

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

type MenuKey = 'time' | 'aoi' | 'layers' | 'class' | 'more';

export default function FilterBar() {
  const layers      = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const timeRange   = useFeedStore((s) => s.timeRange);
  const setTimeRange = useFeedStore((s) => s.setTimeRange);
  const events         = useFeedStore((s) => s.events);
  const classFilter    = useFeedStore((s) => s.classFilter);
  const setClassFilter = useFeedStore((s) => s.setClassFilter);

  const [openMenu,  setOpenMenu]  = useState<MenuKey | null>(null);
  const [aoiIdx,    setAoiIdx]    = useState(0);
  const [searchVal, setSearchVal] = useState('');
  const searchQuery = useFeedStore((s) => s.searchQuery);
  const setSearch   = useFeedStore((s) => s.setSearch);

  /* ── Export / view actions (••• menu) ── */
  const currentFiltered = () =>
    applyFilters(events, { query: searchQuery, timeRange, classFilter });

  const exportGeoJSON = () => {
    const fc = {
      type: 'FeatureCollection',
      features: currentFiltered()
        .filter((e) => e.lat !== 0 || e.lon !== 0)
        .map((e) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
          properties: {
            src: e.src, type: e.type, date: e.date, location: e.location ?? '',
            fatalities: e.fatalities ?? 0, actor1: e.actor1 ?? '', notes: e.notes ?? e.desc ?? '',
          },
        })),
    };
    download('sentinelle-rdc-events.geojson', 'application/geo+json', JSON.stringify(fc, null, 2));
    setOpenMenu(null);
  };

  const exportCSV = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const rows = currentFiltered().map((e) =>
      [e.src, e.type, e.date, e.location ?? '', e.lat, e.lon, e.fatalities ?? 0,
       e.actor1 ?? '', e.actor2 ?? '', (e.notes ?? e.desc ?? '').slice(0, 300)].map(esc).join(','),
    );
    download(
      'sentinelle-rdc-events.csv',
      'text/csv',
      ['src,type,date,location,lat,lon,fatalities,actor1,actor2,notes', ...rows].join('\n'),
    );
    setOpenMenu(null);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
    setOpenMenu(null);
  };

  const resetView = () => {
    setTimeRange('7d');
    setSearch('');
    setSearchVal('');
    setClassFilter('TOUS');
    setAoiIdx(0);
    flyTo({ longitude: 24.0, latitude: -4.0, zoom: 4.7, pitch: 0, bearing: 0 });
    setOpenMenu(null);
  };

  const handleSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearch(searchVal);
    if (e.key === 'Escape') { setSearchVal(''); setSearch(''); }
  };

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
    <div
      ref={barRef}
      className="relative flex flex-wrap md:flex-nowrap items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-0 h-auto md:h-11 bg-b2 border-b border-b3 shrink-0 z-header"
    >

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
        value={classFilter}
      >
        {CLASS_OPTS.map((o) => (
          <DropItem
            key={o}
            active={classFilter === o}
            onClick={() => { setClassFilter(o); setOpenMenu(null); }}
          >
            {o}
          </DropItem>
        ))}
      </Dropdown>

      {/* ── Global search — full row on phones ── */}
      <div className="order-last md:order-none basis-full md:basis-auto md:flex-1 md:mx-2 md:max-w-sm">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 text-xs pointer-events-none">⌕</span>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onKeyDown={handleSearchKey}
            onBlur={() => setSearch(searchVal)}
            placeholder="Rechercher événements, entités, lieux…"
            className={`
              w-full bg-b0 border pl-8 pr-3 py-1 text-t2 text-2xs font-mono
              placeholder:text-t3 focus:outline-none transition-colors
              ${searchQuery ? 'border-blu text-t1' : 'border-b3 focus:border-t3'}
            `}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchVal(''); setSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-t3 hover:text-t1 text-xs transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* UTC clock */}
      <UtcClock />

      <Sep />

      {/* More actions */}
      <div className="relative shrink-0">
        <button
          className={`flex items-center gap-1 px-2 py-1 border text-2xs font-mono transition-colors ${
            openMenu === 'more'
              ? 'border-blu text-t1 bg-blu/10'
              : 'border-b3 text-t3 hover:border-t3 hover:text-t2'
          }`}
          onClick={() => toggle('more')}
        >
          •••
        </button>
        {openMenu === 'more' && (
          <div className="absolute top-full right-0 mt-0.5 z-[100] bg-b1 border border-b3 shadow-float min-w-[190px]">
            <DropItem active={false} onClick={exportGeoJSON}>⬇ EXPORT GEOJSON</DropItem>
            <DropItem active={false} onClick={exportCSV}>⬇ EXPORT CSV</DropItem>
            <DropItem active={false} onClick={toggleFullscreen}>⛶ PLEIN ÉCRAN</DropItem>
            <DropItem active={false} onClick={resetView}>↺ RÉINITIALISER VUE</DropItem>
          </div>
        )}
      </div>
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
