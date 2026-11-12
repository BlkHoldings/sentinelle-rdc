'use client';

import { create } from 'zustand';
import type { LayerKey, LayerVisibility, MapCoords, IntelEvent } from '@/types/intel';
import { DEFAULT_BASEMAP, type BasemapId, type TerrainMode } from '@/lib/basemaps';
import { LAYERS, type LayerGroupId } from '@/lib/layers';

/** A clicked or hovered map feature, reduced to what a card can show.
 *  Every interactive layer maps its feature into this one shape so the
 *  popup does not need to know which layer it came from. */
export interface MapFeatureInfo {
  layer: LayerKey;
  title: string;
  subtitle?: string;
  color: string;
  lon: number;
  lat: number;
  /** Label/value pairs, in display order. */
  rows: [string, string][];
  /** Free text — notes, description. */
  body?: string;
  /** Fusion event id, so the popup can hand off to the triage queue. */
  fusionId?: string;
}

interface MapState {
  layers:          LayerVisibility;
  /** Per-layer opacity, 0–1. */
  opacity:         Record<LayerKey, number>;
  /** When set, only this layer is drawn; the switches are left untouched
   *  so leaving solo restores exactly what was on before. */
  solo:            LayerKey | null;
  cursor:          MapCoords | null;
  selectedFeature: IntelEvent | null;
  popupCoords:     [number, number] | null;
  /** Feature pinned by a click. */
  mapFeature:      MapFeatureInfo | null;
  /** Current map zoom, mirrored for "zoom in to see this layer" notes. */
  zoom:            number;
  /** Provinces loaded from the boundary file; null until it arrives,
   *  -1 if it could not be fetched. */
  boundsLoaded:    number | null;
  setBoundsLoaded: (n: number) => void;

  basemap:         BasemapId;
  terrain:         TerrainMode;
  /** Hillshade overlay on top of imagery/vector basemaps. */
  hillshade:       boolean;
  /** MGRS digits: 3=100 m · 4=10 m · 5=1 m. */
  precision:       3 | 4 | 5;

  toggleLayer:     (key: LayerKey) => void;
  setLayer:        (key: LayerKey, on: boolean) => void;
  setGroup:        (group: LayerGroupId, on: boolean) => void;
  setOpacity:      (key: LayerKey, v: number) => void;
  setSolo:         (key: LayerKey | null) => void;
  resetLayers:     () => void;
  setCursor:       (coords: MapCoords | null) => void;
  selectFeature:   (event: IntelEvent | null, coords?: [number, number]) => void;
  setMapFeature:   (f: MapFeatureInfo | null) => void;
  setZoom:         (z: number) => void;
  setBasemap:      (id: BasemapId) => void;
  setTerrain:      (mode: TerrainMode) => void;
  toggleHillshade: () => void;
  setPrecision:    (p: 3 | 4 | 5) => void;
}

const DEFAULT_LAYERS: LayerVisibility = {
  /* The fused product leads. Raw ACLED stays on beside it because the
     two answer different questions — what was reported versus what the
     engine believes — and an analyst checks one against the other. */
  dossiers: true,
  fusion: true,
  halo:   true,
  scan:   true,
  acled:  true,
  firms:  true,
  heat:   false,
  /* Positions and airborne-sensor records are off unless asked for. They
     are illustrative, and a default view should not lead with them. */
  drone:  false,
  mil:    false,
  zone:   true,
  bounds: true,
  ref:    true,
  routes: true,
  air:    false,
  border: false,
  /* Live keyless feeds. Off by default: they only populate once the
     upstreams answer, and a switch that lights up an empty layer teaches
     the operator to distrust the switches. */
  seismic: false,
  weather: false,
  osm:     false,
};

const DEFAULT_OPACITY = Object.fromEntries(
  LAYERS.map((l) => [l.key, 1]),
) as Record<LayerKey, number>;

export const useMapStore = create<MapState>((set) => ({
  layers:          DEFAULT_LAYERS,
  opacity:         DEFAULT_OPACITY,
  solo:            null,
  cursor:          null,
  selectedFeature: null,
  popupCoords:     null,
  mapFeature:      null,
  zoom:            4.7,
  boundsLoaded:    null,
  setBoundsLoaded(n)    { set({ boundsLoaded: n }); },

  basemap:         DEFAULT_BASEMAP,
  terrain:         'off',
  hillshade:       false,
  precision:       5,

  toggleLayer(key) {
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } }));
  },

  setLayer(key, on) {
    set((s) => ({ layers: { ...s.layers, [key]: on } }));
  },

  setGroup(group, on) {
    set((s) => {
      const next = { ...s.layers };
      for (const l of LAYERS) if (l.group === group) next[l.key] = on;
      return { layers: next };
    });
  },

  setOpacity(key, v) {
    set((s) => ({ opacity: { ...s.opacity, [key]: Math.min(1, Math.max(0.1, v)) } }));
  },

  setSolo(key) {
    set((s) => ({ solo: s.solo === key ? null : key }));
  },

  resetLayers() {
    set({ layers: DEFAULT_LAYERS, opacity: DEFAULT_OPACITY, solo: null });
  },

  setCursor(coords) {
    set({ cursor: coords });
  },

  selectFeature(event, coords) {
    set({ selectedFeature: event, popupCoords: coords ?? null });
  },

  setMapFeature(f)      { set({ mapFeature: f }); },
  setZoom(z)            { set({ zoom: z }); },
  setBasemap(id)        { set({ basemap: id }); },
  setTerrain(mode)      { set({ terrain: mode }); },
  toggleHillshade()     { set((s) => ({ hillshade: !s.hillshade })); },
  setPrecision(p)       { set({ precision: p }); },
}));

/** Is a layer actually drawn right now? Solo overrides the switches. */
export function isShown(
  s: Pick<MapState, 'layers' | 'solo'>, key: LayerKey,
): boolean {
  return s.solo ? s.solo === key : s.layers[key];
}
