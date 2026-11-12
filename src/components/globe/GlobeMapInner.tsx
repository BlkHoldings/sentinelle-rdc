'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Map, {
  Marker, Source, Layer, ScaleControl, NavigationControl, type MapRef,
} from 'react-map-gl/maplibre';
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useMapStore, isShown, type MapFeatureInfo } from '@/store/useMapStore';
import { useFeedStore, applyFilters } from '@/store/useFeedStore';
import { useDrawStore, rectRing, circleRing } from '@/store/useDrawStore';
import { useFusionStore } from '@/store/useFusionStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useStrategicStore } from '@/store/useStrategicStore';
import { useOpenDataStore } from '@/store/useOpenDataStore';
import { SAT_LAYERS, gibsTileUrl } from '@/lib/live/opendata';
import { standingLabel } from '@/lib/strategic/model';
import { OSM_CATEGORY_COLOR } from '@/lib/live/osm';
import type { IsrAssessment } from '@/lib/live/weather';
import { toMGRSSync, preloadMGRS } from '@/lib/mgrs';
import { registerFlyTo, registerGetBounds } from '@/lib/mapController';
import { basemapById, probeBasemap, DEM_SOURCE, TERRAIN_EXAGGERATION } from '@/lib/basemaps';
import { clusterPoints, dominant, CLUSTER_MAX_ZOOM } from '@/lib/cluster';
import { C } from '@/lib/layers';
import { asset } from '@/lib/asset';
import { PLACES, type Place } from '@/lib/fusion/gazetteer';
import { AXES, AIRSTRIPS, BORDER_CROSSINGS } from '@/lib/fusion/infrastructure';
import { EVENT_TYPE_LABEL } from '@/lib/fusion/schema';
import MapFeaturePopup from '@/components/hud/MapFeaturePopup';
import { MIL_POSITIONS } from '@/data/military';
import { DRONE_ISR } from '@/data/drones';
import { M23_ZONES_GEOJSON } from '@/data/zones';
import type { IntelEvent, LayerKey } from '@/types/intel';

/* Full DRC viewport */
const INITIAL_VIEW = {
  longitude: 24.0,
  latitude:  -4.0,
  zoom:       4.7,
  pitch:      0,
  bearing:    0,
};

const MIL_DOT_COLOR: Record<string, string> = {
  hq:   '#d6577a',
  arty: '#9d8cff',
  cp:   '#e2a336',
  log:  '#e2a336',
  camp: '#e2a336',
  nav:  '#6f9bff',
  idp:  '#3fb984',
};

const DRONE_DOT_COLOR: Record<string, string> = {
  strike:       '#e5484d',
  strike_bda:   '#e2a336',
  installation: '#9d8cff',
  naval:        '#6f9bff',
  logistics:    '#e2a336',
  camp:         '#e2a336',
  artillery:    '#9d8cff',
  humanitarian: '#3fb984',
  movement:     '#58c4dc',
};

/* Map-marker colours for the ISR verdict — separate from the panel's
   Tailwind classes because these render inside the map overlay. */
const ISR_MAP_COLOR: Record<IsrAssessment, string> = {
  FAVORABLE:     'text-grn',
  'DÉGRADÉ':     'text-amb',
  'DÉFAVORABLE': 'text-alert',
  INCONNU:       'text-t3',
};

const ACLED_TYPE_COLOR: Record<string, string> = {
  'Battles':                    C.alert,
  'Violence against civilians': C.amb,
  'Explosions/Remote violence': C.mag,
  'Strategic developments':     C.grn,
};

const BORDER_COLOR: Record<string, string> = { RWA: C.alert, UGA: C.amb, BDI: C.pur };

/** GeoJSON layers that answer to click and hover. Everything else on
 *  the map is either a DOM marker with its own handler or decoration. */
const INTERACTIVE_LAYERS = [
  'fusion-pts', 'acled-clusters', 'acled-circles', 'firms-pts',
  'seismic-circles', 'osm-pts', 'scan-fill', 'routes-hit', 'ref-pts',
];

/** Every interactive feature carries its own card content in these
 *  properties, so the click handler never needs to know which layer it
 *  hit or go looking for the source record. */
function card(
  layer: LayerKey, title: string, color: string, rows: [string, string][],
  extra: { subtitle?: string; body?: string; fusionId?: string } = {},
) {
  return {
    _l: layer, _t: title, _c: color, _r: JSON.stringify(rows),
    _s: extra.subtitle ?? '', _b: extra.body ?? '', _f: extra.fusionId ?? '',
  };
}

const fmtZ = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.toISOString().slice(5, 16).replace('T', ' ')}Z`;
};

/** True-ground-distance circle as a polygon ring. */
function geoRing(lon: number, lat: number, radiusKm: number, segments = 36): [number, number][] {
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.320 * Math.cos((lat * Math.PI) / 180) || 1);
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(th), lat + dLat * Math.sin(th)]);
  }
  return ring;
}

/** Which settlements earn a label at this zoom. Labelling all 122 at
 *  theatre scale produces a wall of text over the thing being read. */
function placeVisibleAt(p: Place, zoom: number): boolean {
  if (p.kind === 'province' || p.kind === 'territory' || p.kind === 'feature') return false;
  if (zoom < 6)   return (p.pop ?? 0) >= 250_000;
  if (zoom < 7.5) return (p.pop ?? 0) >= 60_000;
  if (zoom < 9)   return (p.pop ?? 0) >= 15_000 || p.kind === 'border' || p.kind === 'camp';
  return true;
}

const ZONE_FILL: Record<string, string> = { hostile: '#e5484d', contested: '#e2a336', watch: '#58c4dc' };
const ZONE_LINE: Record<string, string> = { hostile: '#e5484d', contested: '#e2a336', watch: '#58c4dc' };

export default function GlobeMapInner() {
  const mapRef = useRef<MapRef>(null);
  const { layers, setCursor, selectFeature } = useMapStore();
  const solo          = useMapStore((s) => s.solo);
  const opacity       = useMapStore((s) => s.opacity);
  const mapFeature    = useMapStore((s) => s.mapFeature);
  const setMapFeature = useMapStore((s) => s.setMapFeature);
  const setZoom       = useMapStore((s) => s.setZoom);
  const scanClusters  = useFusionStore((s) => s.clusters);
  const strategic     = useStrategicStore((s) => s.records);
  const eonet         = useOpenDataStore((s) => s.eonet.data);
  const rivers        = useOpenDataStore((s) => s.hydro.data);
  /* One predicate for "is this layer drawn", so solo cannot be honoured
     by some layers and ignored by others. */
  const on = useCallback((k: LayerKey) => isShown({ layers, solo }, k), [layers, solo]);
  const op = (k: LayerKey) => opacity[k] ?? 1;

  /* Zoom is quantised to half-steps before it reaches React state: the
     clustering and label selection only change at that granularity, and
     re-binning every point on each animation frame of a fly-to is waste. */
  const [view, setView] = useState({ zoom: INITIAL_VIEW.zoom, w: 20, s: -8, e: 32, n: 5 });
  /* ── Administrative boundaries ───────────────────────────────
     Fetched once from the build's own static files. A failure is
     recorded on the store so the layer manager can say the outlines are
     missing, rather than the map simply having none. */
  const setBoundsLoaded = useMapStore((s) => s.setBoundsLoaded);
  const [bounds, setBounds] = useState<{ adm0: GeoJSON.FeatureCollection; adm1: GeoJSON.FeatureCollection } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(asset('/geo/cod-adm0.json')).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
      fetch(asset('/geo/cod-adm1.json')).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    ]).then(([adm0, adm1]) => {
      if (cancelled) return;
      setBounds({ adm0, adm1 });
      setBoundsLoaded(adm1.features.length);
    }).catch(() => { if (!cancelled) setBoundsLoaded(-1); });
    return () => { cancelled = true; };
  }, [setBoundsLoaded]);

  /* Everything outside the country, as one polygon with the country cut
     out of it. Dimming it keeps neighbouring detail available while
     making the DRC the figure on the page. */
  const maskGeoJSON = useMemo(() => {
    if (!bounds) return null;
    const holes: number[][][] = [];
    for (const f of bounds.adm0.features) {
      for (const poly of (f.geometry as GeoJSON.MultiPolygon).coordinates) holes.push(poly[0]);
    }
    return {
      type: 'Feature' as const, properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] },
    };
  }, [bounds]);

  const [hover, setHover] = useState<{ x: number; y: number; title: string; color: string } | null>(null);
  const basemapId       = useMapStore((s) => s.basemap);
  const terrainMode     = useMapStore((s) => s.terrain);
  const hillshade       = useMapStore((s) => s.hillshade);
  const precision       = useMapStore((s) => s.precision);
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

  const syncView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const z = Math.round(map.getZoom() * 2) / 2;
    const b = map.getBounds();
    setView({ zoom: z, w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() });
    setZoom(z);
  }, [setZoom]);

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
        'fog-color': '#0b0d10',
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
    syncView();
  }, [applyTerrain, syncView]);

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

  /* Queried by hand rather than through `interactiveLayerIds`: that prop
     hands MapLibre a fixed list, and asking it about a layer that is
     switched off — or not yet re-added after a basemap swap — raises an
     error instead of returning nothing. */
  const featureAt = useCallback((point: { x: number; y: number }) => {
    const map = mapRef.current?.getMap();
    if (!map) return null;
    const ids = INTERACTIVE_LAYERS.filter((id) => map.getLayer(id));
    if (!ids.length) return null;
    try {
      return map.queryRenderedFeatures([point.x, point.y], { layers: ids })[0] ?? null;
    } catch { return null; }
  }, []);

  const handleMouseMove = useCallback(
    (e: { lngLat: { lat: number; lng: number }; point: { x: number; y: number } }) => {
      const map = mapRef.current?.getMap();
      if (tool === 'select') {
        const f = featureAt(e.point);
        const p = f?.properties;
        setHover(p?._t ? { x: e.point.x, y: e.point.y, title: String(p._t), color: String(p._c) } : null);
      }
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
    [setCursor, precision, tool, featureAt],
  );

  /* Keep the pinned card on screen. It opens upward from its feature, so
     one near an edge would be cut off; measured after render because the
     card's height depends on what it has to say. */
  useEffect(() => {
    if (!mapFeature) return;
    const id = requestAnimationFrame(() => {
      const map = mapRef.current?.getMap();
      const cardEl = document.querySelector('[data-testid="map-feature-popup"]');
      if (!map || !cardEl) return;
      const c = cardEl.getBoundingClientRect();
      const m = map.getContainer().getBoundingClientRect();
      const dx = c.left < m.left + 8 ? c.left - m.left - 8
               : c.right > m.right - 8 ? c.right - m.right + 8 : 0;
      const dy = c.top < m.top + 8 ? c.top - m.top - 8 : 0;
      if (dx || dy) map.panBy([dx, dy], { duration: 300 });
    });
    return () => cancelAnimationFrame(id);
  }, [mapFeature]);

  const handleMouseLeave = useCallback(() => { setCursor(null); setHover(null); }, [setCursor]);

  /* Search + time-range + classification filters, shared with the panels */
  const visible = useMemo(
    () => applyFilters(events, { query: searchQuery, timeRange, classFilter }),
    [events, searchQuery, timeRange, classFilter],
  );

  /* ── ACLED: clustered in screen space ──────────────────────────
     Age is carried on every feature so recent events read brighter than
     month-old ones: at 30 days this layer is mostly history, and history
     should not shout as loudly as this morning. */
  const acledGeoJSON = useMemo(() => {
    const now = Date.now();
    const pts = visible.filter((e) => e.src === 'acled' && (e.lat !== 0 || e.lon !== 0));
    const clusters = clusterPoints(pts, view.zoom);
    const singles: GeoJSON.Feature[] = [];
    const groups: GeoJSON.Feature[] = [];

    for (const c of clusters) {
      if (c.members.length === 1) {
        const e = c.members[0];
        const t = e.date ? new Date(e.date).getTime() : NaN;
        const ageD = Number.isNaN(t) ? 30 : Math.max(0, (now - t) / 86_400_000);
        const color = ACLED_TYPE_COLOR[e.type] ?? C.blu;
        singles.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
          properties: {
            type: e.type, fatalities: e.fatalities ?? 0, age: ageD,
            ...card('acled', e.location || e.type, color, [
              ['TYPE', e.subtype || e.type],
              ['DATE', e.date || '—'],
              ['ACTEURS', [e.actor1, e.actor2].filter(Boolean).join(' ↔ ') || '—'],
              ['VICTIMES', String(e.fatalities ?? 0)],
            ], { subtitle: e.admin1, body: e.notes }),
          },
        });
      } else {
        const type = dominant(c.members, (m) => m.type);
        const color = ACLED_TYPE_COLOR[type] ?? C.blu;
        const deaths = c.members.reduce((a, m) => a + (m.fatalities ?? 0), 0);
        const dates = c.members.map((m) => m.date).filter(Boolean).sort();
        groups.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: {
            count: c.members.length, color, cluster: 1,
            ...card('acled', `${c.members.length} événements regroupés`, color, [
              ['DOMINANTE', type],
              ['VICTIMES', String(deaths)],
              ['PÉRIODE', dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : '—'],
            ], { subtitle: 'Cliquer pour zoomer et séparer' }),
          },
        });
      }
    }
    return {
      singles: { type: 'FeatureCollection' as const, features: singles },
      groups:  { type: 'FeatureCollection' as const, features: groups },
    };
  }, [visible, view.zoom]);

  const firmsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: visible
      .filter((e) => e.src === 'firms' && e.lat !== 0)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: {
          brightness: e.brightness ?? 300, frp: e.frp ?? 0,
          ...card('firms', 'Anomalie thermique', C.fire, [
            ['PUISSANCE', `${(e.frp ?? 0).toFixed(1)} MW`],
            ['LUMINANCE', `${(e.brightness ?? 0).toFixed(0)} K`],
            ['CONFIANCE', e.confidence ?? '—'],
            ['PASSAGE', `${e.date} ${e.daynight === 'N' ? 'nuit' : 'jour'}`],
          ], { body: 'Un point chaud n’est pas un tir : brûlis agricoles et feux de brousse dominent ce capteur en saison sèche.' }),
        },
      })),
  }), [visible]);

  /* ── Fused events ──────────────────────────────────────────────
     The engine's product. Bounded at the 500 highest-priority clusters:
     past that the symbols overplot anyway, and what falls off the end is
     by construction what matters least. */
  const drawnFusion = useMemo(
    () => fusionEvents
      .filter((e) => e.location && e.status !== 'rejected' && e.status !== 'merged')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 500),
    [fusionEvents],
  );

  const fusionGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: drawnFusion.map((e) => {
      const color = e.confidence >= 0.75 ? C.grn : e.confidence >= 0.45 ? C.amb : C.alert;
      const rows: [string, string][] = [
        ['CONFIANCE', `${(e.confidence * 100).toFixed(0)} %`],
        ['SOURCES', `${e.provenance.length} rapports · ${e.independent_sources} familles indép.`],
        ['STATUT', e.status.toUpperCase()],
        ['HEURE', `${fmtZ(e.timestamp)} ± ${e.time_uncertainty_min} min`],
        ['POSITION', `± ${+e.location!.radius_km.toFixed(1)} km (${e.location!.method})`],
        ['PRIORITÉ', `${e.priority.toFixed(0)} / 100`],
      ];
      if (e.actors.length) rows.push(['ACTEURS', e.actors.slice(0, 3).join(', ')]);
      if (e.casualties.fatalities != null) rows.push(['VICTIMES', String(e.casualties.fatalities)]);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.location!.lon, e.location!.lat] },
        properties: {
          confidence: e.confidence, priority: e.priority,
          confirmed: e.status === 'confirmed' ? 1 : 0,
          ...card('fusion', EVENT_TYPE_LABEL[e.event_type], color, rows, {
            subtitle: e.location!.place_name, body: e.description, fusionId: e.event_id,
          }),
        },
      };
    }),
  }), [drawnFusion]);

  /* The few events that are both fresh and important get a pulse. Kept to
     a handful on purpose — if everything pulses, nothing does. */
  const freshFusion = useMemo(() => {
    const cutoff = Date.now() - 2 * 3_600_000;
    return drawnFusion
      .filter((e) => e.priority >= 55 && new Date(e.timestamp).getTime() >= cutoff)
      .slice(0, 8);
  }, [drawnFusion]);

  /* ── Positional uncertainty ────────────────────────────────────
     The fusion layer has always computed a per-event uncertainty radius
     — a UAS fix is ±0.5 km, "quelque part dans le Masisi" is ±25 km —
     and a dot alone renders a rumour and a grid reference as the same
     claim. Circles are real polygons in geographic coordinates, so the
     halo is a true ground distance that scales correctly with zoom. */
  const uncertaintyGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: drawnFusion.slice(0, 400).map((e) => {
      const { lat, lon, radius_km } = e.location!;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [geoRing(lon, lat, radius_km)] },
        properties: { confidence: e.confidence, radius_km, method: e.location!.method },
      };
    }),
  }), [drawnFusion]);

  /* ── Significant spatio-temporal clusters ──────────────────────
     Sub-threshold candidates are drawn too, but dashed and unfilled: an
     emerging concentration is a watch item, and must not look like a
     finding. */
  const scanGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: scanClusters.map((c) => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [geoRing(c.lon, c.lat, c.radius_km, 48)] },
      properties: {
        significant: c.significant ? 1 : 0,
        ...card('scan',
          c.significant ? 'Cluster significatif' : 'Concentration sous le seuil',
          C.pur, [
            ['OBSERVÉ / ATTENDU', `${c.observed.toFixed(1)} / ${c.expected.toFixed(1)}`],
            ['RISQUE RELATIF', `× ${c.rr.toFixed(1)}`],
            ['VALEUR p', c.p.toFixed(3)],
            ['RAYON', `${+c.radius_km.toFixed(1)} km`],
            ['FENÊTRE', `${c.window_h} h`],
          ], {
            subtitle: `${c.events} événements`,
            body: c.significant
              ? 'Concentration au-delà de ce que le niveau de fond explique (balayage de Kulldorff, Monte-Carlo).'
              : 'Non significatif : à surveiller, pas à rapporter comme un constat.',
          }),
      },
    })),
  }), [scanClusters]);

  /* ── Reference geography ─────────────────────────────────────── */
  const routesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: AXES.map((a) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: a.points },
      properties: card('routes', a.name.split(' ')[0], C.amb, [
        ['AXE', a.name],
        ['TRACÉ', `${a.points.length} points de passage`],
      ], { subtitle: a.name.split(' ').slice(1).join(' '), body: 'Tracé schématique entre localités — ne pas utiliser pour la navigation.' }),
    })),
  }), []);

  const labelledPlaces = useMemo(() => {
    const padLon = (view.e - view.w) * 0.05, padLat = (view.n - view.s) * 0.05;
    return PLACES
      .filter((p) => placeVisibleAt(p, view.zoom)
        && p.lon >= view.w - padLon && p.lon <= view.e + padLon
        && p.lat >= view.s - padLat && p.lat <= view.n + padLat)
      .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
      .slice(0, 45);
  }, [view]);

  const refGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: labelledPlaces.map((p) => {
      const color = p.kind === 'camp' ? C.cyn : p.kind === 'border' ? C.amb : (p.pop ?? 0) >= 100_000 ? C.t1 : C.t2;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: {
          color, big: (p.pop ?? 0) >= 100_000 ? 1 : 0,
          ...card('ref', p.name, color, [
            ['TYPE', p.kind.toUpperCase()],
            ['PROVINCE', p.province],
            ['TERRITOIRE', p.territory ?? '—'],
            ['POPULATION', p.pop ? `≈ ${p.pop.toLocaleString('fr-FR')}` : 'non renseignée'],
          ]),
        },
      };
    }),
  }), [labelledPlaces]);

  /* ── Live feed geometry ─────────────────────────────────────── */
  const seismicGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (seismic.data ?? []).map((e) => {
      const color = e.magnitude >= 5 ? C.alert : e.magnitude >= 3.5 ? C.amb : C.cyn;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: {
          magnitude: e.magnitude,
          ...card('seismic', `Séisme M ${e.magnitude.toFixed(1)}`, color, [
            ['HEURE', fmtZ(e.time)],
            ['PROFONDEUR', `${e.depth_km.toFixed(0)} km`],
            ['NYIRAGONGO', `${e.km_to_nyiragongo.toFixed(0)} km du sommet`],
          ], { subtitle: e.place }),
        },
      };
    }),
  }), [seismic.data]);

  const osmGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (osm.data ?? []).map((f) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      properties: {
        color: OSM_CATEGORY_COLOR[f.category],
        ...card('osm', f.name || f.category, OSM_CATEGORY_COLOR[f.category], [
          ['CATÉGORIE', f.category.toUpperCase()],
          ['BALISE OSM', f.tag],
        ], { body: 'Donnée contributive OpenStreetMap — couverture inégale hors des villes.' }),
      },
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

  /* Map clicks. Drawing tools capture vertices; in select mode a click
     pins whatever feature is under it, or clears the pin on empty map. */
  const handleClick = useCallback((e: { lngLat: { lat: number; lng: number }; point: { x: number; y: number } }) => {
    const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    if (tool === 'select') {
      const f = featureAt(e.point);
      const p = f?.properties;
      if (!p?._t) { selectFeature(null); setMapFeature(null); return; }

      const [lon, lat] = f!.geometry.type === 'Point'
        ? (f!.geometry as GeoJSON.Point).coordinates as [number, number]
        : pt;

      /* A cluster's useful answer is its contents: zoom until it splits. */
      if (p.cluster) {
        const map = mapRef.current?.getMap();
        map?.easeTo({ center: [lon, lat], zoom: Math.min(CLUSTER_MAX_ZOOM + 0.5, map.getZoom() + 2), duration: 700 });
        setMapFeature(null);
        return;
      }

      let rows: [string, string][] = [];
      try { rows = JSON.parse(String(p._r)); } catch { /* malformed card */ }
      const info: MapFeatureInfo = {
        layer: p._l as LayerKey, title: String(p._t), color: String(p._c),
        lon, lat, rows,
        subtitle: p._s ? String(p._s) : undefined,
        body: p._b ? String(p._b) : undefined,
        fusionId: p._f ? String(p._f) : undefined,
      };
      setMapFeature(info);
      return;
    }

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
  }, [tool, pending, selectFeature, addPending, commitShape, addNote, featureAt, setMapFeature]);

  /* Double-click closes an in-progress polygon */
  const handleDblClick = useCallback((e: { preventDefault?: () => void }) => {
    if (tool !== 'poly') return;
    e.preventDefault?.();
    if (pending.length >= 3) commitShape('poly', [...pending, pending[0]]);
    else cancelPending();
  }, [tool, pending, commitShape, cancelPending]);

  const confColor = [
    'step', ['get', 'confidence'], C.alert, 0.45, C.amb, 0.75, C.grn,
  ] as unknown as string;

  return (
    <Map
      ref={mapRef}
      mapStyle={basemap.style}
      initialViewState={INITIAL_VIEW}
      maxZoom={basemap.maxZoom}
      maxPitch={85}
      style={{ position: 'absolute', inset: 0 }}
      onLoad={handleLoad}
      onMoveEnd={syncView}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDblClick={handleDblClick}
      doubleClickZoom={tool !== 'poly'}
      cursor={tool !== 'select' ? 'crosshair' : hover ? 'pointer' : undefined}
      attributionControl={false}
    >
      <ScaleControl position="bottom-right" unit="metric" maxWidth={140} />
      <NavigationControl position="bottom-right" showCompass visualizePitch />

      {/* Tile host unreachable — say so rather than showing a black map
          with live overlays floating on it. */}
      {tileError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-hud
                        border border-amb/50 bg-b1/95 px-3 py-2 max-w-sm text-center shadow-float">
          <div className="text-amb text-2xs font-bold tracking-wider">
            FOND DE CARTE INACCESSIBLE
          </div>
          <div className="text-t2 text-3xs leading-snug mt-1">
            Les tuiles de « {basemap.label} » ne se chargent pas — réseau, proxy ou
            filtrage. Les calques tactiques restent valides ; seul le fond manque.
            Essayez un autre fond de carte.
          </div>
        </div>
      )}

      {/* Hover identity — what a click here would open. */}
      {hover && (
        <div
          className="absolute z-hud pointer-events-none bg-b1/95 border border-b3 px-1.5 py-0.5
                     text-2xs text-t1 whitespace-nowrap max-w-[240px] truncate shadow-float"
          style={{ left: hover.x + 12, top: hover.y + 12, borderLeftColor: hover.color, borderLeftWidth: 2 }}
        >
          {hover.title}
        </div>
      )}

      {/* ══ Draw order, bottom to top: areas → lines → uncertainty →
             raw points → fused points → DOM markers. Areas first so no
             polygon ever covers the point it contains. ══ */}

      {/* Satellite imagery, directly above the basemap and under every
          overlay. Tile URLs carry the image date, so the layer is the
          picture of one stated day and not an undated mosaic. */}
      {SAT_LAYERS.filter((l) => on(l.key)).map((l) => (
        <Source key={l.key} id={`${l.key}-src`} type="raster" tiles={[gibsTileUrl(l)]} tileSize={256} maxzoom={l.maxzoom}
          attribution="NASA GIBS / EOSDIS">
          <Layer id={`${l.key}-layer`} type="raster" paint={{ 'raster-opacity': (l.key === 'sat_rain' ? 0.75 : 0.9) * op(l.key) }} />
        </Source>
      ))}

      {/* Administrative outlines and the outside-country dim */}
      {on('bounds') && bounds && maskGeoJSON && (
        <>
          <Source id="mask-src" type="geojson" data={maskGeoJSON}>
            <Layer id="mask-fill" type="fill" paint={{ 'fill-color': '#06080b', 'fill-opacity': 0.42 * op('bounds') }} />
          </Source>
          <Source id="adm1-src" type="geojson" data={bounds.adm1}>
            <Layer id="adm1-line" type="line" paint={{
              'line-color': C.t3, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 1],
              'line-opacity': 0.55 * op('bounds'), 'line-dasharray': [3, 2],
            }} />
          </Source>
          <Source id="adm0-src" type="geojson" data={bounds.adm0}>
            <Layer id="adm0-line" type="line" paint={{
              'line-color': C.t1, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 1.8],
              'line-opacity': 0.7 * op('bounds'),
            }} />
          </Source>
        </>
      )}

      {/* Terrain control */}
      {on('zone') && (
        <Source id="m23-zones" type="geojson" data={M23_ZONES_GEOJSON}>
          <Layer id="m23-fill" type="fill" paint={{
            'fill-color': ['match', ['get', 'type'],
              'hostile', ZONE_FILL.hostile, 'contested', ZONE_FILL.contested,
              'watch', ZONE_FILL.watch, '#888888'],
            'fill-opacity': 0.10 * op('zone'),
          }} />
          <Layer id="m23-line" type="line" paint={{
            'line-color': ['match', ['get', 'type'],
              'hostile', ZONE_LINE.hostile, 'contested', ZONE_LINE.contested,
              'watch', ZONE_LINE.watch, '#888888'],
            'line-width': 1.5, 'line-opacity': 0.5 * op('zone'), 'line-dasharray': [4, 4],
          }} />
        </Source>
      )}

      {/* Significant spatio-temporal clusters */}
      {on('scan') && (
        <Source id="scan-src" type="geojson" data={scanGeoJSON}>
          <Layer id="scan-fill" type="fill" paint={{
            'fill-color': C.pur,
            'fill-opacity': ['case', ['==', ['get', 'significant'], 1], 0.14 * op('scan'), 0.02 * op('scan')],
          }} />
          <Layer id="scan-line-sig" type="line" filter={['==', ['get', 'significant'], 1]} paint={{
            'line-color': C.pur, 'line-width': 2, 'line-opacity': 0.9 * op('scan'),
          }} />
          <Layer id="scan-line-watch" type="line" filter={['!=', ['get', 'significant'], 1]} paint={{
            'line-color': C.pur, 'line-width': 1, 'line-opacity': 0.5 * op('scan'), 'line-dasharray': [2, 3],
          }} />
        </Source>
      )}

      {/* Supply axes. A dark casing under the line keeps it legible on
          imagery; the wide transparent `routes-hit` layer is the click
          target, because a 2 px line is not a reasonable thing to ask
          anyone to hit. */}
      {on('routes') && (
        <Source id="routes-src" type="geojson" data={routesGeoJSON}>
          <Layer id="routes-casing" type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#04070b', 'line-width': 4.5, 'line-opacity': 0.7 * op('routes') }} />
          <Layer id="routes-line" type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': C.amb, 'line-width': 1.8, 'line-opacity': 0.85 * op('routes') }} />
          <Layer id="routes-hit" type="line"
            paint={{ 'line-color': C.amb, 'line-width': 14, 'line-opacity': 0.001 }} />
        </Source>
      )}

      {/* Positional uncertainty — under every symbol it qualifies. */}
      {on('halo') && (
        <Source id="uncertainty-src" type="geojson" data={uncertaintyGeoJSON}>
          <Layer id="uncertainty-fill" type="fill" paint={{
            'fill-color': confColor,
            'fill-opacity': [
              'interpolate', ['linear'], ['get', 'radius_km'],
              1, 0.16 * op('halo'), 10, 0.07 * op('halo'), 40, 0.03 * op('halo'),
            ],
          }} />
          {/* Solid ring = measured fix, dashed = inferred. Two layers:
              `line-dasharray` does not accept data expressions, so the
              split is done with filters. */}
          <Layer id="uncertainty-line-exact" type="line"
            filter={['==', ['get', 'method'], 'exact']}
            paint={{ 'line-color': confColor, 'line-width': 0.9, 'line-opacity': 0.6 * op('halo') }} />
          <Layer id="uncertainty-line-inferred" type="line"
            filter={['!=', ['get', 'method'], 'exact']}
            paint={{
              'line-color': confColor, 'line-width': 0.8,
              'line-opacity': 0.45 * op('halo'), 'line-dasharray': [3, 3],
            }} />
        </Source>
      )}

      {/* FIRMS thermal anomalies */}
      {(on('firms') || on('heat')) && (
        <Source id="firms-src" type="geojson" data={firmsGeoJSON}>
          {on('heat') && (
            <Layer id="firms-heat" type="heatmap" paint={{
              'heatmap-weight':    ['interpolate', ['linear'], ['get', 'frp'], 0, 0, 50, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 2.5],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(240,128,60,0)', 0.3, 'rgba(240,128,60,0.3)',
                0.7, 'rgba(240,128,60,0.7)', 1, '#f0803c',
              ],
              'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 4, 14, 10, 30],
              'heatmap-opacity': 0.75 * op('heat'),
            }} />
          )}
          {on('firms') && (
            <Layer id="firms-pts" type="circle" minzoom={6} paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 3.5, 60, 7],
              'circle-color': C.fire, 'circle-opacity': 0.9 * op('firms'),
              'circle-stroke-width': 1, 'circle-stroke-color': C.amb,
              'circle-stroke-opacity': op('firms'),
            }} />
          )}
        </Source>
      )}

      {/* ACLED — clusters below the threshold zoom, individual events
          above it. Two sources so a cluster and a lone event can never be
          styled by the same rule. */}
      {on('acled') && (
        <>
          <Source id="acled-single-src" type="geojson" data={acledGeoJSON.singles}>
            <Layer id="acled-circles" type="circle" paint={{
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                4, ['+', 3, ['min', 3, ['sqrt', ['get', 'fatalities']]]],
                10, ['+', 6, ['min', 8, ['sqrt', ['get', 'fatalities']]]],
              ],
              'circle-color': ['get', '_c'],
              'circle-opacity': [
                '*', op('acled'),
                ['interpolate', ['linear'], ['get', 'age'], 0, 0.95, 7, 0.8, 30, 0.45],
              ],
              'circle-stroke-width': 0.75,
              'circle-stroke-color': 'rgba(0,0,0,0.7)',
            }} />
          </Source>
          <Source id="acled-cluster-src" type="geojson" data={acledGeoJSON.groups}>
            <Layer id="acled-clusters" type="circle" paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 2, 10, 10, 14, 40, 20, 150, 28],
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.28 * op('acled'),
              'circle-stroke-width': 1.5,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-opacity': 0.9 * op('acled'),
            }} />
          </Source>
        </>
      )}

      {/* Live: seismicity. Sized on an energy-proportional scale — an M5
          releases ~1 000× the energy of an M3, and a linear radius makes
          them look comparable. */}
      {on('seismic') && (
        <Source id="seismic-src" type="geojson" data={seismicGeoJSON}>
          <Layer id="seismic-circles" type="circle" paint={{
            'circle-radius': ['interpolate', ['exponential', 2], ['get', 'magnitude'], 2, 3, 4, 8, 6, 20],
            'circle-color': ['get', '_c'],
            'circle-opacity': 0.5 * op('seismic'),
            'circle-stroke-width': 1,
            'circle-stroke-color': C.t1,
            'circle-stroke-opacity': 0.5 * op('seismic'),
          }} />
        </Source>
      )}

      {/* Live: OSM infrastructure from the on-demand query */}
      {on('osm') && (
        <Source id="osm-src" type="geojson" data={osmGeoJSON}>
          <Layer id="osm-pts" type="circle" paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 16, 6],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.9 * op('osm'),
            'circle-stroke-width': 0.5,
            'circle-stroke-color': 'rgba(0,0,0,0.7)',
          }} />
        </Source>
      )}

      {/* Settlements */}
      {on('ref') && (
        <Source id="ref-src" type="geojson" data={refGeoJSON}>
          <Layer id="ref-pts" type="circle" paint={{
            'circle-radius': ['case', ['==', ['get', 'big'], 1], 3.5, 2.2],
            'circle-color': '#04070b',
            'circle-opacity': op('ref'),
            'circle-stroke-width': 1.2,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': op('ref'),
          }} />
        </Source>
      )}

      {/* Fused events — on top of every raw source. Drawn as a ring with a
          translucent core so a raw ACLED dot underneath stays visible:
          the two are meant to be compared, not to hide one another. */}
      {on('fusion') && (
        <Source id="fusion-src" type="geojson" data={fusionGeoJSON}>
          <Layer id="fusion-pts" type="circle" paint={{
            'circle-radius': ['interpolate', ['linear'], ['get', 'priority'], 0, 3.5, 50, 6, 100, 10],
            'circle-color': confColor,
            'circle-opacity': 0.3 * op('fusion'),
            'circle-stroke-width': ['case', ['==', ['get', 'confirmed'], 1], 2.4, 1.5],
            'circle-stroke-color': ['case', ['==', ['get', 'confirmed'], 1], C.t1, confColor],
            'circle-stroke-opacity': op('fusion'),
          }} />
        </Source>
      )}

      {/* ══ DOM markers ══ */}

      {/* Province names, while there is room for them */}
      {on('bounds') && bounds && view.zoom < 7 && bounds.adm1.features
        // Small provinces are packed together; naming them all at country
        // scale stacks the labels on top of one another.
        .filter((f) => view.zoom >= 5.5 || (f.properties!.area as number) >= 4)
        .map((f) => {
        const [lon, lat] = f.properties!.label as [number, number];
        return (
          <Marker key={`prov-${f.properties!.iso}`} longitude={lon} latitude={lat} anchor="center">
            <span className="pointer-events-none select-none text-3xs font-medium uppercase tracking-[0.12em] text-t3 whitespace-nowrap"
              style={{ opacity: 0.85 * op('bounds'), textShadow: '0 0 3px #0b0d10, 0 0 6px #0b0d10' }}>
              {f.properties!.name}
            </span>
          </Marker>
        );
      })}

      {/* Cluster counts */}
      {on('acled') && acledGeoJSON.groups.features.map((f, i) => {
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
        return (
          <Marker key={`cl-${i}-${lon.toFixed(3)}`} longitude={lon} latitude={lat} anchor="center">
            <span
              className="pointer-events-none select-none text-2xs font-bold text-t1"
              style={{ opacity: op('acled'), textShadow: '0 0 3px #000, 0 0 3px #000' }}
            >
              {f.properties!.count}
            </span>
          </Marker>
        );
      })}

      {/* Fresh, high-priority fused events */}
      {on('fusion') && freshFusion.map((e) => (
        <Marker key={`fresh-${e.event_id}`} longitude={e.location!.lon} latitude={e.location!.lat} anchor="center">
          <div className="pointer-events-none w-5 h-5 rounded-full border border-t1 animate-ping"
               style={{ opacity: 0.7 * op('fusion') }} />
        </Marker>
      ))}

      {/* Settlement labels */}
      {on('ref') && labelledPlaces.map((p) => {
        const big = (p.pop ?? 0) >= 100_000;
        return (
          <Marker key={`pl-${p.name}`} longitude={p.lon} latitude={p.lat} anchor="left" offset={[6, 0]}>
            <span
              className={`pointer-events-none select-none whitespace-nowrap ${
                big ? 'text-2xs font-bold text-t1 tracking-wider uppercase' : 'text-3xs text-t1/80'
              }`}
              style={{ opacity: op('ref'), textShadow: '0 0 2px #000, 0 0 4px #000, 0 0 6px #000' }}
            >
              {p.name}
            </span>
          </Marker>
        );
      })}

      {/* Axis designators, once there is room for them */}
      {on('routes') && view.zoom >= 6.5 && AXES.map((a) => {
        const mid = a.points[Math.floor(a.points.length / 2)];
        return (
          <Marker key={`ax-${a.name}`} longitude={mid[0]} latitude={mid[1]} anchor="center">
            <span className="pointer-events-none select-none bg-amb text-b0 text-3xs font-bold px-1 leading-tight"
                  style={{ opacity: op('routes') }}>
              {a.name.split(' ')[0]}
            </span>
          </Marker>
        );
      })}

      {/* Strategic records. Amber until a record is both the analyst's
          own and sourced — the marker itself says how far to trust it. */}
      {on('dossiers') && strategic.filter((r) => r.lat != null && r.lon != null && r.status !== 'archived').map((r) => {
        const weak = r.illustrative || r.sources.length === 0;
        const color = weak ? C.amb : '#58c4dc';
        return (
          <Marker key={`rec-${r.id}`} longitude={r.lon!} latitude={r.lat!} anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setMapFeature({
                layer: 'dossiers', title: r.title, color, lon: r.lon!, lat: r.lat!,
                subtitle: `${r.sector} · ${r.country}${r.region ? ` / ${r.region}` : ''}`,
                rows: [['ÉTAT', standingLabel(r)], ['NATURE', r.illustrative ? 'ILLUSTRATIF — inventé pour la démonstration' : 'Dossier d’analyste']],
                body: r.summary,
              });
            }}
          >
            <button title={r.title}
              className="w-3.5 h-3.5 border-2 bg-b0/85 flex items-center justify-center hover:scale-125 transition-transform"
              style={{ borderColor: color, opacity: op('dossiers') }}>
              <span className="w-1 h-1" style={{ background: color }} />
            </button>
          </Marker>
        );
      })}

      {/* NASA EONET natural events */}
      {on('eonet') && (eonet ?? []).map((ev) => (
        <Marker key={`eo-${ev.id}`} longitude={ev.lon} latitude={ev.lat} anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setMapFeature({
              layer: 'eonet', title: ev.title, color: C.fire, lon: ev.lon, lat: ev.lat,
              subtitle: ev.category,
              rows: [['DATE', fmtZ(ev.date)], ['ÉTAT', ev.closed ? 'Clos' : 'En cours'], ['ORIGINE', ev.url.replace(/^https?:\/\//, '').split('/')[0]]],
              body: 'Recensé par NASA EONET à partir de la source indiquée. Position : dernier point connu de l’événement.',
            });
          }}
        >
          <button title={ev.title}
            className="w-3 h-3 rotate-45 border bg-b0/80 hover:scale-125 transition-transform"
            style={{ borderColor: C.fire, opacity: (ev.closed ? 0.5 : 1) * op('eonet') }} />
        </Marker>
      ))}

      {/* River discharge sites */}
      {on('rivers') && (rivers ?? []).map((r) => {
        const rising = r.ratio != null && r.ratio > 1.15;
        const color = rising ? C.amb : C.blu;
        const f = (v: number | null) => (v == null ? '—' : `${Math.round(v).toLocaleString('fr-FR')} m³/s`);
        return (
          <Marker key={`rv-${r.name}`} longitude={r.lon} latitude={r.lat} anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setMapFeature({
                layer: 'rivers', title: `${r.river} à ${r.name}`, color, lon: r.lon, lat: r.lat,
                rows: [
                  ['DÉBIT DU JOUR', f(r.today)], ['MOYENNE 7 J', f(r.weekMean)],
                  ['TENDANCE', r.ratio == null ? '—' : `${r.ratio >= 1 ? '+' : ''}${Math.round((r.ratio - 1) * 100)} %`],
                  ['PIC PRÉVU', r.forecastPeak == null ? '—' : `${f(r.forecastPeak)} le ${r.forecastPeakDate.slice(5)}`],
                ],
                body: 'Valeurs issues du modèle hydrologique GloFAS, pas d’une station de mesure. À lire comme une tendance.',
              });
            }}
          >
            <button className="select-none flex flex-col items-center" style={{ opacity: op('rivers') }}>
              <span className="bg-b1/95 border px-1 py-0.5 text-3xs font-data whitespace-nowrap rounded-sm" style={{ borderColor: color, color }}>
                {r.name} {r.ratio == null ? '' : `${r.ratio >= 1 ? '▲' : '▼'}${Math.abs(Math.round((r.ratio - 1) * 100))}%`}
              </span>
              <span className="w-px h-1.5" style={{ background: color }} />
            </button>
          </Marker>
        );
      })}

      {/* Airfields */}
      {on('air') && AIRSTRIPS.map((a) => {
        const color = a.kind === 'international' ? C.blu : C.cyn;
        return (
          <Marker key={`air-${a.name}`} longitude={a.lon} latitude={a.lat} anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setMapFeature({
                layer: 'air', title: a.name, color, lon: a.lon, lat: a.lat,
                rows: [['CLASSE', a.kind.toUpperCase()]],
                body: 'Nœud ISR / MEDEVAC / pont aérien. État de piste non suivi par ce système.',
              });
            }}
          >
            <button title={a.name}
              className="w-4 h-4 flex items-center justify-center border bg-b0/85 text-3xs leading-none hover:scale-125 transition-transform"
              style={{ borderColor: color, color, opacity: op('air') }}>
              ✈
            </button>
          </Marker>
        );
      })}

      {/* Border crossings */}
      {on('border') && BORDER_CROSSINGS.map((b) => {
        const color = BORDER_COLOR[b.kind] ?? C.amb;
        return (
          <Marker key={`bx-${b.name}`} longitude={b.lon} latitude={b.lat} anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setMapFeature({
                layer: 'border', title: b.name, color, lon: b.lon, lat: b.lat,
                rows: [['PAYS LIMITROPHE', b.kind], ['STATUT', 'Poste officiel']],
                body: 'Point de passage officiel. Les franchissements hors poste ne sont pas représentés.',
              });
            }}
          >
            <button title={`${b.name} (${b.kind})`}
              className="w-3.5 h-3.5 rotate-45 border-2 bg-b0/85 hover:scale-125 transition-transform"
              style={{ borderColor: color, opacity: op('border') }} />
          </Marker>
        );
      })}

      {/* Live: weather at collection/decision sites */}
      {on('weather') && weatherPoints.map((w) => (
        <Marker key={`wx-${w.name}`} longitude={w.lon} latitude={w.lat} anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            const n = (v: number | null, u: string, d = 0) => (v == null ? '—' : `${v.toFixed(d)} ${u}`);
            setMapFeature({
              layer: 'weather', title: `Météo — ${w.name}`, color: C.blu, lon: w.lon, lat: w.lat,
              rows: [
                ['ISR', w.isr], ['MOBILITÉ', w.mobility],
                ['PLAFOND', n(w.cloud_base_m, 'm')], ['VISIBILITÉ', n(w.visibility_m == null ? null : w.visibility_m / 1000, 'km', 1)],
                ['PLUIE 24 h / 72 h', `${n(w.rain_24h_mm, 'mm')} / ${n(w.rain_72h_mm, 'mm')}`],
                ['VENT / RAFALES', `${n(w.wind_kmh, 'km/h')} / ${n(w.wind_gust_kmh, 'km/h')}`],
              ],
            });
          }}
        >
          <button className="select-none flex flex-col items-center cursor-pointer" style={{ opacity: op('weather') }}>
            <div className="bg-b1/95 border border-b3 hover:border-t3 px-1 py-0.5 text-3xs whitespace-nowrap">
              <span className={ISR_MAP_COLOR[w.isr]}>◈{w.isr.slice(0, 4)}</span>
              {w.rain_24h_mm != null && w.rain_24h_mm > 0 && (
                <span className="text-blu ml-1">{w.rain_24h_mm}mm</span>
              )}
            </div>
            <div className="w-px h-1.5 bg-b3" />
          </button>
        </Marker>
      ))}

      {/* Operator-drawn shapes */}
      {shapes.length > 0 && (
        <Source id="draw-shapes" type="geojson" data={drawGeoJSON}>
          <Layer id="draw-fill" type="fill" paint={{ 'fill-color': '#58c4dc', 'fill-opacity': 0.08 }} />
          <Layer id="draw-line" type="line" paint={{
            'line-color': '#58c4dc', 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [3, 2],
          }} />
        </Source>
      )}

      {/* In-progress drawing preview */}
      {pending.length >= 2 && (
        <Source id="draw-pending" type="geojson" data={pendingGeoJSON}>
          <Layer id="draw-pending-line" type="line" paint={{
            'line-color': '#e6e9ee', 'line-width': 1, 'line-dasharray': [2, 2],
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
            <div className="bg-b1/95 border border-cyn/60 px-1.5 py-0.5 text-cyn text-2xs whitespace-nowrap max-w-[180px] truncate">
              {n.text}
            </div>
            <div className="w-px h-2 bg-cyn/60" />
          </div>
        </Marker>
      ))}

      {/* Military positions */}
      {secretVisible && on('mil') && MIL_POSITIONS.map((pos) => (
        <Marker key={pos.n} longitude={pos.ln} latitude={pos.lt} anchor="center"
          onClick={(e) => { e.originalEvent.stopPropagation(); handleMilClick(pos); }}
        >
          <button
            className="flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-150 select-none cursor-pointer"
            style={{
              color: MIL_DOT_COLOR[pos.t] ?? '#9aa3b0', fontSize: pos.t === 'hq' ? 17 : 13,
              opacity: op('mil'), textShadow: '0 0 3px #000, 0 0 5px #000',
            }}
            title={pos.n}
          >
            {pos.s}
          </button>
        </Marker>
      ))}

      {/* Drone / UAV records */}
      {secretVisible && on('drone') && DRONE_ISR.map((rec) => {
        const isStrike = rec.classification === 'strike' || rec.classification === 'strike_bda';
        const color    = DRONE_DOT_COLOR[rec.classification] ?? '#6fd3e6';
        return (
          <Marker key={rec.id} longitude={rec.lon} latitude={rec.lat} anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); handleDroneClick(rec); }}
          >
            <button
              className={`relative flex items-center justify-center cursor-pointer select-none
                w-4 h-4 border-2 transition-transform hover:scale-125 active:scale-95
                ${isStrike ? 'blast-ring' : ''}`}
              style={{ background: color + '18', borderColor: color, opacity: op('drone') }}
              title={`${rec.id} · ${rec.type}`}
            >
              <div className="w-1.5 h-1.5" style={{ background: color }} />
            </button>
          </Marker>
        );
      })}

      {/* Pinned feature card — last, so it sits above every marker. */}
      {mapFeature && (
        <Marker longitude={mapFeature.lon} latitude={mapFeature.lat} anchor="bottom" offset={[0, -10]}
                style={{ zIndex: 5 }}>
          <MapFeaturePopup feature={mapFeature} onClose={() => setMapFeature(null)} />
        </Marker>
      )}
    </Map>
  );
}
