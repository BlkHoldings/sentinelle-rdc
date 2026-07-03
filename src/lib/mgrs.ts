/**
 * MGRS coordinate conversion utilities.
 * Uses the `mgrs` npm package which implements the DoD MGRS standard.
 *
 * Convention: mgrs.forward([longitude, latitude], precision)
 * Precision: 1=10km · 2=1km · 3=100m · 4=10m · 5=1m
 */

let forwardFn: ((coords: [number, number], accuracy?: number) => string) | null = null;

async function getForward() {
  if (!forwardFn) {
    const mod = await import('mgrs');
    forwardFn = mod.forward;
  }
  return forwardFn;
}

/**
 * Converts decimal Lat/Lon to MGRS string (1-metre precision).
 * Returns 'N/A' on any conversion error (e.g., poles, invalid inputs).
 */
export async function toMGRS(lat: number, lon: number, precision = 5): Promise<string> {
  try {
    const forward = await getForward();
    return forward([lon, lat], precision);
  } catch {
    return 'N/A';
  }
}

/**
 * Synchronous MGRS conversion using a cached module reference.
 * Returns empty string until the module has been loaded once via toMGRS().
 * Use this only for non-critical display after initial async load.
 */
export function toMGRSSync(lat: number, lon: number, precision = 5): string {
  if (!forwardFn) return '';
  try {
    return forwardFn([lon, lat], precision);
  } catch {
    return 'N/A';
  }
}

/**
 * Pre-loads the MGRS module. Call once during app initialisation so that
 * subsequent toMGRSSync() calls return real values immediately.
 */
export async function preloadMGRS(): Promise<void> {
  await getForward();
}

/** Formats a decimal coordinate pair as a display string. */
export function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}  ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}
