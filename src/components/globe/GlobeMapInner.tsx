'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Map, { Marker, Popup, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import { useRef, useCallback, useMemo, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore } from '@/store/useFeedStore';
import { toMGRSSync, preloadMGRS, formatLatLon } from '@/lib/mgrs';
import { MIL_POSITIONS } from '@/data/military';
import { DRONE_ISR } from '@/data/drones';
import type { IntelEvent } from '@/types/intel';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL_VIEW = {
  longitude: 30.2,
  latitude:  -0.8,
  zoom:      5.2,
  pitch:     18,
  bearing:   0,
};

/* Maven tactical colors: HOSTILE=red, FRIENDLY=blue, UNKNOWN=amber, ISR=cyan */
const MIL_DOT_COLOR: Record<string, string> = {
  hq:   '#c83048',  // hostile / mag
  arty: '#8060d8',  // pur
  cp:   '#d09820',  // unknown / amb
  log:  '#d09820',
  camp: '#d09820',
  nav:  '#1e70f0',  // friendly / blu
  idp:  '#20c880',  // confirmed / grn
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

export default function GlobeMapInner() {
  const mapRef = useRef<MapRef>(null);
  const { layers, setCursor, selectFeature, selectedFeature, popupCoords } = useMapStore();
  const { events } = useFeedStore();
  const [ready, setReady] = useState(false);

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
    } catch { /* older maplibre versions */ }
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

  const acledGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: events
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
  }), [events]);

  const firmsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: events
      .filter((e) => e.src === 'firms' && e.lat !== 0)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: { brightness: e.brightness ?? 300, frp: e.frp ?? 0 },
      })),
  }), [events]);

  /* Maven affiliation colors */
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
        platform: rec.platform, status: rec.status, id: rec.id, time: rec.time } as IntelEvent,
      [rec.lon, rec.lat],
    );
  }, [selectFeature]);

  return (
    <Map
      ref={mapRef}
      mapStyle={STYLE_URL}
      initialViewState={INITIAL_VIEW}
      style={{ position: 'absolute', inset: 0 }}
      onLoad={handleLoad}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => selectFeature(null)}
      attributionControl={false}
    >
      {/* ACLED conflict events */}
      {layers.acled && (
        <Source id="acled-src" type="geojson" data={acledGeoJSON}>
          <Layer
            id="acled-glow"
            type="circle"
            paint={{
              'circle-radius':  ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 20],
              'circle-color':   acledColor,
              'circle-opacity': 0.10,
              'circle-blur':    1,
            }}
          />
          <Layer
            id="acled-circles"
            type="circle"
            paint={{
              'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 9],
              'circle-color':        acledColor,
              'circle-opacity':      0.95,
              'circle-stroke-width': 0.5,
              'circle-stroke-color': 'rgba(0,0,0,0.6)',
            }}
          />
        </Source>
      )}

      {/* FIRMS thermal anomalies */}
      {layers.firms && (
        <Source id="firms-src" type="geojson" data={firmsGeoJSON}>
          {layers.heat && (
            <Layer
              id="firms-heat"
              type="heatmap"
              paint={{
                'heatmap-weight':    ['interpolate', ['linear'], ['get', 'frp'], 0, 0, 50, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 2.5],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0,   'rgba(224,96,32,0)',
                  0.3, 'rgba(224,96,32,0.3)',
                  0.7, 'rgba(224,96,32,0.7)',
                  1,   '#e06020',
                ],
                'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 4, 14, 10, 30],
                'heatmap-opacity': 0.75,
              }}
            />
          )}
          <Layer
            id="firms-pts"
            type="circle"
            minzoom={6}
            paint={{
              'circle-radius':       5,
              'circle-color':        '#e06020',
              'circle-opacity':      0.95,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#d09820',
            }}
          />
        </Source>
      )}

      {/* Military positions */}
      {layers.mil && MIL_POSITIONS.map((pos) => (
        <Marker
          key={pos.n}
          longitude={pos.ln}
          latitude={pos.lt}
          anchor="center"
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
      {layers.drone && DRONE_ISR.map((rec) => {
        const isStrike = rec.classification === 'strike' || rec.classification === 'strike_bda';
        const color    = DRONE_DOT_COLOR[rec.classification] ?? '#18d8f0';
        return (
          <Marker
            key={rec.id}
            longitude={rec.lon}
            latitude={rec.lat}
            anchor="center"
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

      {/* Feature popup — Maven style */}
      {selectedFeature && popupCoords && ready && (
        <Popup
          longitude={popupCoords[0]}
          latitude={popupCoords[1]}
          onClose={() => selectFeature(null)}
          closeOnClick={false}
          anchor="bottom"
          offset={16}
        >
          <div className="space-y-1.5 max-w-xs">
            {selectedFeature.id && (
              <div className="text-t3 text-2xs font-mono">TRACK: {selectedFeature.id}</div>
            )}
            {selectedFeature.platform && (
              <div className="text-cyn text-xs font-mono font-medium">
                {selectedFeature.platform} · {selectedFeature.status}
              </div>
            )}
            <div className="text-t1 font-mono font-semibold text-xs leading-tight border-t border-b3 pt-1.5">
              {selectedFeature.location ?? selectedFeature.type}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedFeature.time && (
                <span className="text-t3 text-2xs font-mono">{selectedFeature.time}</span>
              )}
              {selectedFeature.date && (
                <span className="text-t3 text-2xs font-mono">{selectedFeature.date}</span>
              )}
              {selectedFeature.fatalities != null && selectedFeature.fatalities > 0 && (
                <span className="text-alert font-bold text-xs font-mono">
                  ▲{selectedFeature.fatalities} KIA
                </span>
              )}
            </div>
            {(selectedFeature.desc ?? selectedFeature.notes) && (
              <p className="text-t2 text-2xs font-mono leading-relaxed border-t border-b3 pt-1.5">
                {selectedFeature.desc ?? selectedFeature.notes}
              </p>
            )}
            <div className="text-t3 text-2xs font-mono pt-0.5 border-t border-b3">
              {formatLatLon(selectedFeature.lat, selectedFeature.lon)}
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
