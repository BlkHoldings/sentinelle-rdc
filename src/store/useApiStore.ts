'use client';

import { create } from 'zustand';
import type { ApiStatus, ApiHealth } from '@/types/intel';

interface ApiState {
  status: ApiStatus;
  setStatus: (src: keyof ApiStatus, health: ApiHealth) => void;
  setAllLoading: () => void;
}

export const useApiStore = create<ApiState>((set) => ({
  status: { firms: 'idle', copernicus: 'idle', acled: 'idle', drone: 'idle' },

  setStatus(src, health) {
    set((s) => ({ status: { ...s.status, [src]: health } }));
  },

  setAllLoading() {
    set({ status: { firms: 'loading', copernicus: 'loading', acled: 'loading', drone: 'loading' } });
  },
}));
