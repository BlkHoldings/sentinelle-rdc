/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Screen-space point clustering
   ═══════════════════════════════════════════════════════════════════════

   At theatre zoom the Petit Nord puts forty incidents inside a dozen
   pixels. Drawn individually they overplot into one dot, and one dot is
   exactly what a single incident looks like — the map understates the
   densest areas precisely because they are dense.

   Points are binned on a grid defined in *screen pixels at the current
   zoom*, so "close together" always means "indistinguishable at this
   scale" and clusters dissolve on their own as the operator zooms in.

   Done here rather than with MapLibre's built-in clustering because that
   needs a symbol layer for the count, a symbol layer needs a glyph
   server, and the raster basemaps carry none. A count that silently
   fails to render on satellite imagery would be worse than no clustering.
   ═══════════════════════════════════════════════════════════════════════ */

export interface ClusterInput {
  lon: number;
  lat: number;
}

export interface Cluster<T> {
  lon: number;
  lat: number;
  members: T[];
}

/** Beyond this zoom every point stands alone: the grid cell is smaller
 *  than the symbol, so merging would only hide real separation. */
export const CLUSTER_MAX_ZOOM = 9.5;

const TILE = 256;

/** Web-Mercator world pixel coordinates at a given zoom. */
function project(lon: number, lat: number, zoom: number): [number, number] {
  const scale = TILE * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return [x, y];
}

/**
 * Bin points into `cellPx`-pixel cells at `zoom`.
 *
 * The cluster position is the mean of its members, not the cell centre:
 * a cell-centre position would snap every cluster to a visible lattice
 * and move markers off the places they describe.
 */
export function clusterPoints<T extends ClusterInput>(
  points: T[], zoom: number, cellPx = 52,
): Cluster<T>[] {
  if (zoom >= CLUSTER_MAX_ZOOM) {
    return points.map((p) => ({ lon: p.lon, lat: p.lat, members: [p] }));
  }

  const cells = new Map<string, T[]>();
  for (const p of points) {
    const [x, y] = project(p.lon, p.lat, zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const cell = cells.get(key);
    if (cell) cell.push(p); else cells.set(key, [p]);
  }

  const out: Cluster<T>[] = [];
  for (const members of cells.values()) {
    let lon = 0, lat = 0;
    for (const m of members) { lon += m.lon; lat += m.lat; }
    out.push({ lon: lon / members.length, lat: lat / members.length, members });
  }
  return out;
}

/** Most frequent value of `key` across items — the cluster's colour. */
export function dominant<T>(items: T[], key: (t: T) => string): string {
  const tally = new Map<string, number>();
  let best = '', bestN = 0;
  for (const it of items) {
    const k = key(it);
    const n = (tally.get(k) ?? 0) + 1;
    tally.set(k, n);
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}
