'use client';

/* Per-browser interface preferences. Nothing here is security-relevant;
   it is safe in localStorage. */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Lang = 'fr' | 'en';
export type TextScale = 'md' | 'lg' | 'xl';

interface SettingsState {
  lang: Lang;
  scale: TextScale;
  navCollapsed: boolean;
  sidePanelOpen: boolean;
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
      setLang: (lang) => set({ lang }),
      setScale: (scale) => set({ scale }),
      toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
      toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
    }),
    { name: 'nkoyi.settings.v1', storage: createJSONStorage(() => localStorage) },
  ),
);
