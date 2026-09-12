/**
 * Imperative handle to the map, for components that are not children of it.
 *
 * The map lives inside the monitor page's layout; the triage queue, the
 * anomaly panel and the data workspace all need to drive it from
 * elsewhere in the tree. Passing a ref through every intermediate
 * component would couple all of them to the map's existence, so the map
 * registers its capabilities here on load instead.
 */

type FlyToOpts = {
  longitude: number;
  latitude:  number;
  zoom:      number;
  pitch?:    number;
  bearing?:  number;
};

/** [west, south, east, north] */
export type Bounds = [number, number, number, number];

let _flyTo: ((opts: FlyToOpts) => void) | null = null;
let _getBounds: (() => Bounds | null) | null = null;

export function registerFlyTo(fn: (opts: FlyToOpts) => void): void {
  _flyTo = fn;
}

export function flyTo(opts: FlyToOpts): void {
  _flyTo?.(opts);
}

export function registerGetBounds(fn: () => Bounds | null): void {
  _getBounds = fn;
}

/**
 * Current viewport bounds, or null when the map has not loaded.
 *
 * Null is meaningful and must be handled: callers that query an upstream
 * by viewport need to know the difference between "the visible area" and
 * "some default area", because silently substituting one for the other
 * returns data about somewhere the operator is not looking.
 */
export function getMapBounds(): Bounds | null {
  try { return _getBounds?.() ?? null; } catch { return null; }
}
