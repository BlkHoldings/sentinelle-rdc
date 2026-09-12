/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Basemap & Terrain Definitions
   ═══════════════════════════════════════════════════════════════════════

   The map previously ran a single CARTO vector style capped at the style's
   own maximum zoom. That is fine for theatre-level situational awareness
   and useless for the question an analyst actually asks next: *what is
   physically at this grid square?* Vector basemaps in this region carry
   almost no detail below ~z12 — eastern DRC is largely unmapped in OSM
   outside the towns — so zooming in produced an emptier and emptier
   screen.

   Imagery does not have that problem. ESRI World Imagery covers the AOR
   at sub-metre resolution in most places and keeps resolving to z19, which
   is the difference between "an incident near Sake" and "an incident at
   this compound on this track".

   Terrain matters here for a specific operational reason. The Kivus are
   rift terrain: 1 500 m of relief between the lake shore and the Masisi
   highlands over ~30 km. Movement rates, line of sight, ISR feasibility
   and which axis a force can actually use are all terrain-determined, and
   none of that is legible on a flat map. The DEM below is AWS's public
   terrarium tileset — verified CORS-enabled, no key, no cost.

   Every source here is keyless and public. That is a hard requirement:
   this is a static bundle on a CDN, there is nowhere to hide a token.
   ═══════════════════════════════════════════════════════════════════════ */

import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'dark' | 'satellite' | 'hybrid' | 'topo' | 'terrain';

export interface BasemapDef {
  id: BasemapId;
  label: string;
  /** Short operator-facing note on what this basemap is for. */
  hint: string;
  maxZoom: number;
  /** Imagery basemaps need light-on-dark overlays to stay legible. */
  overlayContrast: 'onDark' | 'onLight';
  style: StyleSpecification | string;
  attribution: string;
  /**
   * A single representative asset used to test whether this basemap's host
   * is reachable from the viewer's network.
   *
   * Inferring reachability from MapLibre's `error` events proved
   * unreliable — the events do not consistently carry a source id and the
   * react wrapper installs its own handler — so the check is made
   * directly and deterministically instead. `image` probes load through
   * an `Image`, matching how raster tiles are actually fetched, so a
   * CORS policy that permits rendering is not misread as an outage.
   */
  probe: { kind: 'image' | 'json'; url: string };
}

/** A tile over the Kivus: z6 covers the whole AOR on every source here. */
const PROBE_Z = 6, PROBE_X = 34, PROBE_Y = 31;

/* ── Shared raster-DEM source ───────────────────────────────────────
   Terrarium encoding: elevation = (R*256 + G + B/256) - 32768 metres.
   MapLibre reads this natively with `encoding: 'terrarium'`. */
export const DEM_SOURCE = {
  type: 'raster-dem' as const,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 14,
  attribution: 'DEM: Mapzen / AWS Open Data',
};

const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/* CARTO's label-only overlay: place names and boundaries on transparent
   background, so imagery keeps its detail while staying navigable. */
const CARTO_LABELS =
  'https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}@2x.png';

const ESRI_ATTRIB = 'Imagery © Esri, Maxar, Earthstar Geographics';

/** Builds a raster-only style. Keeps the DEM attached so terrain and
 *  hillshade work identically across every basemap. */
function rasterStyle(
  layers: { id: string; tiles: string[]; maxzoom: number; opacity?: number; tileSize?: number }[],
  attribution: string,
): StyleSpecification {
  const sources: StyleSpecification['sources'] = { dem: DEM_SOURCE };
  const styleLayers: StyleSpecification['layers'] = [
    { id: 'bg', type: 'background', paint: { 'background-color': '#090d13' } },
  ];

  for (const l of layers) {
    sources[l.id] = {
      type: 'raster',
      tiles: l.tiles,
      tileSize: l.tileSize ?? 256,
      maxzoom: l.maxzoom,
      attribution,
    };
    styleLayers.push({
      id: `${l.id}-layer`,
      type: 'raster',
      source: l.id,
      paint: { 'raster-opacity': l.opacity ?? 1 },
    });
  }

  return { version: 8, sources, layers: styleLayers };
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'dark',
    label: 'TACTIQUE',
    hint: 'Vecteur sombre — lisibilité maximale des calques tactiques',
    maxZoom: 18,
    overlayContrast: 'onDark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    attribution: '© OpenStreetMap, © CARTO',
    probe: { kind: 'json', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  },
  {
    id: 'satellite',
    label: 'SATELLITE',
    hint: 'Imagerie haute résolution — jusqu\'au niveau du bâti',
    maxZoom: 19,
    overlayContrast: 'onLight',
    style: rasterStyle(
      [{ id: 'esri', tiles: [ESRI_IMAGERY], maxzoom: 19 }],
      ESRI_ATTRIB,
    ),
    attribution: ESRI_ATTRIB,
    probe: { kind: 'image', url: ESRI_IMAGERY.replace('{z}', String(PROBE_Z)).replace('{y}', String(PROBE_Y)).replace('{x}', String(PROBE_X)) },
  },
  {
    id: 'hybrid',
    label: 'HYBRIDE',
    hint: 'Imagerie + toponymes — le défaut recommandé',
    maxZoom: 19,
    overlayContrast: 'onLight',
    style: rasterStyle(
      [
        { id: 'esri', tiles: [ESRI_IMAGERY], maxzoom: 19 },
        { id: 'labels', tiles: [CARTO_LABELS], maxzoom: 18, tileSize: 512, opacity: 0.9 },
      ],
      `${ESRI_ATTRIB}, © CARTO`,
    ),
    attribution: `${ESRI_ATTRIB}, © CARTO`,
    probe: { kind: 'image', url: ESRI_IMAGERY.replace('{z}', String(PROBE_Z)).replace('{y}', String(PROBE_Y)).replace('{x}', String(PROBE_X)) },
  },
  {
    id: 'topo',
    label: 'TOPO',
    hint: 'Courbes de niveau et pistes — planification de mouvement',
    maxZoom: 17,
    overlayContrast: 'onLight',
    style: rasterStyle(
      [{ id: 'otm', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], maxzoom: 17 }],
      '© OpenTopoMap, © OpenStreetMap',
    ),
    attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap',
    probe: { kind: 'image', url: `https://a.tile.opentopomap.org/${PROBE_Z}/${PROBE_X}/${PROBE_Y}.png` },
  },
  {
    id: 'terrain',
    label: 'RELIEF',
    hint: 'Ombrage du relief seul — lecture du terrain sans distraction',
    maxZoom: 16,
    overlayContrast: 'onDark',
    style: {
      version: 8,
      sources: { dem: DEM_SOURCE },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#0a1018' } },
        {
          id: 'hillshade-base',
          type: 'hillshade',
          source: 'dem',
          paint: {
            'hillshade-exaggeration': 0.8,
            'hillshade-shadow-color': '#000000',
            'hillshade-highlight-color': '#4a6a8a',
            'hillshade-accent-color': '#1a2e42',
          },
        },
      ],
    } as StyleSpecification,
    attribution: 'DEM: Mapzen / AWS Open Data',
    probe: { kind: 'image', url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${PROBE_Z}/${PROBE_X}/${PROBE_Y}.png` },
  },
];

/**
 * Is this basemap's host reachable from here?
 *
 * Resolves false on error or timeout rather than rejecting, because the
 * caller only needs a verdict — and a hung probe must not leave the
 * warning permanently undecided.
 */
export function probeBasemap(def: BasemapDef, timeoutMs = 12_000): Promise<boolean> {
  if (def.probe.kind === 'json') {
    return fetch(def.probe.url, { signal: AbortSignal.timeout(timeoutMs) })
      .then((r) => r.ok)
      .catch(() => false);
  }
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    const done = (ok: boolean) => { img.onload = img.onerror = null; resolve(ok); };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload  = () => { clearTimeout(timer); done(true); };
    img.onerror = () => { clearTimeout(timer); done(false); };
    img.src = def.probe.url;
  });
}

export const DEFAULT_BASEMAP: BasemapId = 'hybrid';

export function basemapById(id: BasemapId): BasemapDef {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

/* ── Terrain presets ───────────────────────────────────────────────
   Exaggeration is a readability control, not a truth control. At 1.0 the
   Kivu rift reads flat on a screen a few hundred pixels tall; 1.5 makes
   the escarpments legible without distorting slope judgement enough to
   mislead. Labelled so nobody mistakes the rendering for survey data. */
export const TERRAIN_EXAGGERATION = {
  off: 0,
  subtle: 1.0,
  standard: 1.5,
  dramatic: 2.5,
} as const;

export type TerrainMode = keyof typeof TERRAIN_EXAGGERATION;
