/**
 * Tactical zone overlays — M23/RDF controlled territory, Est-DRC.
 * Approximate polygons based on: GoE S/2024/432, MONUSCO JMAC,
 * ACLED territorial control data, OSINT mapping. État au 03 Jul 2026.
 */

export const M23_ZONES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'Zone M23 — Corridor Rutshuru-Goma', type: 'hostile' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [29.49, -1.28],  // Bunagana (border crossing)
          [29.58, -1.38],  // Rwanda border NE
          [29.60, -1.55],  // Rwanda border mid
          [29.56, -1.72],  // Gisenyi border
          [29.30, -1.85],  // South Goma lakeshore
          [29.10, -1.87],  // Lake Kivu W
          [28.88, -1.78],  // Sake outskirts
          [28.85, -1.60],  // Sake N
          [28.82, -1.42],  // Masisi S
          [28.90, -1.30],  // Masisi N
          [29.10, -1.22],  // Rutshuru W
          [29.30, -1.20],  // Rutshuru
          [29.49, -1.28],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Zone M23 — Bukavu', type: 'hostile' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [28.68, -2.28],  // NW
          [29.02, -2.28],  // NE
          [29.05, -2.52],  // E (lake shore)
          [28.88, -2.70],  // SE
          [28.68, -2.65],  // S
          [28.65, -2.45],  // SW
          [28.68, -2.28],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Zone M23 — Walikale', type: 'hostile' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [27.88, -1.28],  // NW
          [28.22, -1.28],  // NE
          [28.22, -1.58],  // SE
          [27.88, -1.58],  // SW
          [27.88, -1.28],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Zone d\'influence M23 — Masisi', type: 'contested' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [28.45, -1.38],  // NW
          [28.85, -1.38],  // NE (joins main zone)
          [28.85, -1.60],  // E
          [28.70, -1.65],  // SE
          [28.45, -1.55],  // S
          [28.40, -1.42],  // SW
          [28.45, -1.38],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Zone de conflit — Fizi / Hauts-Plateaux Minembwe', type: 'contested' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [28.55, -3.45],  // NW (Hauts-Plateaux)
          [28.80, -3.50],  // NE
          [29.05, -3.95],  // E (vers Tanganyika)
          [29.15, -4.25],  // SE (Baraka)
          [28.95, -4.45],  // S (Fizi)
          [28.65, -4.30],  // SW
          [28.50, -3.85],  // W
          [28.55, -3.45],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Zone de conflit — Walikale / Axe RN3', type: 'hostile' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [27.85, -1.30],  // NW
          [28.30, -1.30],  // NE (joint Masisi)
          [28.30, -1.75],  // SE
          [27.90, -1.75],  // SW
          [27.70, -1.50],  // W (Walikale-centre)
          [27.85, -1.30],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Surveillance transfrontalière — Rwanda (RDF)', type: 'watch' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [29.25, -1.50],  // Rubavu N
          [29.40, -1.60],  // Rwanda interior
          [29.42, -1.80],  // Gisenyi corridor
          [29.36, -2.05],  // S along border
          [29.28, -1.90],  // border
          [29.24, -1.68],  // Goma-facing
          [29.25, -1.50],  // close
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Surveillance transfrontalière — Rusizi (Rwanda SW)', type: 'watch' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [28.88, -2.42],  // Rusizi N (face Bukavu)
          [29.02, -2.48],  // Rwanda interior
          [29.05, -2.62],  // S
          [28.92, -2.72],  // border S
          [28.84, -2.58],  // Cyangugu
          [28.88, -2.42],  // close
        ]],
      },
    },
  ],
};
