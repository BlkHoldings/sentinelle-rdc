'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Layer manager
   ═══════════════════════════════════════════════════════════════════════

   Replaces a dropdown of eleven on/off rows. What that could not answer:

   • Is this layer empty, or just switched off? Every row shows its live
     feature count, and distinguishes "0" from "not loaded yet".
   • Which of these is current? Each layer is tagged with where its data
     comes from — a polled feed, this session's pipeline, or a static
     overlay shipped with the build.
   • What is under this dot? SOLO isolates one layer without touching the
     other switches, so leaving it restores exactly what was on before.
   • Why can't I see it? Layers that only draw past a zoom threshold say
     so instead of looking broken.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMapStore, isShown } from '@/store/useMapStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useLayerCounts } from '@/hooks/useLayerCounts';
import { getMapBounds } from '@/lib/mapController';
import {
  LAYER_GROUPS, layersInGroup, ORIGIN_LABEL, ORIGIN_COLOR, type LayerDef,
} from '@/lib/layers';

export default function LayerPanel({ onClose }: { onClose: () => void }) {
  const layers      = useMapStore((s) => s.layers);
  const solo        = useMapStore((s) => s.solo);
  const opacity     = useMapStore((s) => s.opacity);
  const zoom        = useMapStore((s) => s.zoom);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const setGroup    = useMapStore((s) => s.setGroup);
  const setOpacity  = useMapStore((s) => s.setOpacity);
  const setSolo     = useMapStore((s) => s.setSolo);
  const resetLayers = useMapStore((s) => s.resetLayers);
  const queryOsm    = useLiveStore((s) => s.queryOsm);
  const osm         = useLiveStore((s) => s.osm);
  const counts      = useLayerCounts();
  /* Newest ACLED record regardless of the time filter. When the window
     excludes everything, the useful answer is how far back the data
     actually ends — not just that nothing matched. */
  const newestAcled = useFeedStore((s) => {
    let d = '';
    for (const e of s.events) if (e.src === 'acled' && e.date > d) d = e.date;
    return d;
  });

  const loadOsm = () => {
    const b = getMapBounds();
    if (b) void queryOsm(b);
  };

  return (
    <div
      className="fixed left-2 right-2 top-28 md:absolute md:top-full md:left-0 md:right-auto md:mt-0.5 md:w-[21rem]
                 z-[100] bg-b1 border border-b3 shadow-float max-h-[68vh] md:max-h-[72vh] overflow-y-auto"
      data-testid="layer-panel"
    >
      <div className="sticky top-0 z-10 panel-header px-2.5 py-1 flex items-center gap-2 border-b border-b3">
        <span className="mvn-label">CALQUES</span>
        {solo && (
          <button
            onClick={() => setSolo(null)}
            className="text-3xs font-mono font-bold px-1 bg-amb text-b0 tracking-wider"
            title="Quitter l’isolement"
          >
            SOLO ✕
          </button>
        )}
        <button
          onClick={resetLayers}
          className="ml-auto text-3xs font-mono text-t3 hover:text-t1 tracking-wider"
          title="Rétablir les calques par défaut"
        >
          ↺ DÉFAUT
        </button>
        <button onClick={onClose} aria-label="Fermer" className="text-t3 hover:text-t1 text-xs leading-none">✕</button>
      </div>

      {LAYER_GROUPS.map((g) => {
        const defs = layersInGroup(g.id);
        const nOn = defs.filter((d) => layers[d.key]).length;
        const allOn = nOn === defs.length;
        return (
          <section key={g.id} className="border-b border-b3 last:border-b-0">
            <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-1">
              <div className="min-w-0 flex-1">
                <div className="mvn-label text-t2">{g.label}</div>
                <div className="text-3xs font-mono text-t3 leading-tight truncate">{g.hint}</div>
              </div>
              <span className="text-3xs font-mono text-t3 shrink-0">{nOn}/{defs.length}</span>
              <button
                onClick={() => setGroup(g.id, !allOn)}
                className="text-3xs font-mono px-1 border border-b3 text-t3 hover:text-t1 hover:border-t3 shrink-0"
                title={allOn ? 'Tout masquer' : 'Tout afficher'}
              >
                {allOn ? 'AUCUN' : 'TOUS'}
              </button>
            </div>

            {defs.map((d) => (
              <LayerRow
                key={d.key}
                def={d}
                enabled={layers[d.key]}
                shown={isShown({ layers, solo }, d.key)}
                isSolo={solo === d.key}
                dimmedBySolo={!!solo && solo !== d.key}
                count={counts[d.key]}
                opacity={opacity[d.key]}
                zoom={zoom}
                onToggle={() => toggleLayer(d.key)}
                onSolo={() => setSolo(d.key)}
                onOpacity={(v) => setOpacity(d.key, v)}
                emptyNote={d.key === 'acled' && newestAcled
                  ? `Rien dans la fenêtre TIME — dernier enregistrement ${newestAcled}. Élargir la fenêtre.`
                  : undefined}
                extra={d.key === 'osm' ? (
                  <button
                    onClick={loadOsm}
                    disabled={osm.health === 'loading'}
                    className="text-3xs font-mono px-1 border border-grn/50 text-grn hover:bg-grn/10 disabled:opacity-40"
                  >
                    {osm.health === 'loading' ? '…' : '⤓ VUE'}
                  </button>
                ) : null}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function LayerRow({
  def, enabled, shown, isSolo, dimmedBySolo, count, opacity, zoom,
  onToggle, onSolo, onOpacity, extra, emptyNote,
}: {
  def: LayerDef; enabled: boolean; shown: boolean; isSolo: boolean; dimmedBySolo: boolean;
  count: number | null; opacity: number; zoom: number;
  onToggle: () => void; onSolo: () => void; onOpacity: (v: number) => void;
  extra?: React.ReactNode; emptyNote?: string;
}) {
  const belowZoom = def.minzoom != null && zoom < def.minzoom;

  /* The note under a row explains an apparently empty layer. Only one is
     shown, in order of how directly it answers "why is nothing there". */
  let note: string | null = null;
  if (enabled && !dimmedBySolo) {
    if (count === null) note = def.onDemand ? 'Aucune requête — charger la vue courante' : 'En attente de la source';
    else if (count === 0) note = emptyNote ?? 'Aucun élément sous les filtres actifs';
    else if (belowZoom) note = `Symboles visibles à partir du zoom ${def.minzoom} (actuel ${zoom.toFixed(1)})`;
  }

  return (
    <div
      className={`px-2.5 py-1 transition-opacity ${dimmedBySolo ? 'opacity-35' : ''}`}
      data-layer={def.key}
      data-shown={shown ? '1' : '0'}
    >
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
          aria-label={def.label}
          className={`w-6 h-3 border shrink-0 relative transition-colors ${
            enabled ? 'border-transparent' : 'border-b3 bg-b0'
          }`}
          style={enabled ? { background: `${def.color}55`, borderColor: def.color } : undefined}
        >
          <span
            className="absolute top-px bottom-px w-2 transition-all"
            style={{ left: enabled ? 'calc(100% - 9px)' : '1px', background: enabled ? def.color : '#445870' }}
          />
        </button>

        <button onClick={onToggle} className="min-w-0 flex-1 text-left" title={def.hint}>
          <span className={`text-2xs font-mono tracking-wide ${enabled ? 'text-t1' : 'text-t3'}`}>
            {def.label}
          </span>
        </button>

        {extra}

        <span
          className={`text-2xs font-mono tabular-nums shrink-0 ${
            count === null ? 'text-t3' : count === 0 ? 'text-t3' : 'text-t2'
          }`}
          title={count === null ? 'Non chargé' : `${count} éléments`}
        >
          {count === null ? '—' : count.toLocaleString('fr-FR')}
        </span>

        <button
          onClick={onSolo}
          title={isSolo ? 'Quitter l’isolement' : 'Isoler ce calque'}
          className={`text-3xs font-mono font-bold w-4 h-4 border shrink-0 leading-none transition-colors ${
            isSolo ? 'bg-amb border-amb text-b0' : 'border-b3 text-t3 hover:text-t1 hover:border-t3'
          }`}
        >
          S
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-0.5 pl-[1.875rem]">
        <span className="text-3xs font-mono shrink-0 tracking-wider" style={{ color: ORIGIN_COLOR[def.origin] }}>
          {ORIGIN_LABEL[def.origin]}
        </span>
        <span className="text-3xs font-mono text-t3 leading-tight truncate flex-1">{def.hint}</span>
        {enabled && (
          <input
            type="range" min={10} max={100} step={5}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            aria-label={`Opacité ${def.label}`}
            title={`Opacité ${Math.round(opacity * 100)} %`}
            className="w-14 h-1 shrink-0 accent-cyn cursor-pointer"
          />
        )}
      </div>

      {note && (
        <div className="pl-[1.875rem] text-3xs font-mono text-amb/90 leading-tight mt-0.5">▸ {note}</div>
      )}
    </div>
  );
}
