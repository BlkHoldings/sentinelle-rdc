'use client';

import { create } from 'zustand';

export type DrawTool = 'select' | 'rect' | 'circle' | 'poly' | 'note';

export interface DrawnShape {
  id:     string;
  kind:   'rect' | 'circle' | 'poly';
  coords: [number, number][]; // closed ring
}

export interface Annotation {
  id:   string;
  lon:  number;
  lat:  number;
  text: string;
}

interface DrawState {
  tool:        DrawTool;
  shapes:      DrawnShape[];
  notes:       Annotation[];
  pending:     [number, number][]; // in-progress vertices
  setTool:     (t: DrawTool) => void;
  addPending:  (pt: [number, number]) => void;
  cancelPending: () => void;
  commitShape: (kind: DrawnShape['kind'], coords: [number, number][]) => void;
  addNote:     (n: Annotation) => void;
  clearAll:    () => void;
}

let seq = 0;

export const useDrawStore = create<DrawState>((set) => ({
  tool:    'select',
  shapes:  [],
  notes:   [],
  pending: [],

  setTool(t)      { set({ tool: t, pending: [] }); },
  addPending(pt)  { set((s) => ({ pending: [...s.pending, pt] })); },
  cancelPending() { set({ pending: [] }); },

  commitShape(kind, coords) {
    set((s) => ({
      shapes:  [...s.shapes, { id: `shape-${++seq}`, kind, coords }],
      pending: [],
    }));
  },

  addNote(n)  { set((s) => ({ notes: [...s.notes, n] })); },
  clearAll()  { set({ shapes: [], notes: [], pending: [] }); },
}));

/** Rectangle ring from two opposite corners. */
export function rectRing(a: [number, number], b: [number, number]): [number, number][] {
  return [a, [b[0], a[1]], b, [a[0], b[1]], a];
}

/** ~48-point circle ring from a center and an edge point (planar approx, lat-corrected). */
export function circleRing(center: [number, number], edge: [number, number]): [number, number][] {
  const cosLat = Math.cos((center[1] * Math.PI) / 180) || 1e-6;
  const dLon   = (edge[0] - center[0]) * cosLat;
  const dLat   = edge[1] - center[1];
  const r      = Math.sqrt(dLon * dLon + dLat * dLat);
  const ring: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    ring.push([center[0] + (r * Math.cos(t)) / cosLat, center[1] + r * Math.sin(t)]);
  }
  return ring;
}
