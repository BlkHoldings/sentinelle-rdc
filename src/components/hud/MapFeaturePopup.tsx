'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Map feature card
   ═══════════════════════════════════════════════════════════════════════

   One card for every clickable thing on the map. Until this existed only
   the DOM markers (positions, UAS records) answered a click; the circle
   layers — ACLED, FIRMS, seismicity, OSM — were paint, and the only way
   to learn what a dot was involved finding it again in a side panel.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMapStore, type MapFeatureInfo } from '@/store/useMapStore';
import { useFusionStore } from '@/store/useFusionStore';
import { LAYER_BY_KEY, ORIGIN_LABEL, ORIGIN_COLOR } from '@/lib/layers';
import { toMGRSSync } from '@/lib/mgrs';

/** Fired to ask the page to switch workspace. The card lives inside the
 *  map and has no route to the page's view state; an event keeps it that
 *  way instead of threading a callback through the map component. */
export const VIEW_EVENT = 'nkoyi:view';

export default function MapFeaturePopup({
  feature, onClose,
}: { feature: MapFeatureInfo; onClose: () => void }) {
  const precision = useMapStore((s) => s.precision);
  const selectFusion = useFusionStore((s) => s.select);
  const def = LAYER_BY_KEY[feature.layer];

  const openInTriage = () => {
    if (!feature.fusionId) return;
    selectFusion(feature.fusionId);
    window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: 'triage' }));
    onClose();
  };

  return (
    <div
      className="panel shadow-float w-64 max-w-[78vw] cursor-default text-left animate-fade-in"
      style={{ borderTopColor: feature.color, borderTopWidth: 2 }}
      onClick={(e) => e.stopPropagation()}
      data-testid="map-feature-popup"
    >
      <div className="panel-header px-2 py-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-t1 text-2xs font-mono font-bold tracking-wide leading-tight break-words">
            {feature.title}
          </div>
          {feature.subtitle && (
            <div className="text-t2 text-3xs font-mono leading-tight mt-0.5 break-words">
              {feature.subtitle}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="text-t3 hover:text-t1 text-xs leading-none px-0.5 shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="px-2 py-1.5 space-y-0.5">
        {feature.rows.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-3xs font-mono leading-snug">
            <span className="text-t3 w-[5.5rem] shrink-0 tracking-wider">{k}</span>
            <span className="text-t1 min-w-0 break-words">{v}</span>
          </div>
        ))}
        <div className="flex gap-2 text-3xs font-mono leading-snug">
          <span className="text-t3 w-[5.5rem] shrink-0 tracking-wider">MGRS</span>
          <span className="text-cyn">{toMGRSSync(feature.lat, feature.lon, precision)}</span>
        </div>
      </div>

      {feature.body && (
        <div className="px-2 pb-1.5 text-3xs font-mono text-t2 leading-snug max-h-20 overflow-y-auto break-words">
          {feature.body}
        </div>
      )}

      <div className="px-2 py-1 border-t border-b3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 shrink-0" style={{ background: def.color }} />
        <span className="text-3xs font-mono text-t3 tracking-wider truncate">{def.label}</span>
        <span className="text-3xs font-mono ml-auto shrink-0" style={{ color: ORIGIN_COLOR[def.origin] }}>
          {ORIGIN_LABEL[def.origin]}
        </span>
      </div>

      {feature.fusionId && (
        <button
          onClick={openInTriage}
          className="w-full px-2 py-1 border-t border-b3 text-3xs font-mono font-bold tracking-wider
                     text-cyn hover:bg-cyn/10 transition-colors text-left"
        >
          ⚖ OUVRIR DANS LE TRIAGE — sources et calcul de confiance →
        </button>
      )}
    </div>
  );
}
