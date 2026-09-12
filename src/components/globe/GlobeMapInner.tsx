'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Map, {
  Marker, Source, Layer, ScaleControl, NavigationControl, type MapRef,
} from 'react-map-gl/maplibre';
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore, applyFilters } from '@/store/useFeedStore';
import { useDrawStore, rectRing, circleRing } from '@/store/useDrawStore';
import { useFusionStore } from '@/store/useFusionStore';
import { useLiveStore } from '@/store/useLiveStore';
import { OSM_CATEGORY_COLOR } from '@/lib/live/osm';
import type { IsrAssessment } from '@/lib/live/weather';
import { toMGRSSync, preloadMGRS } from '@/lib/mgrs';
import { registerFlyTo, registerGetBounds } from '@/lib/mapController';
import { basemapById, probeBasemap, DEM_SOURCE, TERRAIN_EXAGGERATION } from '@/lib/basemaps';
import { MIL_POSITIONS } from '@/data/military';
import { DRONE_ISR } from '@/data/drones';
import { M23_ZONES_GEOJSON } from '@/data/zones';
import type { IntelEvent } from '@/types/intel';

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

/* Map-marker colours for the ISR verdict — separate from the panel's
   Tailwind classes because these render inside the map overlay. */
const ISR_MAP_COLOR: Record<IsrAssessment, string> = {
  FAVORABLE:     'text-grn',
  'DÉGRADÉ':     'text-amb',
  'DÉFAVORABLE': 'text-alert',
  INCONNU:       'text-t3',
};

const ZONE_FILL: Record<string, string> = { hostile: '#e03030', contested: '#d09820', watch: '#18c8e0' };
const ZONE_LINE: Record<string, string> = { hostile: '#e03030', contested: '#d09820', watch: '#18c8e0' };

export default function GlobeMapInner() {
  const mapRef = useRef<MapRef>(null);
  const { layers, setCursor, selectFeature } = useMapStore();
  const basemapId       = useMapStore((s) => s.basemap);
  const terrainMode     = useMapStore((s) => s.terrain);
  const hillshade       = useMapStore((s) => s.hillshade);
  const precision       = useMapStore((s) => s.precision);
  const showUncertainty = useMapStore((s) => s.showUncertainty);
  const { events, timeRange, searchQuery, classFilter } = useFeedStore();
  const { tool, shapes, notes, pending, addPending, cancelPending, commitShape, addNote } = useDrawStore();
  const fusionEvents = useFusionStore((s) => s.events);
  const seismic = useLiveStore((s) => s.seismic);
  const osm     = useLiveStore((s) => s.osm);
  const weather = useLiveStore((s) => s.weather);
  /* `ready` is not cosmetic: effects below reach for the MapLibre instance,
     which does not exist until onLoad fires. Without it they run once
     against a null ref, attach nothing, and never re-run — which is
     exactly how the tile-failure detector silently did nothing. */
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);

  const basemap = basemapById(basemapId);

  /* SECRET-source overlays (drone / mil) hidden under lower class filters */
  const secretVisible = classFilter === 'TOUS' || classFilter === 'SECRET';

  /* ESC cancels an in-progress drawing */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelPending(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cancelPending]);

  /* ── Terrain wiring ────────────────────────────────────────────
     Applied imperatively rather than declaratively because a basemap
     switch replaces the whole style, which drops every source with it.
     This runs on load *and* on every style change, so terrain survives
     switching from imagery to vector and back. */
  const applyTerrain = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (!map.getSource('dem')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.addSource('dem', DEM_SOURCE as any);
      }
      const exaggeration = TERRAIN_EXAGGERATION[terrainMode];
      map.setTerrain(exaggeration > 0 ? { source: 'dem', exaggeration } : null);

      const hasHillshade = !!map.getLayer('dem-hillshade');
      if (hillshade && !hasHillshade) {
        // Insert beneath the first symbol layer so place labels stay on
        // top; on a pure raster style there is none, so it goes last.
        const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
        map.addLayer({
          id: 'dem-hillshade',
          type: 'hillshade',
          source: 'dem',
          paint: {
            'hillshade-exaggeration': 0.55,
            'hillshade-shadow-color': '#000814',
            'hillshade-highlight-color': '#6a8aaa',
            'hillshade-accent-color': '#12202e',
          },
        }, firstSymbol);
      } else if (!hillshade && hasHillshade) {
        map.removeLayer('dem-hillshade');
      }
    } catch { /* style mid-swap — the next styledata event retries */ }
  }, [terrainMode, hillshade]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    /* Globe projection is only coherent at theatre zoom. It is left off
       here: with terrain enabled MapLibre renders globe + terrain
       inconsistently across versions, and the operational value of this
       map is at 10 km, not at planetary scale. */
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setSky?.({
        'sky-color': '#0a1830',
        'horizon-color': '#16273d',
        'fog-color': '#090d13',
        'fog-ground-blend': 0.6,
        'horizon-fog-blend': 0.4,
      });
    } catch { /* older maplibre */ }

    /* Register flyTo for FilterBar AOI control */
    registerFlyTo((opts) => {
      map.flyTo({
        center:    [opts.longitude, opts.latitude],
        zoom:      opts.zoom,
        pitch:     opts.pitch ?? map.getPitch(),
        bearing:   opts.bearing ?? map.getBearing(),
        duration:  1400,
        essential: true,
      });
    });

    registerGetBounds(() => {
      const b = map.getBounds();
      return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    });

    applyTerrain();
    preloadMGRS();
    setReady(true);
  }, [applyTerrain]);

  /* Re-apply terrain whenever the style is replaced or the settings move. */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    applyTerrain();
    map.on('styledata', applyTerrain);
    return () => { map.off('styledata', applyTerrain); };
  }, [applyTerrain, ready]);

  /* ── Basemap reachability ─────────────────────────────────────
     If the tile host is unreachable — a corporate proxy, a national
     filter, an outage — the operator is left looking at a black
     rectangle with every overlay still drawn on top of it. That is
     indistinguishable from a map centred on empty terrain, which is
     precisely the wrong thing to be ambiguous about.

     This probes the host directly instead of inferring from MapLibre's
     error events, which did not reliably surface tile transport failures
     through the React wrapper. One request, one unambiguous verdict. */
  useEffect(() => {
    let cancelled = false;
    setTileError(false);
    probeBasemap(basemap).then((ok) => {
      if (!cancelled) setTileError(!ok);
    });
    return () => { cancelled = true; };
  }, [basemap]);

  const handleMouseMove = useCallback(
    (e: { lngLat: { lat: number; lng: number } }) => {
      const map = mapRef.current?.getMap();
      /* Sample the DEM under the cursor. Returns null until the tile is
         resident, which is honest — 0 would read as sea level in a
         theatre whose floor is 700 m and whose peaks pass 3 000 m. */
      let elevation: number | null = null;
      try {
        const v = map?.queryTerrainElevation?.([e.lngLat.lng, e.lngLat.lat]);
        if (typeof v === 'number' && Number.isFinite(v)) elevation = v;
      } catch { /* no terrain source yet */ }

      setCursor({
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        mgrs: toMGRSSync(e.lngLat.lat, e.lngLat.lng, precision),
        elevation,
      });
    },
    [setCursor, precision],
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

  /* ── Positional uncertainty ────────────────────────────────────
     The fusion layer has always computed a per-event uncertainty radius
     — a UAS fix is ±0.5 km, "quelque part dans le Masisi" is ±25 km —
     and the map has always drawn both as an identical dot. That is the
     single most misleading thing a map like this can do: it renders a
     rumour and a grid reference as the same claim.

     Circles are emitted as real polygons in geographic coordinates so
     the halo is a true ground distance that scales correctly with zoom.
     A pixel radius would be a constant-size decoration that means
     nothing on the ground. */
  const uncertaintyGeoJSON = useMemo(() => {
    if (!showUncertainty) return { type: 'FeatureCollection' as const, features: [] };
    const SEGMENTS = 36;
    return {
      type: 'FeatureCollection' as const,
      features: fusionEvents
        .filter((e) => e.location && e.status !== 'rejected' && e.status !== 'merged')
        .slice(0, 400)
        .map((e) => {
          const { lat, lon, radius_km } = e.location!;
          const dLat = radius_km / 110.574;
          const dLon = radius_km / (111.320 * Math.cos((lat * Math.PI) / 180) || 1);
          const ring: [number, number][] = [];
          for (let i = 0; i <= SEGMENTS; i++) {
            const th = (i / SEGMENTS) * 2 * Math.PI;
            ring.push([lon + dLon * Math.cos(th), lat + dLat * Math.sin(th)]);
          }
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [ring] },
            properties: {
              confidence: e.confidence,
              radius_km,
              method: e.location!.method,
            },
          };
        }),
    };
  }, [fusionEvents, showUncertainty]);

  /* ── Live feed geometry ─────────────────────────────────────── */
  const seismicGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (seismic.data ?? []).map((e) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
      properties: { magnitude: e.magnitude, depth: e.depth_km, place: e.place },
    })),
  }), [seismic.data]);

  const osmGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (osm.data ?? []).map((f) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      properties: { name: f.name, color: OSM_CATEGORY_COLOR[f.category] },
    })),
  }), [osm.data]);

  const weatherPoints = weather.data ?? [];

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
      mapStyle={basemap.style}
      initialViewState={INITIAL_VIEW}
      maxZoom={basemap.maxZoom}
      maxPitch={85}
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
      <ScaleControl position="bottom-right" unit="metric" maxWidth={140} />
      <NavigationControl position="bottom-right" showCompass visualizePitch />

      {/* Tile host unreachable — say so rather than showing a black map
          with live overlays floating on it. */}
      {tileError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-hud
                        border border-amb/50 bg-b1/95 px-3 py-2 max-w-sm text-center shadow-float">
          <div className="text-amb text-2xs font-mono font-bold tracking-wider">
            FOND DE CARTE INACCESSIBLE
          </div>
          <div className="text-t2 text-3xs font-mono leading-snug mt-1">
            Les tuiles de « {basemap.label} » ne se chargent pas — réseau, proxy ou
            filtrage. Les calques tactiques restent valides ; seul le fond manque.
            Essayez un autre fond de carte.
          </div>
        </div>
      )}

      {/* Positional uncertainty — drawn first so it sits under every
          symbol rather than obscuring the point it qualifies. */}
      {showUncertainty && (
        <Source id="uncertainty-src" type="geojson" data={uncertaintyGeoJSON}>
          <Layer id="uncertainty-fill" type="fill" paint={{
            // Tight, believable fixes read as a faint wash; vague ones are
            // visibly large and visibly uncertain.
            'fill-color': [
              'interpolate', ['linear'], ['get', 'confidence'],
              0.2, '#e03030', 0.5, '#d09820', 0.8, '#20c880',
            ],
            'fill-opacity': [
              'interpolate', ['linear'], ['get', 'radius_km'],
              1, 0.16, 10, 0.07, 40, 0.03,
            ],
          }} />
          {/* Solid ring = measured fix, dashed = inferred. Two layers
              rather than one: `line-dasharray` is a paint property that
              MapLibre evaluates per layer, not per feature, so a data
              expression on it is rejected outright. Filtering achieves
              the same result and is the supported route. */}
          <Layer id="uncertainty-line-exact" type="line"
            filter={['==', ['get', 'method'], 'exact']}
            paint={{
              'line-color': [
                'interpolate', ['linear'], ['get', 'confidence'],
                0.2, '#e03030', 0.5, '#d09820', 0.8, '#20c880',
              ],
              'line-width': 0.9,
              'line-opacity': 0.6,
            }} />
          <Layer id="uncertainty-line-inferred" type="line"
            filter={['!=', ['get', 'method'], 'exact']}
            paint={{
              'line-color': [
                'interpolate', ['linear'], ['get', 'confidence'],
                0.2, '#e03030', 0.5, '#d09820', 0.8, '#20c880',
              ],
              'line-width': 0.8,
              'line-opacity': 0.45,
              'line-dasharray': [3, 3],
            }} />
        </Source>
      )}

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

      {/* ── Live: seismicity ──
          Sized by magnitude on an energy-proportional scale, not a linear
          one: an M5 releases ~1 000× the energy of an M3, and a linear
          radius makes them look comparable. */}
      {layers.seismic && (
        <Source id="seismic-src" type="geojson" data={seismicGeoJSON}>
          <Layer id="seismic-circles" type="circle" paint={{
            'circle-radius': [
              'interpolate', ['exponential', 2], ['get', 'magnitude'],
              2, 3, 4, 8, 6, 20,
            ],
            'circle-color': [
              'interpolate', ['linear'], ['get', 'magnitude'],
              2, '#18c8e0', 3.5, '#d09820', 5, '#e03030',
            ],
            'circle-opacity': 0.55,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#c8d8e8',
            'circle-stroke-opacity': 0.5,
          }} />
        </Source>
      )}

      {/* ── Live: OSM infrastructure from the on-demand query ── */}
      {layers.osm && (
        <Source id="osm-src" type="geojson" data={osmGeoJSON}>
          <Layer id="osm-pts" type="circle" paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 16, 6],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.9,
            'circle-stroke-width': 0.5,
            'circle-stroke-color': 'rgba(0,0,0,0.7)',
          }} />
        </Source>
      )}

      {/* ── Live: weather at collection/decision sites ── */}
      {layers.weather && weatherPoints.map((w) => (
        <Marker key={`wx-${w.name}`} longitude={w.lon} latitude={w.lat} anchor="bottom">
          <div className="pointer-events-none select-none flex flex-col items-center">
            <div className="bg-b1/95 border border-b3 px-1 py-0.5 text-3xs font-mono whitespace-nowrap">
              <span className={ISR_MAP_COLOR[w.isr]}>◈{w.isr.slice(0, 4)}</span>
              {w.rain_24h_mm != null && w.rain_24h_mm > 0 && (
                <span className="text-blu ml-1">{w.rain_24h_mm}mm</span>
              )}
            </div>
            <div className="w-px h-1.5 bg-b3" />
          </div>
        </Marker>
      ))}

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
