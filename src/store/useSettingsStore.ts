'use client';

/* Per-browser interface preferences. Nothing here is security-relevant;
   it is safe in localStorage. */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Lang = 'fr' | 'en';
export type TextScale = 'md' | 'lg' | 'xl';
/** 'real': only data fetched from named upstreams. 'demo': adds the
 *  simulated stream and the illustrative datasets, all labelled. */
export type DataMode = 'real' | 'demo';

interface SettingsState {
  lang: Lang;
  scale: TextScale;
  navCollapsed: boolean;
  sidePanelOpen: boolean;
  dataMode: DataMode;
  setDataMode: (m: DataMode) => void;
  setLang: (l: Lang) => void;
  setScale: (s: TextScale) => void;
  toggleNav: () => void;
  toggleSidePanel: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lang: 'fr',
      scale: 'md',
      navCollapsed: false,
      sidePanelOpen: true,
      dataMode: 'real',
      setDataMode: (dataMode) => set({ dataMode }),
      setLang: (lang) => set({ lang }),
      setScale: (scale) => set({ scale }),
      toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
      toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
    }),
    { name: 'nkoyi.settings.v1', storage: createJSONStorage(() => localStorage) },
  ),
);
