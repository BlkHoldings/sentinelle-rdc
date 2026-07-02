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

/* CARTO dark matter — free, vector tiles, no API key */
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/* ── Show all of eastern DRC + Rwanda + Uganda + Burundi + Tanzania ── */
const INITIAL_VIEW = {
  longitude: 30.2,
  latitude:  -0.8,
  zoom:      5.2,
  pitch:     18,
  bearing:   0,
};

const MIL_DOT_COLOR: Record<string, string> = {
  hq:   '#ff375f',
  arty: '#bf5af2',
  cp:   '#ff9f0a',
  log:  '#ff9f0a',
  camp: '#ff9f0a',
  nav:  '#0a84ff',
  idp:  '#30d158',
};

const DRONE_DOT_COLOR: Record<string, string> = {
  strike:      '#ff453a',
  strike_bda:  '#ff9f0a',
  installation:'#bf5af2',
  naval:       '#0a84ff',
  logistics:   '#ff9f0a',
  camp:        '#ff9f0a',
  artillery:   '#bf5af2',
  humanitarian:'#30d158',
  movement:    '#40c8e0',
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
        range:           [0.5, 10],
        color:           '#0d1525',
        'horizon-blend': 0.04,
        'star-intensity': 0.18,
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

  /* ── GeoJSON: ACLED events ── */
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

  /* ── GeoJSON: FIRMS hotspots ── */
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

  /* ── ACLED color expression ── */
  const acledColor = [
    'match', ['get', 'type'],
    'Battles',                    '#ff453a',
    'Violence against civilians', '#ff9f0a',
    'Explosions/Remote violence', '#ff375f',
    'Strategic developments',     '#30d158',
    '#0a84ff',
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
      {/* ── ACLED conflict events ── */}
      {layers.acled && (
        <Source id="acled-src" type="geojson" data={acledGeoJSON}>
          <Layer
            id="acled-glow"
            type="circle"
            paint={{
              'circle-radius':  ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 20],
              'circle-color':   acledColor,
              'circle-opacity': 0.12,
              'circle-blur':    1,
            }}
          />
          <Layer
            id="acled-circles"
            type="circle"
            paint={{
              'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 9],
              'circle-color':        acledColor,
              'circle-opacity':      0.9,
              'circle-stroke-width': 0.5,
              'circle-stroke-color': 'rgba(0,0,0,0.5)',
            }}
          />
        </Source>
      )}

      {/* ── FIRMS thermal anomalies ── */}
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
                  0, 'rgba(255,107,0,0)',
                  0.3, 'rgba(255,107,0,0.3)',
                  0.7, 'rgba(255,107,0,0.7)',
                  1,   '#ff6b00',
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
              'circle-color':        '#ff6b00',
              'circle-opacity':      0.95,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ff9f0a',
            }}
          />
        </Source>
      )}

      {/* ── Military positions ── */}
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
            style={{ color: MIL_DOT_COLOR[pos.t] ?? '#98989e', fontSize: pos.t === 'hq' ? 17 : 13 }}
            title={pos.n}
          >
            {pos.s}
          </button>
        </Marker>
      ))}

      {/* ── Drone / UAV records ── */}
      {layers.drone && DRONE_ISR.map((rec) => {
        const isStrike = rec.classification === 'strike' || rec.classification === 'strike_bda';
        const color    = DRONE_DOT_COLOR[rec.classification] ?? '#64d2ff';
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
                w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 active:scale-95
                ${isStrike ? 'blast-ring' : ''}`}
              style={{ background: color + '1a', borderColor: color }}
              title={`${rec.id} · ${rec.type}`}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            </button>
          </Marker>
        );
      })}

      {/* ── Feature popup ── */}
      {selectedFeature && popupCoords && ready && (
        <Popup
          longitude={popupCoords[0]}
          latitude={popupCoords[1]}
          onClose={() => selectFeature(null)}
          closeOnClick={false}
          anchor="bottom"
          offset={16}
        >
          <div className="space-y-2 max-w-xs">
            {selectedFeature.platform && (
              <div className="text-drone text-xs font-mono font-medium">
                {selectedFeature.platform} · {selectedFeature.status}
              </div>
            )}
            <div className="text-white font-semibold leading-tight">
              {selectedFeature.location ?? selectedFeature.type}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedFeature.time && (
                <span className="text-t3 text-xs font-mono">{selectedFeature.time}</span>
              )}
              {selectedFeature.date && (
                <span className="text-t3 text-xs font-mono">{selectedFeature.date}</span>
              )}
              {selectedFeature.fatalities != null && selectedFeature.fatalities > 0 && (
                <span className="text-alert font-bold text-xs">
                  {selectedFeature.fatalities} KIA
                </span>
              )}
            </div>
            {(selectedFeature.desc ?? selectedFeature.notes) && (
              <p className="text-t2 text-xs leading-relaxed border-t border-white/10 pt-2">
                {selectedFeature.desc ?? selectedFeature.notes}
              </p>
            )}
            <div className="text-t3 text-xs font-mono pt-1">
              {formatLatLon(selectedFeature.lat, selectedFeature.lon)}
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
