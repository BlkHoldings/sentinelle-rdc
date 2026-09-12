'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Basemap & Terrain Control
   ═══════════════════════════════════════════════════════════════════════

   Collapsed to a single button by default. The map is the working
   surface; a permanently-expanded settings panel competes with it for the
   exact screen space the analyst is trying to read.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { BASEMAPS, TERRAIN_EXAGGERATION, type TerrainMode } from '@/lib/basemaps';

const TERRAIN_LABEL: Record<TerrainMode, string> = {
  off:      'PLAT',
  subtle:   '1.0×',
  standard: '1.5×',
  dramatic: '2.5×',
};

export default function BasemapControl() {
  const [open, setOpen] = useState(false);
  const basemap         = useMapStore((s) => s.basemap);
  const setBasemap      = useMapStore((s) => s.setBasemap);
  const terrain         = useMapStore((s) => s.terrain);
  const setTerrain      = useMapStore((s) => s.setTerrain);
  const hillshade       = useMapStore((s) => s.hillshade);
  const toggleHillshade = useMapStore((s) => s.toggleHillshade);
  const precision       = useMapStore((s) => s.precision);
  const setPrecision    = useMapStore((s) => s.setPrecision);
  const showUncertainty = useMapStore((s) => s.showUncertainty);
  const toggleUncertainty = useMapStore((s) => s.toggleUncertainty);

  const active = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];

  return (
    <div className="absolute top-4 right-4 z-hud flex flex-col items-end gap-1">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Fond de carte, relief et précision"
        className={`flex items-center gap-1.5 px-2 py-1 border text-2xs font-mono transition-colors ${
          open ? 'bg-blu/20 border-blu text-t1' : 'bg-b2/90 border-b3 text-t2 hover:text-t1 hover:border-t3'
        }`}
      >
        <span className="text-sm leading-none">▦</span>
        <span className="tracking-wider">{active.label}</span>
        {terrain !== 'off' && <span className="text-cyn">3D</span>}
      </button>

      {open && (
        <div className="panel shadow-float w-60 animate-slide-up">
          {/* Basemap */}
          <div className="panel-header px-2.5 py-1">
            <span className="mvn-label">FOND DE CARTE</span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBasemap(b.id)}
                className={`w-full text-left px-1.5 py-1 border transition-colors ${
                  basemap === b.id
                    ? 'border-blu bg-blu/15 text-t1'
                    : 'border-transparent text-t3 hover:text-t2 hover:bg-b2/60'
                }`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xs font-mono font-bold tracking-wider">{b.label}</span>
                  <span className="text-3xs font-mono text-t3 ml-auto">z≤{b.maxZoom}</span>
                </div>
                <div className="text-3xs font-mono text-t3 leading-tight">{b.hint}</div>
              </button>
            ))}
          </div>

          {/* Terrain */}
          <div className="panel-header px-2.5 py-1 border-t border-b3">
            <span className="mvn-label">RELIEF 3D</span>
          </div>
          <div className="p-1.5 space-y-1.5">
            <div className="flex gap-0.5">
              {(Object.keys(TERRAIN_EXAGGERATION) as TerrainMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setTerrain(m)}
                  className={`flex-1 py-0.5 text-3xs font-mono border transition-colors ${
                    terrain === m
                      ? 'border-cyn text-cyn bg-cyn/15'
                      : 'border-b3 text-t3 hover:text-t2'
                  }`}
                >
                  {TERRAIN_LABEL[m]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox" checked={hillshade} onChange={toggleHillshade}
                className="accent-cyn w-3 h-3"
              />
              <span className="text-2xs font-mono text-t2">Ombrage du relief</span>
            </label>
            <div className="text-3xs font-mono text-t3 leading-tight">
              Exagération verticale — aide à la lecture, ne reflète pas la pente réelle.
              MNT Mapzen/AWS, ~30 m.
            </div>
          </div>

          {/* Precision */}
          <div className="panel-header px-2.5 py-1 border-t border-b3">
            <span className="mvn-label">PRÉCISION</span>
          </div>
          <div className="p-1.5 space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-3xs font-mono text-t3 w-10">MGRS</span>
              {([3, 4, 5] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrecision(p)}
                  className={`flex-1 py-0.5 text-3xs font-mono border transition-colors ${
                    precision === p
                      ? 'border-cyn text-cyn bg-cyn/15'
                      : 'border-b3 text-t3 hover:text-t2'
                  }`}
                >
                  {p === 3 ? '100 m' : p === 4 ? '10 m' : '1 m'}
                </button>
              ))}
            </div>
            <label className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox" checked={showUncertainty} onChange={toggleUncertainty}
                className="accent-cyn w-3 h-3 mt-0.5"
              />
              <span className="text-2xs font-mono text-t2 leading-tight">
                Halos d&apos;incertitude
                <span className="block text-3xs text-t3">
                  Rayon réel au sol ; trait plein = position mesurée, pointillé = déduite.
                </span>
              </span>
            </label>
          </div>

          <div className="px-2.5 py-1 border-t border-b3">
            <div className="text-3xs font-mono text-t3 leading-tight">{active.attribution}</div>
          </div>
        </div>
      )}
    </div>
  );
}
