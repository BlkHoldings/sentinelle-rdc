'use client';

import { create } from 'zustand';
import type { LayerKey, LayerVisibility, MapCoords, IntelEvent } from '@/types/intel';
import { DEFAULT_BASEMAP, type BasemapId, type TerrainMode } from '@/lib/basemaps';

interface MapState {
  layers:          LayerVisibility;
  cursor:          MapCoords | null;
  selectedFeature: IntelEvent | null;
  popupCoords:     [number, number] | null;

  basemap:         BasemapId;
  terrain:         TerrainMode;
  /** Hillshade overlay on top of imagery/vector basemaps. */
  hillshade:       boolean;
  /** MGRS digits: 3=100 m · 4=10 m · 5=1 m. */
  precision:       3 | 4 | 5;
  /** Draw each event's positional uncertainty as a halo. */
  showUncertainty: boolean;

  toggleLayer:     (key: LayerKey) => void;
  setCursor:       (coords: MapCoords | null) => void;
  selectFeature:   (event: IntelEvent | null, coords?: [number, number]) => void;
  setBasemap:      (id: BasemapId) => void;
  setTerrain:      (mode: TerrainMode) => void;
  toggleHillshade: () => void;
  setPrecision:    (p: 3 | 4 | 5) => void;
  toggleUncertainty: () => void;
}

const DEFAULT_LAYERS: LayerVisibility = {
  acled:  true,
  firms:  true,
  heat:   false,
  drone:  true,
  mil:    true,
  zone:   true,
  ref:    true,
  routes: false,
  seismic: false,
  weather: false,
  osm:     false,
};

export const useMapStore = create<MapState>((set) => ({
  layers:          DEFAULT_LAYERS,
  cursor:          null,
  selectedFeature: null,
  popupCoords:     null,

  basemap:         DEFAULT_BASEMAP,
  terrain:         'off',
  hillshade:       false,
  precision:       5,
  showUncertainty: true,

  toggleLayer(key) {
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } }));
  },

  setCursor(coords) {
    set({ cursor: coords });
  },

  selectFeature(event, coords) {
    set({ selectedFeature: event, popupCoords: coords ?? null });
  },

  setBasemap(id)        { set({ basemap: id }); },
  setTerrain(mode)      { set({ terrain: mode }); },
  toggleHillshade()     { set((s) => ({ hillshade: !s.hillshade })); },
  setPrecision(p)       { set({ precision: p }); },
  toggleUncertainty()   { set((s) => ({ showUncertainty: !s.showUncertainty })); },
}));
