/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Layer Registry
   ═══════════════════════════════════════════════════════════════════════

   One declaration per map layer, used by the map, the layer manager and
   the legend alike.

   This exists because the three disagreed. The filter bar had its own
   `LAYER_META` list, the legend had a hardcoded `MARKERS` array with
   its own colours, and the map had a third set of literals in its paint
   expressions. Two of those lists named layers the map never drew —
   `ref` and `routes` were switches wired to nothing — and the legend
   showed colours that no longer matched the symbols beside them. A
   legend that lies is worse than no legend, because it is believed.

   Rules this file enforces by construction:
   • A layer exists here or it does not exist. The map iterates this
     registry; it cannot draw something the legend has never heard of.
   • Colour is declared once. The legend swatch and the map symbol read
     the same constant, so they cannot drift apart.
   • Every layer states what it is and how current it is, so the operator
     can tell a live sensor feed from a six-month-old static overlay. On
     this map that distinction is the difference between a position and a
     memory of a position.
   ═══════════════════════════════════════════════════════════════════════ */

import type { LayerKey } from '@/types/intel';

/** Where a layer's data comes from — drives the staleness wording. */
export type LayerOrigin =
  | 'live'      // polled upstream, minutes old
  | 'session'   // produced by this session's pipeline
  | 'analyst'   // drawn or adjudicated by the operator
  | 'static';   // curated dataset shipped with the build

export type LayerGroupId = 'fusion' | 'sources' | 'tactical' | 'reference' | 'live';

export interface LegendEntry {
  color: string;
  label: string;
  /** 'dot' | 'ring' | 'square' | 'area' | 'line' — how the legend draws it. */
  shape?: 'dot' | 'ring' | 'square' | 'area' | 'line';
}

export interface LayerDef {
  key: LayerKey;
  label: string;
  group: LayerGroupId;
  /** Primary colour — the legend swatch and the map symbol share it. */
  color: string;
  origin: LayerOrigin;
  /** One line in the layer manager: what this layer shows. */
  hint: string;
  /** Sub-entries for the legend, when one colour is not enough. */
  legend?: LegendEntry[];
  /** Zoom below which the layer carries no symbols, for an honest
   *  "zoom in" note instead of an apparently empty layer. */
  minzoom?: number;
  /** Layer renders nothing until the operator asks for data. */
  onDemand?: boolean;
}

export interface LayerGroupDef {
  id: LayerGroupId;
  label: string;
  hint: string;
}

/* Colours are literals, not Tailwind class names: these are consumed by
   MapLibre paint expressions as well as by React style props. */
export const C = {
  alert: '#e03030',
  mag:   '#c83048',
  amb:   '#d09820',
  grn:   '#20c880',
  blu:   '#1e70f0',
  cyn:   '#18c8e0',
  pur:   '#8060d8',
  fire:  '#e06020',
  drone: '#18d8f0',
  t1:    '#c8d8e8',
  t2:    '#7890a8',
  t3:    '#445870',
} as const;

export const LAYER_GROUPS: LayerGroupDef[] = [
  { id: 'fusion',    label: 'PRODUIT FUSIONNÉ', hint: 'Sortie du moteur de fusion — événements corrélés et notés' },
  { id: 'sources',   label: 'SOURCES BRUTES',   hint: 'Collectes individuelles avant corrélation' },
  { id: 'tactical',  label: 'SITUATION',        hint: 'Contrôle du terrain et dispositif' },
  { id: 'reference', label: 'RÉFÉRENCE',        hint: 'Géographie fixe — localités, axes, points d’entrée' },
  { id: 'live',      label: 'FLUX TEMPS RÉEL',  hint: 'Upstreams interrogés en continu' },
];

export const LAYERS: LayerDef[] = [
  /* ── Fused product ─────────────────────────────────────────────
     Listed first because it is the analytic output, and it was the one
     thing the map did not draw. The console fused, scored and ranked
     events, then showed them only in a table. */
  {
    key: 'fusion', label: 'ÉVÉNEMENTS FUSIONNÉS', group: 'fusion',
    color: C.grn, origin: 'session',
    hint: 'Clusters corrélés, teintés par confiance a posteriori',
    legend: [
      { color: C.grn,   label: 'Confiance ≥ 0,75' },
      { color: C.amb,   label: 'Confiance 0,45–0,75' },
      { color: C.alert, label: 'Confiance < 0,45' },
      { color: C.t1,    label: 'Confirmé par analyste', shape: 'ring' },
    ],
  },
  {
    key: 'halo', label: 'INCERTITUDE POSITION', group: 'fusion',
    color: C.amb, origin: 'session',
    hint: 'Rayon réel au sol — trait plein = relevé, pointillé = déduit',
    legend: [
      { color: C.t1, label: 'Position relevée',  shape: 'ring' },
      { color: C.t2, label: 'Position déduite',  shape: 'line' },
    ],
  },
  {
    key: 'scan', label: 'CLUSTERS SIGNIFICATIFS', group: 'fusion',
    color: C.pur, origin: 'session',
    hint: 'Balayage spatio-temporel de Kulldorff, p < 0,05',
    legend: [{ color: C.pur, label: 'Cluster significatif', shape: 'area' }],
  },

  /* ── Raw sources ───────────────────────────────────────────── */
  {
    key: 'acled', label: 'ÉVÉNEMENTS ACLED', group: 'sources',
    color: C.alert, origin: 'static',
    hint: 'Conflits armés géocodés — regroupés aux faibles zooms',
    legend: [
      { color: C.alert, label: 'Combats' },
      { color: C.mag,   label: 'Explosions / frappes' },
      { color: C.amb,   label: 'Violence contre civils' },
      { color: C.grn,   label: 'Développements stratégiques' },
      { color: C.blu,   label: 'Autre' },
    ],
  },
  {
    key: 'firms', label: 'THERMIQUE FIRMS', group: 'sources',
    color: C.fire, origin: 'live',
    hint: 'Anomalies thermiques VIIRS/MODIS — feux, incendies, brûlis',
    legend: [{ color: C.fire, label: 'Anomalie thermique' }],
    minzoom: 6,
  },
  {
    key: 'heat', label: 'DENSITÉ THERMIQUE', group: 'sources',
    color: C.fire, origin: 'live',
    hint: 'Noyau de densité pondéré par la puissance radiative',
  },
  {
    key: 'drone', label: 'UAV / ISR', group: 'sources',
    color: C.drone, origin: 'static',
    hint: 'Relevés de capteurs aéroportés — SECRET',
    legend: [
      { color: C.alert, label: 'Frappe / BDA',  shape: 'square' },
      { color: C.pur,   label: 'Artillerie',    shape: 'square' },
      { color: C.cyn,   label: 'Mouvement',     shape: 'square' },
      { color: C.grn,   label: 'Humanitaire',   shape: 'square' },
    ],
  },

  /* ── Situation ─────────────────────────────────────────────── */
  {
    key: 'zone', label: 'CONTRÔLE DU TERRAIN', group: 'tactical',
    color: C.alert, origin: 'static',
    hint: 'Emprises approximatives — GoE, JMAC, ACLED',
    legend: [
      { color: C.alert, label: 'Zone hostile (M23/RDF)', shape: 'area' },
      { color: C.amb,   label: 'Zone contestée',         shape: 'area' },
      { color: C.cyn,   label: 'Surveillance frontière', shape: 'area' },
    ],
  },
  {
    key: 'mil', label: 'POSITIONS', group: 'tactical',
    color: C.mag, origin: 'static',
    hint: 'Dispositif FARDC / MONUSCO / sites PDI — SECRET',
    legend: [
      { color: C.mag,   label: 'PC / état-major' },
      { color: C.pur,   label: 'Artillerie' },
      { color: C.amb,   label: 'Logistique / camp' },
      { color: C.grn,   label: 'Site PDI' },
    ],
  },

  /* ── Reference geography ───────────────────────────────────────
     All four are drawn from datasets that already shipped in the build
     and were never rendered. `ref` and `routes` had switches in the
     filter bar; AXES, AIRSTRIPS and BORDER_CROSSINGS sat in
     infrastructure.ts feeding the enrichment stage only. */
  {
    key: 'ref', label: 'LOCALITÉS', group: 'reference',
    color: C.t1, origin: 'static',
    hint: 'Répertoire toponymique — étiquettes selon la population',
    legend: [
      { color: C.t1, label: 'Ville (> 100 k)', shape: 'square' },
      { color: C.t2, label: 'Agglomération' },
      { color: C.cyn, label: 'Camp PDI' },
      { color: C.amb, label: 'Poste frontière' },
    ],
  },
  {
    key: 'routes', label: 'AXES LOGISTIQUES', group: 'reference',
    color: C.amb, origin: 'static',
    hint: 'Routes nationales — les axes qui portent le ravitaillement',
    legend: [{ color: C.amb, label: 'Route nationale', shape: 'line' }],
  },
  {
    key: 'air', label: 'AÉRODROMES', group: 'reference',
    color: C.blu, origin: 'static',
    hint: 'Pistes — ISR, MEDEVAC, pont aérien',
    legend: [
      { color: C.blu, label: 'International', shape: 'square' },
      { color: C.cyn, label: 'Régional / piste', shape: 'square' },
    ],
  },
  {
    key: 'border', label: 'POSTES FRONTIÈRES', group: 'reference',
    color: C.amb, origin: 'static',
    hint: 'Points de passage officiels RWA / UGA / BDI',
    legend: [
      { color: C.alert, label: 'Rwanda', shape: 'square' },
      { color: C.amb,   label: 'Ouganda', shape: 'square' },
      { color: C.pur,   label: 'Burundi', shape: 'square' },
    ],
  },

  /* ── Live feeds ────────────────────────────────────────────── */
  {
    key: 'seismic', label: 'SISMICITÉ USGS', group: 'live',
    color: C.cyn, origin: 'live',
    hint: 'Rayon proportionnel à l’énergie, pas à la magnitude',
    legend: [
      { color: C.cyn,   label: 'M < 3,5' },
      { color: C.amb,   label: 'M 3,5–5,0' },
      { color: C.alert, label: 'M ≥ 5,0' },
    ],
  },
  {
    key: 'weather', label: 'MÉTÉO / FAISABILITÉ ISR', group: 'live',
    color: C.blu, origin: 'live',
    hint: 'Plafond, visibilité et pluie cumulée aux sites de collecte',
    legend: [
      { color: C.grn,   label: 'ISR favorable' },
      { color: C.amb,   label: 'ISR dégradé' },
      { color: C.alert, label: 'ISR défavorable' },
    ],
  },
  {
    key: 'osm', label: 'INFRASTRUCTURE OSM', group: 'live',
    color: C.grn, origin: 'live',
    hint: 'Requête Overpass sur la vue courante — à la demande',
    onDemand: true,
  },
];

/** Registry lookup. */
export const LAYER_BY_KEY: Record<LayerKey, LayerDef> = Object.fromEntries(
  LAYERS.map((l) => [l.key, l]),
) as Record<LayerKey, LayerDef>;

export function layersInGroup(group: LayerGroupId): LayerDef[] {
  return LAYERS.filter((l) => l.group === group);
}

/** Label for the data's age, shown beside the layer name. */
export const ORIGIN_LABEL: Record<LayerOrigin, string> = {
  live:    'TEMPS RÉEL',
  session: 'SESSION',
  analyst: 'ANALYSTE',
  static:  'STATIQUE',
};

export const ORIGIN_COLOR: Record<LayerOrigin, string> = {
  live:    C.grn,
  session: C.cyn,
  analyst: C.pur,
  static:  C.t3,
};
