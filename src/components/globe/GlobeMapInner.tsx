'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Map, { Marker, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore, applyFilters } from '@/store/useFeedStore';
import { useDrawStore, rectRing, circleRing } from '@/store/useDrawStore';
import { toMGRSSync, preloadMGRS } from '@/lib/mgrs';
import { registerFlyTo } from '@/lib/mapController';
import { MIL_POSITIONS } from '@/data/military';
import { DRONE_ISR } from '@/data/drones';
import { M23_ZONES_GEOJSON } from '@/data/zones';
import type { IntelEvent } from '@/types/intel';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/* Full DRC viewport */
const INITIAL_VIEW = {
  longitude: 24.0,
  latitude:  -4.0,
  zoom:       4.7,
  pitch:      0,
  bearing:    0,
};

const MIL_DOT_COLOR: Record<string, string> = {
  hq:   '#c83048',
  arty: '#8060d8',
  cp:   '#d09820',
  log:  '#d09820',
  camp: '#d09820',
  nav:  '#1e70f0',
  idp:  '#20c880',
};

const DRONE_DOT_COLOR: Record<string, string> = {
  strike:       '#e03030',
  strike_bda:   '#d09820',
  installation: '#8060d8',
  naval:        '#1e70f0',
  logistics:    '#d09820',
  camp:         '#d09820',
  artillery:    '#8060d8',
  humanitarian: '#20c880',
  movement:     '#18c8e0',
};

const ZONE_FILL: Record<string, string> = { hostile: '#e03030', contested: '#d09820', watch: '#18c8e0' };
const ZONE_LINE: Record<string, string> = { hostile: '#e03030', contested: '#d09820', watch: '#18c8e0' };

export default function GlobeMapInner() {
  const mapRef = useRef<MapRef>(null);
  const { layers, setCursor, selectFeature } = useMapStore();
  const { events, timeRange, searchQuery, classFilter } = useFeedStore();
  const { tool, shapes, notes, pending, addPending, cancelPending, commitShape, addNote } = useDrawStore();
  const [, setReady] = useState(false);

  /* SECRET-source overlays (drone / mil) hidden under lower class filters */
  const secretVisible = classFilter === 'TOUS' || classFilter === 'SECRET';

  /* ESC cancels an in-progress drawing */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelPending(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cancelPending]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setProjection({ name: 'globe' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setFog({
        range:            [0.5, 10],
        color:            '#0a1020',
        'horizon-blend':  0.03,
        'star-intensity': 0.15,
      });
    } catch { /* older maplibre */ }

    /* Register flyTo for FilterBar AOI control */
    registerFlyTo((opts) => {
      map.flyTo({
        center:    [opts.longitude, opts.latitude],
        zoom:      opts.zoom,
        pitch:     opts.pitch ?? 0,
        bearing:   opts.bearing ?? 0,
        duration:  1400,
        essential: true,
      });
    });

    preloadMGRS();
    setReady(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: { lngLat: { lat: number; lng: number } }) => {
      setCursor({ lat: e.lngLat.lat, lon: e.lngLat.lng, mgrs: toMGRSSync(e.lngLat.lat, e.lngLat.lng) });
    },
    [setCursor],
  );

  const handleMouseLeave = useCallback(() => setCursor(null), [setCursor]);

  /* Search + time-range + classification filters, shared with the panels */
  const visible = useMemo(
    () => applyFilters(events, { query: searchQuery, timeRange, classFilter }),
    [events, searchQuery, timeRange, classFilter],
  );

  const acledGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: visible
      .filter((e) => e.src === 'acled' && e.lat !== 0)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: {
          type:       e.type,
          fatalities: e.fatalities ?? 0,
          date:       e.date,
          location:   e.location ?? '',
          notes:      e.notes ?? '',
        },
      })),
  }), [visible]);

  const firmsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: visible
      .filter((e) => e.src === 'firms' && e.lat !== 0)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: { brightness: e.brightness ?? 300, frp: e.frp ?? 0 },
      })),
  }), [visible]);

  /* Drawn shapes + in-progress preview as GeoJSON */
  const drawGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: shapes.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [s.coords] },
      properties: { kind: s.kind },
    })),
  }), [shapes]);

  const pendingGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: pending.length >= 2
      ? [{
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: pending },
          properties: {},
        }]
      : [],
  }), [pending]);

  const acledColor = [
    'match', ['get', 'type'],
    'Battles',                    '#e03030',
    'Violence against civilians', '#d09820',
    'Explosions/Remote violence', '#c83048',
    'Strategic developments',     '#20c880',
    '#1e70f0',
  ] as unknown as string;

  const handleMilClick = useCallback((pos: typeof MIL_POSITIONS[0]) => {
    selectFeature(
      { src: 'drone', type: pos.t, lat: pos.lt, lon: pos.ln, desc: pos.d, location: pos.n } as IntelEvent,
      [pos.ln, pos.lt],
    );
  }, [selectFeature]);

  const handleDroneClick = useCallback((rec: typeof DRONE_ISR[0]) => {
    selectFeature(
      { src: 'drone', type: rec.type, lat: rec.lat, lon: rec.lon, desc: rec.desc,
        platform: rec.platform, status: rec.status, id: rec.id, time: rec.time,
        date: '', classification: rec.classification } as IntelEvent,
      [rec.lon, rec.lat],
    );
  }, [selectFeature]);

  /* Map clicks: drawing tools capture vertices, select clears the feature */
  const handleClick = useCallback((e: { lngLat: { lat: number; lng: number } }) => {
    const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    if (tool === 'select') { selectFeature(null); return; }

    if (tool === 'note') {
      const text = window.prompt('Annotation:');
      if (text?.trim()) {
        addNote({ id: `note-${Date.now() % 1e9}`, lon: pt[0], lat: pt[1], text: text.trim() });
      }
      return;
    }

    if (tool === 'rect') {
      if (pending.length === 0) addPending(pt);
      else commitShape('rect', rectRing(pending[0], pt));
      return;
    }

    if (tool === 'circle') {
      if (pending.length === 0) addPending(pt);
      else commitShape('circle', circleRing(pending[0], pt));
      return;
    }

    if (tool === 'poly') addPending(pt);
  }, [tool, pending, selectFeature, addPending, commitShape, addNote]);

  /* Double-click closes an in-progress polygon */
  const handleDblClick = useCallback((e: { preventDefault?: () => void }) => {
    if (tool !== 'poly') return;
    e.preventDefault?.();
    if (pending.length >= 3) commitShape('poly', [...pending, pending[0]]);
    else cancelPending();
  }, [tool, pending, commitShape, cancelPending]);

  return (
    <Map
      ref={mapRef}
      mapStyle={STYLE_URL}
      initialViewState={INITIAL_VIEW}
      style={{ position: 'absolute', inset: 0 }}
      onLoad={handleLoad}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDblClick={handleDblClick}
      doubleClickZoom={tool !== 'poly'}
      cursor={tool === 'select' ? undefined : 'crosshair'}
      attributionControl={false}
    >
      {/* M23 / hostile zone overlays */}
      {layers.zone && (
        <Source id="m23-zones" type="geojson" data={M23_ZONES_GEOJSON}>
          <Layer id="m23-fill" type="fill" paint={{
            'fill-color': ['match', ['get', 'type'],
              'hostile', ZONE_FILL.hostile, 'contested', ZONE_FILL.contested,
              'watch', ZONE_FILL.watch, '#888888'],
            'fill-opacity': 0.10,
          }} />
          <Layer id="m23-line" type="line" paint={{
            'line-color': ['match', ['get', 'type'],
              'hostile', ZONE_LINE.hostile, 'contested', ZONE_LINE.contested,
              'watch', ZONE_LINE.watch, '#888888'],
            'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [4, 4],
          }} />
        </Source>
      )}

      {/* ACLED conflict events */}
      {layers.acled && (
        <Source id="acled-src" type="geojson" data={acledGeoJSON}>
          <Layer id="acled-glow" type="circle" paint={{
            'circle-radius':  ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 20],
            'circle-color':   acledColor,
            'circle-opacity': 0.10,
            'circle-blur':    1,
          }} />
          <Layer id="acled-circles" type="circle" paint={{
            'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 9],
            'circle-color':        acledColor,
            'circle-opacity':      0.95,
            'circle-stroke-width': 0.5,
            'circle-stroke-color': 'rgba(0,0,0,0.6)',
          }} />
        </Source>
      )}

      {/* FIRMS thermal anomalies */}
      {layers.firms && (
        <Source id="firms-src" type="geojson" data={firmsGeoJSON}>
          {layers.heat && (
            <Layer id="firms-heat" type="heatmap" paint={{
              'heatmap-weight':    ['interpolate', ['linear'], ['get', 'frp'], 0, 0, 50, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 2.5],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(224,96,32,0)', 0.3, 'rgba(224,96,32,0.3)',
                0.7, 'rgba(224,96,32,0.7)', 1, '#e06020',
              ],
              'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 4, 14, 10, 30],
              'heatmap-opacity': 0.75,
            }} />
          )}
          <Layer id="firms-pts" type="circle" minzoom={6} paint={{
            'circle-radius': 5, 'circle-color': '#e06020', 'circle-opacity': 0.95,
            'circle-stroke-width': 1, 'circle-stroke-color': '#d09820',
          }} />
        </Source>
      )}

      {/* Operator-drawn shapes */}
      {shapes.length > 0 && (
        <Source id="draw-shapes" type="geojson" data={drawGeoJSON}>
          <Layer id="draw-fill" type="fill" paint={{ 'fill-color': '#18c8e0', 'fill-opacity': 0.08 }} />
          <Layer id="draw-line" type="line" paint={{
            'line-color': '#18c8e0', 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [3, 2],
          }} />
        </Source>
      )}

      {/* In-progress drawing preview */}
      {pending.length >= 2 && (
        <Source id="draw-pending" type="geojson" data={pendingGeoJSON}>
          <Layer id="draw-pending-line" type="line" paint={{
            'line-color': '#c8d8e8', 'line-width': 1, 'line-dasharray': [2, 2],
          }} />
        </Source>
      )}
      {pending.map((pt, i) => (
        <Marker key={`pend-${i}`} longitude={pt[0]} latitude={pt[1]} anchor="center">
          <div className="w-2 h-2 border border-cyn bg-cyn/40 pointer-events-none" />
        </Marker>
      ))}

      {/* Operator annotations */}
      {notes.map((n) => (
        <Marker key={n.id} longitude={n.lon} latitude={n.lat} anchor="bottom">
          <div className="flex flex-col items-center pointer-events-none select-none">
            <div className="bg-b1/95 border border-cyn/60 px-1.5 py-0.5 text-cyn text-2xs font-mono whitespace-nowrap max-w-[180px] truncate">
              {n.text}
            </div>
            <div className="w-px h-2 bg-cyn/60" />
          </div>
        </Marker>
      ))}

      {/* Military positions */}
      {secretVisible && layers.mil && MIL_POSITIONS.map((pos) => (
        <Marker key={pos.n} longitude={pos.ln} latitude={pos.lt} anchor="center"
          onClick={(e) => { e.originalEvent.stopPropagation(); handleMilClick(pos); }}
        >
          <button
            className="flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-150 select-none cursor-pointer"
            style={{ color: MIL_DOT_COLOR[pos.t] ?? '#7890a8', fontSize: pos.t === 'hq' ? 17 : 13 }}
            title={pos.n}
          >
            {pos.s}
          </button>
        </Marker>
      ))}

      {/* Drone / UAV records */}
      {secretVisible && layers.drone && DRONE_ISR.map((rec) => {
        const isStrike = rec.classification === 'strike' || rec.classification === 'strike_bda';
        const color    = DRONE_DOT_COLOR[rec.classification] ?? '#18d8f0';
        return (
          <Marker key={rec.id} longitude={rec.lon} latitude={rec.lat} anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); handleDroneClick(rec); }}
          >
            <button
              className={`relative flex items-center justify-center cursor-pointer select-none
                w-4 h-4 border-2 transition-transform hover:scale-125 active:scale-95
                ${isStrike ? 'blast-ring' : ''}`}
              style={{ background: color + '18', borderColor: color }}
              title={`${rec.id} · ${rec.type}`}
            >
              <div className="w-1.5 h-1.5" style={{ background: color }} />
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
