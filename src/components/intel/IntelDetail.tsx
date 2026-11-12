'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Event record
   ═══════════════════════════════════════════════════════════════════════

   Everything the engine knows about one fused event, arranged so a
   reader can tell at each line what kind of statement it is:

   • what sources said        — quoted, attributed, dated, linkable
   • what the engine computed — labelled as automatic, with its working
   • what an analyst decided  — signed and timestamped
   • what a model would add   — an empty, labelled slot: none is connected

   These are kept in separate sections with separate headings and never
   blended into one narrative paragraph, because a paragraph has one
   voice and these four do not deserve the same trust.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState, type ReactNode } from 'react';
import type { FusedEvent } from '@/lib/fusion/schema';
import { useFusionStore } from '@/store/useFusionStore';
import { useToastStore } from '@/store/useToastStore';
import { flyTo } from '@/lib/mapController';
import { toMGRSSync } from '@/lib/mgrs';
import { useT, eventTypeLabel, familyLabel, type MsgKey } from '@/lib/i18n';
import {
  categoryOf, originOf, isSimulatedSource, firstPublished, lastUpdated, zulu, ago,
} from '@/lib/intel/derive';
import { StatusBadge, CategoryTag, OriginTag, ConfidenceMeter, Fact } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import type { ViewKey } from '@/lib/views';

function Section({ title, note, children, testid }: { title: string; note?: string; children: ReactNode; testid?: string }) {
  return (
    <section className="px-4 py-3 border-b border-b3" data-testid={testid}>
      <h3 className="text-3xs font-semibold uppercase tracking-[0.09em] text-t3 mb-1.5">{title}</h3>
      {note && <p className="text-3xs text-t3 -mt-1 mb-1.5 leading-snug">{note}</p>}
      {children}
    </section>
  );
}

const AGREE_STYLE = {
  agree:      { color: '#3fb984', glyph: '✓' },
  partial:    { color: '#e2a336', glyph: '≈' },
  contradict: { color: '#e5484d', glyph: '≠' },
};

const ACTION_LABEL: Record<string, [string, string]> = {
  confirm: ['Confirmé', 'Confirmed'], reject: ['Rejeté', 'Rejected'], merge: ['Fusionné', 'Merged'],
  edit: ['Note', 'Note'], escalate: ['Escaladé', 'Escalated'], defer: ['Reporté', 'Deferred'],
};

export default function IntelDetail({
  event: e, onClose, onNavigate,
}: { event: FusedEvent; onClose?: () => void; onNavigate: (v: ViewKey, keepSelection?: boolean) => void }) {
  const { t, lang } = useT();
  const adjudicate = useFusionStore((s) => s.adjudicate);
  const select = useFusionStore((s) => s.select);
  const push = useToastStore((s) => s.push);
  const [note, setNote] = useState('');

  const origin = originOf(e);
  const timeline = [...e.provenance].sort((a, b) => a.source.published_at.localeCompare(b.source.published_at));
  const conflicts = e.provenance.filter((p) => p.agreement === 'contradict');
  const notes = e.adjudications.filter((a) => a.notes);
  const c = e.casualties;
  const toll = ([['fatalities', c.fatalities], ['injured', c.injured], ['abducted', c.abducted], ['displaced', c.displaced]] as const)
    .filter(([, v]) => v != null && v > 0);
  const g = e.geo;

  const saveNote = () => {
    if (!note.trim()) return;
    adjudicate(e.event_id, 'edit', note.trim());
    setNote('');
    push(lang === 'fr' ? 'Note enregistrée' : 'Note saved', 'success');
  };

  const showOnMap = () => {
    if (!e.location) return;
    onNavigate('map', true);
    // The map remounts its camera on view change; fly once it is there.
    setTimeout(() => flyTo({ longitude: e.location!.lon, latitude: e.location!.lat, zoom: 10 }), 250);
  };

  return (
    <article className="h-full flex flex-col bg-b1 min-h-0" aria-label={eventTypeLabel(lang, e.event_type)} data-testid="intel-detail">
      <header className="shrink-0 px-4 pt-3 pb-2.5 border-b border-b3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-1">
              <CategoryTag category={categoryOf(e)} />
              <StatusBadge status={e.status} />
              <OriginTag origin={origin} />
            </div>
            <h2 className="text-t1 text-base font-semibold leading-snug tracking-tight">
              {eventTypeLabel(lang, e.event_type)}
              {e.location && <span className="text-t2 font-normal"> — {e.location.place_name}</span>}
            </h2>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label={t('detail.close')}
              className="h-7 w-7 flex items-center justify-center rounded text-t3 hover:text-t1 hover:bg-b2 shrink-0">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-2xs">
          {([['feed.reported', e.timestamp], ['feed.published', firstPublished(e)], ['feed.updated', lastUpdated(e)]] as const).map(([k, v]) => (
            <div key={k}>
              <dt className="text-t3 text-3xs">{t(k)}</dt>
              <dd className="font-data text-t1 tabular-nums" title={ago(v, lang)}>{zulu(v).slice(5)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={showOnMap} disabled={!e.location}
            className="h-7 px-2 rounded border border-b3 text-2xs text-t1 hover:bg-b2 disabled:opacity-40 inline-flex items-center gap-1.5">
            <Icon name="pin" size={13} />{t('detail.showOnMap')}
          </button>
          <button type="button" onClick={() => { select(e.event_id); onNavigate('triage'); }}
            className="h-7 px-2 rounded border border-b3 text-2xs text-t1 hover:bg-b2 inline-flex items-center gap-1.5">
            <Icon name="scale" size={13} />{t('detail.openTriage')}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {origin !== 'collected' && (
          <div className="mx-4 mt-3 border border-amb/40 bg-amb/[0.07] rounded px-2.5 py-1.5 text-2xs text-amb leading-snug" role="note">
            {t('origin.help')}
          </div>
        )}

        <Section title={t('detail.summary.auto')} note={t('detail.summary.auto.help')} testid="detail-summary">
          <p className="text-t1 text-xs leading-relaxed">{e.description}</p>
        </Section>

        <Section title={t('detail.ai')} testid="detail-ai">
          <p className="text-t3 text-2xs leading-relaxed border border-dashed border-b3 rounded px-2.5 py-2">{t('detail.ai.none')}</p>
        </Section>

        <Section title={t('detail.confidence')} note={t('detail.confidence.prior')} testid="detail-confidence">
          <div className="mb-2"><ConfidenceMeter value={e.confidence} /></div>
          <ul className="space-y-1">
            {e.confidence_factors.map((f, i) => (
              <li key={i} className="flex items-baseline gap-2 text-2xs">
                <span className={`font-data tabular-nums w-12 text-right shrink-0 ${f.delta >= 0 ? 'text-grn' : 'text-alert'}`}>
                  {f.delta >= 0 ? '+' : '−'}{Math.abs(f.delta).toFixed(2)}
                </span>
                <span className="text-t1 min-w-0">{f.label}{f.detail && <span className="text-t3"> — {f.detail}</span>}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t('detail.classification')}>
          <div className="text-t1 text-xs">{eventTypeLabel(lang, e.event_type)}</div>
          {e.event_type_alts.length > 0 && (
            <div className="mt-1 text-2xs text-t3">
              {t('detail.alternatives')} :{' '}
              {e.event_type_alts.slice(0, 3).map((a, i) => (
                <span key={a.type} className="text-t2">
                  {i > 0 && ' · '}{eventTypeLabel(lang, a.type)} <span className="font-data text-t3">{a.score.toFixed(2)}</span>
                </span>
              ))}
            </div>
          )}
          {e.actors.length > 0 && (
            <div className="mt-2">
              <div className="text-3xs text-t3 mb-1">{t('detail.actors')}</div>
              <div className="flex flex-wrap gap-1">
                {e.actors.map((a) => <span key={a} className="px-1.5 py-0.5 rounded bg-b2 border border-b3 text-2xs text-t1">{a}</span>)}
              </div>
            </div>
          )}
          {toll.length > 0 && (
            <div className="mt-2">
              <div className="text-3xs text-t3 mb-1">{t('detail.casualties')}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {toll.map(([k, v]) => (
                  <span key={k} className="text-2xs text-t2">
                    <span className="font-data text-t1 text-sm tabular-nums">{v!.toLocaleString('fr-FR')}</span> {t(`detail.${k}` as MsgKey)}
                  </span>
                ))}
              </div>
              {c.fatalities_range && c.fatalities_range[0] !== c.fatalities_range[1] && (
                <div className="text-3xs text-t3 mt-0.5">
                  {lang === 'fr' ? 'Les sources divergent' : 'Sources differ'} : {c.fatalities_range[0]}–{c.fatalities_range[1]}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title={t('detail.geo')} testid="detail-geo">
          {e.location ? (
            <dl>
              <Fact label={t('detail.precision')}>
                {t('detail.precision.value', {
                  km: +e.location.radius_km.toFixed(1),
                  method: t(`detail.method.${e.location.method}` as MsgKey),
                })}
              </Fact>
              <Fact label="MGRS"><span className="font-data">{toMGRSSync(e.location.lat, e.location.lon, 4)}</span></Fact>
              {g?.admin.province && <Fact label={t('detail.province')}>{g.admin.province}</Fact>}
              {g?.admin.territory && <Fact label={t('detail.territory')}>{g.admin.territory}</Fact>}
              {g?.axis && <Fact label={t('detail.axis')}>{g.axis}</Fact>}
              {g?.terrain && <Fact label={t('detail.terrain')}>{g.terrain}</Fact>}
              {g?.population_at_risk != null && <Fact label={t('detail.pop')}>≈ {Math.round(g.population_at_risk).toLocaleString('fr-FR')}</Fact>}
              {g?.nearest_hospital_km != null && <Fact label={t('detail.hospital')}>{g.nearest_hospital_km.toFixed(0)} km</Fact>}
              {g?.nearest_border_km != null && <Fact label={t('detail.border')}>{g.nearest_border_km.toFixed(0)} km</Fact>}
            </dl>
          ) : <p className="text-2xs text-t3">{t('common.unknown')}</p>}
        </Section>

        <Section title={`${t('detail.sources')} (${e.provenance.length})`} testid="detail-sources">
          <ol className="space-y-2">
            {timeline.map((p, i) => {
              const sim = isSimulatedSource(p);
              const ag = AGREE_STYLE[p.agreement];
              return (
                <li key={`${p.source.id}-${i}`} className="relative pl-4" data-testid="detail-source">
                  <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-t3" aria-hidden="true" />
                  {i < timeline.length - 1 && <span className="absolute left-[2.5px] top-3.5 bottom-[-0.5rem] w-px bg-b3" aria-hidden="true" />}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs">
                    <span className="font-data text-t3 tabular-nums">{zulu(p.source.published_at).slice(5)}</span>
                    <span className="text-t1 font-medium">{p.source.handle ?? p.source.type}</span>
                    <span className="text-t3">{familyLabel(lang, p.source.family)}</span>
                    {sim && <OriginTag origin="simulated" />}
                    <span className="font-data text-t3" title={t('detail.grade')}>{p.source.grade}{p.source.credibility}</span>
                    <span className="inline-flex items-center gap-1" style={{ color: ag.color }}>
                      <span aria-hidden="true">{ag.glyph}</span>{t(`detail.${p.agreement}` as MsgKey)}
                    </span>
                  </div>
                  <blockquote className="mt-0.5 text-2xs text-t2 leading-relaxed border-l border-b3 pl-2">{p.raw_text}</blockquote>
                  <div className="mt-0.5 text-3xs">
                    {p.source.url && /^https?:/i.test(p.source.url) && !sim
                      ? <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="text-blu hover:underline inline-flex items-center gap-1">
                          <Icon name="external" size={11} />{t('detail.sources.open')}
                        </a>
                      : <span className="text-t3">{t('detail.sources.nolink')}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section title={t('detail.conflicts')} testid="detail-conflicts">
          {conflicts.length === 0
            ? <p className="text-2xs text-t3">{t('detail.conflicts.none')}</p>
            : (
              <ul className="space-y-1.5">
                {conflicts.map((p, i) => (
                  <li key={i} className="border border-alert/30 bg-alert/[0.05] rounded px-2 py-1.5 text-2xs">
                    <div className="text-t1 font-medium">{p.source.handle ?? p.source.type}</div>
                    <div className="text-t2 leading-relaxed">{p.raw_text}</div>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section title={t('detail.history')} testid="detail-history">
          {e.adjudications.length === 0
            ? <p className="text-2xs text-t3">{t('detail.history.none')}</p>
            : (
              <ol className="space-y-1">
                {e.adjudications.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-2xs">
                    <span className="font-data text-t3 tabular-nums">{zulu(a.at).slice(5)}</span>
                    <span className="text-t1 font-medium">{(ACTION_LABEL[a.action] ?? [a.action, a.action])[lang === 'fr' ? 0 : 1]}</span>
                    <span className="text-t3">{a.analyst}</span>
                  </li>
                ))}
              </ol>
            )}
        </Section>

        <Section title={t('detail.notes')} testid="detail-notes">
          {notes.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {notes.map((a, i) => (
                <li key={i} className="text-2xs">
                  <div className="text-t1 leading-relaxed">{a.notes}</div>
                  <div className="text-t3 text-3xs">{a.analyst} · {zulu(a.at)}</div>
                </li>
              ))}
            </ul>
          )}
          <label className="block">
            <span className="sr-only">{t('detail.notes.add')}</span>
            <textarea
              value={note} onChange={(ev) => setNote(ev.target.value)} rows={2}
              placeholder={t('detail.notes.placeholder')} data-testid="detail-note-input"
              className="w-full bg-b0 border border-b3 focus:border-blu rounded px-2 py-1.5 text-2xs text-t1 placeholder:text-t3 focus:outline-none resize-y"
            />
          </label>
          <button type="button" onClick={saveNote} disabled={!note.trim()} data-testid="detail-note-save"
            className="mt-1 h-7 px-2.5 rounded border border-b3 text-2xs text-t1 hover:bg-b2 disabled:opacity-40">
            {t('detail.notes.save')}
          </button>
        </Section>

        <div className="px-4 py-2 font-data text-3xs text-t3 break-all">ID {e.event_id}</div>
      </div>
    </article>
  );
}
