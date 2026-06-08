'use client';

import { create } from 'zustand';

const DEFAULT_INTERVAL = 180;

interface RefreshState {
  auto:        boolean;
  countdown:   number;
  lastRefresh: number | null;
  refreshFn:   (() => void) | null;
  setAuto:     (v: boolean) => void;
  tick:        () => boolean; // returns true when countdown hits 0
  reset:       () => void;
  register:    (fn: () => void) => void;
}

export const useRefreshStore = create<RefreshState>((set, get) => ({
  auto:        true,
  countdown:   DEFAULT_INTERVAL,
  lastRefresh: null,
  refreshFn:   null,

  setAuto(v) { set({ auto: v }); },

  tick() {
    const { auto, countdown } = get();
    if (!auto) return false;
    if (countdown <= 1) {
      set({ countdown: DEFAULT_INTERVAL, lastRefresh: Date.now() });
      return true;
    }
    set({ countdown: countdown - 1 });
    return false;
  },

  reset() {
    set({ countdown: DEFAULT_INTERVAL, lastRefresh: Date.now() });
  },

  register(fn) { set({ refreshFn: fn }); },
}));
