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
  ],
};
