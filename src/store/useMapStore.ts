'use client';

import { create } from 'zustand';
import type { LayerKey, LayerVisibility, MapCoords, IntelEvent } from '@/types/intel';

interface MapState {
  layers:          LayerVisibility;
  cursor:          MapCoords | null;
  selectedFeature: IntelEvent | null;
  popupCoords:     [number, number] | null;
  toggleLayer:     (key: LayerKey) => void;
  setCursor:       (coords: MapCoords | null) => void;
  selectFeature:   (event: IntelEvent | null, coords?: [number, number]) => void;
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
};

export const useMapStore = create<MapState>((set) => ({
  layers:          DEFAULT_LAYERS,
  cursor:          null,
  selectedFeature: null,
  popupCoords:     null,

  toggleLayer(key) {
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } }));
  },

  setCursor(coords) {
    set({ cursor: coords });
  },

  selectFeature(event, coords) {
    set({ selectedFeature: event, popupCoords: coords ?? null });
  },
}));
