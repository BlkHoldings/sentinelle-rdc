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
const INITIAL_VIEW = { longitude: 29.0, latitude: -1.2, zoom: 7, pitch: 30, bearing: 0 };

const MIL_SYMBOL_COLOR: Record<string, string> = {
  hq:   '#e91e63', arty: '#9c5cf5', cp:   '#ffa726',
  log:  '#ffa726', camp: '#ffa726', nav:  '#2196f3', idp: '#26d97f',
};

const DRONE_COLOR: Record<string, string> = {
  strike:     '#ff3b4a',
  strike_bda: '#ffa726',
  installation:'#9c5cf5',
  naval:      '#2196f3',
  logistics:  '#ffa726',
  camp:       '#ffa726',
  artillery:  '#9c5cf5',
  humanitarian:'#26d97f',
  movement:   '#00bcd4',
};

export default function GlobeMapInner() {
  const mapRef = useRef<MapRef>(null);
  const { layers, setCursor, selectFeature, selectedFeature, popupCoords } = useMapStore();
  const { events } = useFeedStore();
  const [ready, setReady] = useState(false);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Globe projection + atmospheric fog
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setProjection({ name: 'globe' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setFog({
        range: [0.8, 8], color: '#172338',
        'horizon-blend': 0.03, 'star-intensity': 0.15,
      });
    } catch { /* map version may not support globe */ }
    preloadMGRS();
    setReady(true);
  }, []);

  const handleMouseMove = useCallback((e: { lngLat: { lat: number; lng: number } }) => {
    const { lat, lng } = e.lngLat;
    setCursor({ lat, lon: lng, mgrs: toMGRSSync(lat, lng) });
  }, [setCursor]);

  const handleMouseLeave = useCallback(() => {
    setCursor(null);
  }, [setCursor]);

  /* ── GeoJSON sources ── */
  const acledGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: events
      .filter((e) => e.src === 'acled' && e.lat !== 0)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: { type: e.type, fatalities: e.fatalities ?? 0, id: `${e.date}-${e.lat}-${e.lon}` },
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

  /* ── ACLED circle color by event type ── */
  const acledColor = [
    'match', ['get', 'type'],
    'Battles', '#ff3b4a',
    'Violence against civilians', '#ffa726',
    'Explosions/Remote violence', '#e91e63',
    'Strategic developments', '#26d97f',
    '#2196f3',
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
      logoPosition="bottom-right"
    >
      {/* ── ACLED conflict events ── */}
      {layers.acled && (
        <Source id="acled-src" type="geojson" data={acledGeoJSON}>
          <Layer
            id="acled-circles"
            type="circle"
            paint={{
              'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 8],
              'circle-color':        acledColor,
              'circle-opacity':      0.85,
              'circle-stroke-width': 0.5,
              'circle-stroke-color': '#000',
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
                'heatmap-weight':     ['interpolate', ['linear'], ['get', 'frp'], 0, 0, 50, 1],
                'heatmap-intensity':  ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 2],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(255,87,34,0)', 0.4, 'rgba(255,87,34,0.4)',
                  0.8, 'rgba(255,87,34,0.8)', 1, 'rgba(255,87,34,1)',
                ],
                'heatmap-radius':   ['interpolate', ['linear'], ['zoom'], 4, 12, 10, 24],
                'heatmap-opacity':  0.7,
              }}
            />
          )}
          <Layer
            id="firms-pts"
            type="circle"
            minzoom={7}
            paint={{
              'circle-radius':       5,
              'circle-color':        '#ff5722',
              'circle-opacity':      0.9,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ff8a50',
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
          onClick={() => handleMilClick(pos)}
        >
          <div
            className="flex items-center justify-center cursor-pointer select-none transition-transform hover:scale-125"
            style={{ color: MIL_SYMBOL_COLOR[pos.t] ?? '#7e96b4', fontSize: pos.t === 'hq' ? 16 : 13 }}
            title={pos.n}
          >
            {pos.s}
          </div>
        </Marker>
      ))}

      {/* ── Drone / UAV records ── */}
      {layers.drone && DRONE_ISR.map((rec) => {
        const isStrike = rec.classification === 'strike' || rec.classification === 'strike_bda';
        const color = DRONE_COLOR[rec.classification] ?? '#00e5ff';
        return (
          <Marker
            key={rec.id}
            longitude={rec.lon}
            latitude={rec.lat}
            anchor="center"
            onClick={() => handleDroneClick(rec)}
          >
            <div
              className={`relative flex items-center justify-center cursor-pointer select-none w-4 h-4 rounded-full border transition-transform hover:scale-125 ${isStrike ? 'blast-ring' : ''}`}
              style={{ background: color + '22', borderColor: color }}
              title={rec.id}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            </div>
          </Marker>
        );
      })}

      {/* ── Popup for selected feature ── */}
      {selectedFeature && popupCoords && ready && (
        <Popup
          longitude={popupCoords[0]}
          latitude={popupCoords[1]}
          onClose={() => selectFeature(null)}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
        >
          <div className="font-mono text-xs space-y-1 max-w-xs">
            <div className="font-bold text-t1 text-sm">{selectedFeature.location ?? selectedFeature.type}</div>
            {selectedFeature.platform && (
              <div className="text-drone">{selectedFeature.platform} · {selectedFeature.status}</div>
            )}
            {selectedFeature.time && <div className="text-t3">{selectedFeature.time}</div>}
            {selectedFeature.fatalities !== undefined && selectedFeature.fatalities > 0 && (
              <div className="text-alert font-bold">{selectedFeature.fatalities} MORT{selectedFeature.fatalities > 1 ? 'S' : ''}</div>
            )}
            {selectedFeature.desc ?? selectedFeature.notes
              ? <p className="text-t2 leading-relaxed pt-1 border-t border-bd">{selectedFeature.desc ?? selectedFeature.notes}</p>
              : null
            }
            <div className="text-t3 text-2xs pt-1">{formatLatLon(selectedFeature.lat, selectedFeature.lon)}</div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
