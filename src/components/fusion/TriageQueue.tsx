'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Analyst Triage Queue
   ═══════════════════════════════════════════════════════════════════════

   The human-in-the-loop surface. Its job is not to display events — the
   map already does that — but to let an analyst *adjudicate* them fast
   and to show, for every score, exactly why the machine produced it.

   Two design commitments:

   • Every confidence number is expandable into the log-odds terms that
     produced it. A confidence score an analyst cannot interrogate is a
     score they will learn to ignore.

   • The whole workflow is keyboard-driven (J/K to move, C/X/E/D to
     adjudicate). Triage is a repetitive task done for hours; forcing a
     mouse round-trip per decision is the difference between clearing a
     queue and abandoning it.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFusionStore } from '@/store/useFusionStore';
import { useMapStore } from '@/store/useMapStore';
import { flyTo } from '@/lib/mapController';
import {
  EVENT_TYPE_LABEL, ADMIRALTY_RELIABILITY, ADMIRALTY_CREDIBILITY,
  type FusedEvent, type EventStatus,
} from '@/lib/fusion/schema';
import { profileOf } from '@/lib/fusion/reliability';
import { SIDE_COLOR, actorByName } from '@/lib/fusion/actors';
import { toMGRSSync } from '@/lib/mgrs';

/**
 * What actually needs a human decision now — not everything the pipeline
 * has ever retained.
 *
 * An earlier revision routed every single-source event here, which put
 * the entire historical baseline (single-source by construction) into the
 * queue: 1 200 items, none of them actionable, burying the dozen that
 * were. A triage queue an analyst cannot clear is one they stop opening.
 *
 * Exported because the sidebar badge must count exactly what the queue
 * shows — two copies of this rule would drift apart within a week.
 */
export function needsTriage(e: FusedEvent): boolean {
  if (e.adjudications.length || e.status === 'merged') return false;
  if (e.status === 'disputed') return true;
  const ageH = (Date.now() - new Date(e.timestamp).getTime()) / 3_600_000;
  if (ageH > 96) return false;
  if (e.priority >= 45) return true;
  return e.independent_sources === 1 &&
    ((e.casualties.fatalities ?? 0) >= 3 || e.priority >= 30);
}

const STATUS_STYLE: Record<EventStatus, { label: string; cls: string }> = {
  unverified:   { label: 'NON VÉRIFIÉ', cls: 'text-t3 border-t3/40' },
  corroborated: { label: 'CORROBORÉ',   cls: 'text-cyn border-cyn/40' },
  confirmed:    { label: 'CONFIRMÉ',    cls: 'text-grn border-grn/40' },
  disputed:     { label: 'CONTESTÉ',    cls: 'text-amb border-amb/40' },
  rejected:     { label: 'REJETÉ',      cls: 'text-alert border-alert/40' },
  merged:       { label: 'FUSIONNÉ',    cls: 'text-t3 border-t3/40' },
};

function confColor(c: number): string {
  if (c >= 0.8) return 'text-grn';
  if (c >= 0.6) return 'text-cyn';
  if (c >= 0.4) return 'text-amb';
  return 'text-alert';
}

function prioColor(p: number): string {
  if (p >= 70) return 'bg-alert';
  if (p >= 50) return 'bg-amb';
  if (p >= 30) return 'bg-cyn';
  return 'bg-t3';
}

function dtg(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

function ago(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
}

/* ── Confidence breakdown ───────────────────────────────────────── */

function ConfidenceBreakdown({ e }: { e: FusedEvent }) {
  const total = e.confidence_factors.reduce((s, f) => s + f.delta, 0);
  const maxAbs = Math.max(...e.confidence_factors.map((f) => Math.abs(f.delta)), 1);

  return (
    <div className="space-y-1">
      <div className="mvn-label">DÉCOMPOSITION DE LA CONFIANCE (LOG-COTES)</div>
      {e.confidence_factors.map((f, i) => {
        const pct = Math.min(100, (Math.abs(f.delta) / maxAbs) * 100);
        const pos = f.delta >= 0;
        return (
          <div key={i} className="text-2xs font-mono">
            <div className="flex items-baseline gap-2">
              <span className={`w-12 shrink-0 text-right ${pos ? 'text-grn' : 'text-alert'}`}>
                {pos ? '+' : ''}{f.delta.toFixed(2)}
              </span>
              <span className="text-t2 truncate">{f.label}</span>
            </div>
            <div className="ml-14 h-[3px] bg-b3 relative mt-0.5 mb-0.5">
              <div
                className={`absolute inset-y-0 ${pos ? 'bg-grn/70' : 'bg-alert/70'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {f.detail && <div className="ml-14 text-t3 text-3xs leading-tight">{f.detail}</div>}
          </div>
        );
      })}
      <div className="flex items-baseline gap-2 text-2xs font-mono border-t border-b3 pt-1 mt-1">
        <span className="w-12 shrink-0 text-right text-t1">{total >= 0 ? '+' : ''}{total.toFixed(2)}</span>
        <span className="text-t3">log-cotes cumulées →</span>
        <span className={`font-bold ${confColor(e.confidence)}`}>{(e.confidence * 100).toFixed(0)} %</span>
      </div>
    </div>
  );
}

/* ── Provenance chain ───────────────────────────────────────────── */

function Provenance({ e }: { e: FusedEvent }) {
  return (
    <div className="space-y-1">
      <div className="mvn-label">
        CHAÎNE DE PROVENANCE — {e.provenance.length} RAPPORT(S), {e.independent_sources} FAMILLE(S)
      </div>
      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
        {e.provenance.map((p, i) => {
          const prof = profileOf(p.source.type);
          const agreeCls =
            p.agreement === 'agree' ? 'text-grn' :
            p.agreement === 'partial' ? 'text-amb' : 'text-alert';
          return (
            <div key={i} className="border-l-2 border-b3 pl-2 py-0.5">
              <div className="flex items-center gap-1.5 flex-wrap text-3xs font-mono">
                <span className="text-t1 font-bold">{p.source.handle ?? prof.label}</span>
                <span className="text-t3">{prof.label}</span>
                <span
                  className="text-cyn border border-cyn/30 px-1"
                  title={`${ADMIRALTY_RELIABILITY[p.source.grade].label} / ${ADMIRALTY_CREDIBILITY[p.source.credibility].label}`}
                >
                  {p.source.grade}{p.source.credibility}
                </span>
                <span className={agreeCls}>
                  {p.agreement === 'agree' ? '✓ concorde'
                    : p.agreement === 'partial' ? '~ partiel'
                    : '✕ contredit'}
                </span>
                <span className="text-t3 ml-auto">{ago(p.source.published_at)}</span>
              </div>
              <div className="text-t2 text-2xs leading-snug mt-0.5">{p.raw_text.slice(0, 220)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Queue row ──────────────────────────────────────────────────── */

function QueueRow({
  e, active, onClick,
}: { e: FusedEvent; active: boolean; onClick: () => void }) {
  const st = STATUS_STYLE[e.status];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 border-l-2 transition-colors ${
        active ? 'border-l-blu bg-blu/10' : 'border-l-transparent hover:bg-b2/60'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-6 shrink-0 ${prioColor(e.priority)}`} title={`Priorité ${e.priority}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-t1 text-2xs font-mono font-bold truncate">
              {EVENT_TYPE_LABEL[e.event_type]}
            </span>
            <span className={`text-2xs font-mono ml-auto shrink-0 ${confColor(e.confidence)}`}>
              {(e.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 text-3xs font-mono">
            <span className="text-t2 truncate">{e.location?.place_name ?? 'non localisé'}</span>
            <span className="text-t3 shrink-0">{dtg(e.timestamp)}</span>
            <span className={`shrink-0 border px-1 ml-auto ${st.cls}`}>{st.label}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */

type QueueFilter = 'triage' | 'all' | 'alerts' | 'disputed' | 'adjudicated';

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: 'triage',      label: 'À TRIER' },
  { key: 'alerts',      label: 'ALERTES' },
  { key: 'disputed',    label: 'CONTESTÉS' },
  { key: 'adjudicated', label: 'TRAITÉS' },
  { key: 'all',         label: 'TOUS' },
];

export default function TriageQueue() {
  const events = useFusionStore((s) => s.events);
  const reviewPairs = useFusionStore((s) => s.reviewPairs);
  const selectedId = useFusionStore((s) => s.selectedId);
  const select = useFusionStore((s) => s.select);
  const adjudicate = useFusionStore((s) => s.adjudicate);
  const dismissPair = useFusionStore((s) => s.dismissPair);
  const selectFeature = useMapStore((s) => s.selectFeature);

  const [filter, setFilter] = useState<QueueFilter>('triage');
  const [notes, setNotes] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const queue = useMemo(() => {
    const base = events.filter((e) => e.status !== 'merged');
    switch (filter) {
      case 'triage':   return base.filter(needsTriage);
      case 'alerts':      return base.filter((e) => e.priority >= 55);
      case 'disputed':    return base.filter((e) => e.status === 'disputed');
      case 'adjudicated': return base.filter((e) => e.adjudications.length > 0);
      default:            return base;
    }
  }, [events, filter]);

  const selected = useMemo(
    () => queue.find((e) => e.event_id === selectedId) ?? queue[0] ?? null,
    [queue, selectedId],
  );

  /* Keep a valid selection as the queue churns underneath. */
  useEffect(() => {
    if (queue.length && !queue.some((e) => e.event_id === selectedId)) {
      select(queue[0].event_id);
    }
  }, [queue, selectedId, select]);

  useEffect(() => { setNotes(''); setShowRaw(false); }, [selected?.event_id]);

  const move = (delta: number) => {
    if (!queue.length) return;
    const i = queue.findIndex((e) => e.event_id === selected?.event_id);
    const next = queue[Math.max(0, Math.min(queue.length - 1, (i < 0 ? 0 : i) + delta))];
    if (next) {
      select(next.event_id);
      listRef.current
        ?.querySelector(`[data-id="${next.event_id}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  };

  const act = (action: 'confirm' | 'reject' | 'escalate' | 'defer') => {
    if (!selected) return;
    const i = queue.findIndex((e) => e.event_id === selected.event_id);
    adjudicate(selected.event_id, action, notes || undefined);
    setNotes('');
    // Advance to the next item so the queue keeps flowing under the hands.
    const next = queue[i + 1] ?? queue[i - 1];
    if (next) select(next.event_id);
  };

  /* ── Keyboard workflow ── */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = ev.key.toLowerCase();
      if (k === 'j') { ev.preventDefault(); move(1); }
      else if (k === 'k') { ev.preventDefault(); move(-1); }
      else if (k === 'c') { ev.preventDefault(); act('confirm'); }
      else if (k === 'x') { ev.preventDefault(); act('reject'); }
      else if (k === 'e') { ev.preventDefault(); act('escalate'); }
      else if (k === 'd') { ev.preventDefault(); act('defer'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const goToMap = () => {
    if (!selected?.location) return;
    selectFeature(
      {
        src: 'acled', type: EVENT_TYPE_LABEL[selected.event_type],
        date: selected.timestamp.slice(0, 10),
        lat: selected.location.lat, lon: selected.location.lon,
        location: selected.location.place_name,
        admin1: selected.geo?.admin.province,
        notes: selected.description,
        fatalities: selected.casualties.fatalities,
        actor1: selected.actors[0], actor2: selected.actors[1],
      },
      [selected.location.lon, selected.location.lat],
    );
    flyTo({ longitude: selected.location.lon, latitude: selected.location.lat, zoom: 10 });
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-b0">

      {/* ── Queue ── */}
      <div className="flex flex-col w-full md:w-[320px] shrink-0 border-r border-b3 min-h-0">
        <div className="px-2 py-1.5 border-b border-b3 bg-b1 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-t1 text-2xs font-mono font-bold tracking-widest">FILE DE TRIAGE</span>
            <span className="text-t3 text-2xs font-mono ml-auto">{queue.length}</span>
          </div>
          <div className="flex flex-wrap gap-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-1.5 py-0.5 text-3xs font-mono border transition-colors ${
                  filter === f.key
                    ? 'border-blu text-t1 bg-blu/15'
                    : 'border-b3 text-t3 hover:text-t2'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
          {!queue.length && (
            <div className="p-4 text-t3 text-2xs font-mono text-center">
              File vide — aucun événement ne correspond à ce filtre.
            </div>
          )}
          {queue.slice(0, 250).map((e) => (
            <div key={e.event_id} data-id={e.event_id}>
              <QueueRow
                e={e}
                active={selected?.event_id === e.event_id}
                onClick={() => select(e.event_id)}
              />
            </div>
          ))}
        </div>

        <div className="px-2 py-1 border-t border-b3 bg-b1 shrink-0 text-3xs font-mono text-t3">
          <span className="text-t2">J/K</span> naviguer · <span className="text-grn">C</span> confirmer ·{' '}
          <span className="text-alert">X</span> rejeter · <span className="text-amb">E</span> escalader ·{' '}
          <span className="text-t2">D</span> différer
        </div>
      </div>

      {/* ── Detail ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {!selected && (
          <div className="text-t3 text-2xs font-mono">Aucun événement sélectionné.</div>
        )}

        {selected && (
          <>
            {/* Header */}
            <div className="border border-b3 bg-b1 p-2.5">
              <div className="flex items-start gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="text-t1 text-sm font-mono font-bold">
                    {EVENT_TYPE_LABEL[selected.event_type]}
                  </div>
                  <div className="text-t2 text-2xs font-mono">
                    {selected.location?.place_name ?? 'Localisation indéterminée'}
                    {selected.geo?.admin.territory && ` · ${selected.geo.admin.territory}`}
                    {selected.geo?.admin.province && `, ${selected.geo.admin.province}`}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className={`text-lg font-mono font-bold leading-none ${confColor(selected.confidence)}`}>
                    {(selected.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-t3 text-3xs font-mono">CONFIANCE</div>
                </div>
                <div className="text-right">
                  <div className="text-t1 text-lg font-mono font-bold leading-none">{selected.priority}</div>
                  <div className="text-t3 text-3xs font-mono">PRIORITÉ</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-3xs font-mono">
                <span className={`border px-1 ${STATUS_STYLE[selected.status].cls}`}>
                  {STATUS_STYLE[selected.status].label}
                </span>
                <span className="text-t3">{dtg(selected.timestamp)}</span>
                <span className="text-t3">±{selected.time_uncertainty_min} min</span>
                {selected.location && (
                  <>
                    <span className="text-t3">
                      {selected.location.lat.toFixed(4)}, {selected.location.lon.toFixed(4)}
                    </span>
                    <span className="text-cyn">{toMGRSSync(selected.location.lon, selected.location.lat)}</span>
                    <span className="text-t3">±{selected.location.radius_km.toFixed(1)} km</span>
                    <span className="text-t3 border border-b3 px-1">{selected.location.method}</span>
                  </>
                )}
                {selected.location && (
                  <button
                    onClick={goToMap}
                    className="ml-auto border border-blu/40 text-blu px-1.5 py-0.5 hover:bg-blu/15 transition-colors"
                  >
                    ▸ CARTE
                  </button>
                )}
              </div>

              <div className="text-t2 text-2xs leading-snug mt-2">{selected.description}</div>

              {/* Actors */}
              {selected.actors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selected.actors.map((a) => {
                    const actor = actorByName(a);
                    return (
                      <span
                        key={a}
                        className={`text-3xs font-mono border border-b3 px-1 ${actor ? SIDE_COLOR[actor.side] : 'text-t2'}`}
                      >
                        {a}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Casualties */}
              {(selected.casualties.fatalities != null ||
                selected.casualties.displaced != null ||
                selected.casualties.abducted != null) && (
                <div className="flex flex-wrap gap-3 mt-2 text-2xs font-mono">
                  {selected.casualties.fatalities != null && (
                    <span className="text-alert">
                      {selected.casualties.fatalities} tués
                      {selected.casualties.fatalities_range &&
                        selected.casualties.fatalities_range[1] > selected.casualties.fatalities_range[0] &&
                        ` [${selected.casualties.fatalities_range[0]}–${selected.casualties.fatalities_range[1]}]`}
                    </span>
                  )}
                  {selected.casualties.injured != null && (
                    <span className="text-amb">{selected.casualties.injured} blessés</span>
                  )}
                  {selected.casualties.abducted != null && (
                    <span className="text-mag">{selected.casualties.abducted} enlevés</span>
                  )}
                  {selected.casualties.displaced != null && (
                    <span className="text-cyn">{selected.casualties.displaced.toLocaleString('fr-FR')} déplacés</span>
                  )}
                </div>
              )}
            </div>

            {/* Alternate classifications */}
            {selected.event_type_alts.length > 0 && (
              <div className="border border-b3 bg-b1 p-2.5">
                <div className="mvn-label mb-1">CLASSIFICATIONS ALTERNATIVES</div>
                <div className="flex flex-wrap gap-1">
                  {selected.event_type_alts.map((a) => (
                    <span key={a.type} className="text-3xs font-mono border border-b3 text-t2 px-1.5 py-0.5">
                      {EVENT_TYPE_LABEL[a.type]} <span className="text-t3">{(a.score * 100).toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence */}
            <div className="border border-b3 bg-b1 p-2.5">
              <ConfidenceBreakdown e={selected} />
            </div>

            {/* Geo enrichment */}
            {selected.geo && (
              <div className="border border-b3 bg-b1 p-2.5">
                <div className="mvn-label mb-1">ENRICHISSEMENT GÉOSPATIAL</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs font-mono">
                  <Field label="Population exposée" value={selected.geo.population_at_risk?.toLocaleString('fr-FR')} note="modélisée" />
                  <Field label="Densité" value={selected.geo.population_density && `${selected.geo.population_density} hab/km²`} note="modélisée" />
                  <Field label="Hôpital le plus proche" value={fmtKm(selected.geo.nearest_hospital_km)} />
                  <Field label="Site de déplacés" value={fmtKm(selected.geo.nearest_idp_site_km)} />
                  <Field label="Site minier" value={fmtKm(selected.geo.nearest_mining_site_km)} />
                  <Field label="Frontière" value={fmtKm(selected.geo.nearest_border_km)} />
                  <Field label="Force la plus proche" value={fmtKm(selected.geo.nearest_force_km)} />
                  <Field label="Terrain" value={selected.geo.terrain} />
                </div>
                {selected.geo.axis && (
                  <div className="text-2xs font-mono text-cyn mt-1">◈ Sur axe : {selected.geo.axis}</div>
                )}
              </div>
            )}

            {/* Provenance */}
            <div className="border border-b3 bg-b1 p-2.5">
              <Provenance e={selected} />
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="text-3xs font-mono text-t3 hover:text-t1 mt-1.5 transition-colors"
              >
                {showRaw ? '▾' : '▸'} texte source intégral
              </button>
              {showRaw && (
                <pre className="text-3xs font-mono text-t2 whitespace-pre-wrap mt-1 border-l-2 border-b3 pl-2">
                  {selected.raw_text}
                </pre>
              )}
            </div>

            {/* Adjudication trail */}
            {selected.adjudications.length > 0 && (
              <div className="border border-b3 bg-b1 p-2.5">
                <div className="mvn-label mb-1">HISTORIQUE D&apos;ADJUDICATION</div>
                {selected.adjudications.map((a, i) => (
                  <div key={i} className="text-2xs font-mono text-t2">
                    <span className="text-t1">{a.action.toUpperCase()}</span> · {a.analyst} ·{' '}
                    <span className="text-t3">{dtg(a.at)}</span>
                    {a.notes && <div className="text-t3 text-3xs pl-2">{a.notes}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="border border-b3 bg-b1 p-2.5 space-y-2">
              <div className="mvn-label">ADJUDICATION</div>
              <input
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="Note d'analyste (optionnelle)…"
                className="w-full bg-b0 border border-b3 px-2 py-1 text-2xs font-mono text-t1 placeholder:text-t3 focus:border-blu outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                <ActionBtn label="CONFIRMER" hint="C" cls="border-grn/50 text-grn hover:bg-grn/15" onClick={() => act('confirm')} />
                <ActionBtn label="REJETER" hint="X" cls="border-alert/50 text-alert hover:bg-alert/15" onClick={() => act('reject')} />
                <ActionBtn label="ESCALADER" hint="E" cls="border-amb/50 text-amb hover:bg-amb/15" onClick={() => act('escalate')} />
                <ActionBtn label="DIFFÉRER" hint="D" cls="border-b3 text-t2 hover:bg-b2" onClick={() => act('defer')} />
              </div>
              <div className="text-3xs font-mono text-t3 leading-tight">
                Confirmer ou rejeter met à jour la loi a posteriori de fiabilité de chaque
                source contributrice — y compris, en sens inverse, celle des sources qui
                avaient contredit le consensus.
              </div>
            </div>
          </>
        )}

        {/* Suggested duplicate pairs */}
        {reviewPairs.length > 0 && (
          <div className="border border-amb/30 bg-amb/[0.04] p-2.5">
            <div className="mvn-label mb-1 text-amb">
              DOUBLONS PROBABLES — {reviewPairs.length} PAIRE(S) À ARBITRER
            </div>
            <div className="text-3xs font-mono text-t3 mb-1.5 leading-tight">
              Score entre le seuil de revue et le seuil de fusion automatique, ou fusion
              refusée par les limites d&apos;étendue d&apos;un incident.
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {reviewPairs.slice(0, 12).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-3xs font-mono">
                  <span className="text-amb w-10 shrink-0">{(p.score * 100).toFixed(0)}%</span>
                  <span className="text-t3 truncate flex-1">
                    {Object.entries(p.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')}
                  </span>
                  <button
                    onClick={() => adjudicate(p.a, 'merge', 'Fusion manuelle analyste', [p.b])}
                    className="border border-cyn/40 text-cyn px-1.5 py-0.5 hover:bg-cyn/15 shrink-0 transition-colors"
                  >
                    FUSIONNER
                  </button>
                  <button
                    onClick={() => dismissPair(p.a, p.b)}
                    className="border border-b3 text-t3 px-1.5 py-0.5 hover:text-t1 shrink-0 transition-colors"
                  >
                    DISTINCTS
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, note }: { label: string; value?: string | number | null; note?: string }) {
  if (value == null || value === '') return null;
  return (
    <>
      <span className="text-t3">{label}</span>
      <span className="text-t1">
        {value}
        {note && <span className="text-t3 text-3xs"> ({note})</span>}
      </span>
    </>
  );
}

function fmtKm(km?: number): string | null {
  if (km == null) return null;
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
}

function ActionBtn({
  label, hint, cls, onClick,
}: { label: string; hint: string; cls: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border px-2 py-1 text-2xs font-mono font-bold transition-colors ${cls}`}
    >
      {label}
      <span className="text-3xs opacity-60 border border-current px-0.5">{hint}</span>
    </button>
  );
}
