'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Analysis assistant
   ═══════════════════════════════════════════════════════════════════════

   A conversational surface over what the workspace already holds: the
   strategic records and the events in the fusion engine. Each answer is
   a structured brief with its evidence one click away.

   No language model is connected. Answers are assembled by rules from
   retrieved records, and the interface says so above the input and in
   every answer. The structure is the one a model-backed service would
   be required to return, so connecting one later replaces the engine
   behind `buildBrief` without changing what the reader is promised.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStrategicStore } from '@/store/useStrategicStore';
import { useFusionStore } from '@/store/useFusionStore';
import { useToastStore } from '@/store/useToastStore';
import { buildBrief, briefToMarkdown, relatedEvents, type Brief, type EventContext } from '@/lib/strategic/synthesis';
import { CONFIDENCE_LABEL, summariseEntities } from '@/lib/strategic/model';
import { activeEvents, provinceOf, tallyBy, ago } from '@/lib/intel/derive';
import { useT, eventTypeLabel } from '@/lib/i18n';
import { WorkspaceHeader, StatusBadge, ConfidenceMeter } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import { IllustrativeTag, useActor } from './ui';
import type { ViewKey } from '@/lib/views';

interface Turn { id: number; brief: Brief; ctx: EventContext }

const L = {
  fr: {
    title: 'Assistant d’analyse',
    hint: 'Interrogez les dossiers et les événements de l’espace de travail. Chaque réponse cite ce qu’elle a utilisé.',
    engine: 'Recherche par mots-clés et assemblage par règles. Aucun modèle d’IA n’est connecté ; rien ne quitte ce navigateur.',
    placeholder: 'Posez une question — un lieu, un acteur, un secteur…',
    send: 'Envoyer', suggestions: 'Questions suggérées', empty: 'Aucune question pour l’instant.',
    you: 'Question', answer: 'Réponse assemblée par règles',
    insufficient: 'Preuve insuffisante : les dossiers ne permettent pas de répondre.',
    findings: 'Constats', evidence: 'Dossiers utilisés', events: 'Événements liés dans le moteur de fusion',
    noEvents: 'Aucun événement fusionné ne correspond.',
    compare: (r: number, p: number) => `${r} événement(s) correspondant(s) sur 7 jours, contre ${p} les 7 jours précédents.`,
    limits: 'Limites et questions ouvertes', next: 'Prochaines étapes',
    toReport: 'Créer un brouillon de rapport', copy: 'Copier', copied: 'Réponse copiée', created: 'Brouillon de rapport créé',
    confidence: 'Confiance', none: 'non établie', clear: 'Effacer la conversation',
    q: {
      entity: (n: string) => `Que sait-on de « ${n} » ?`,
      province: (n: string) => `Quelle est la situation dans la province ${n} ?`,
      sector: (n: string) => `Quels sont les enjeux du secteur ${n} ?`,
      displacement: 'Quels déplacements de population sont signalés ?',
    },
  },
  en: {
    title: 'Analysis assistant',
    hint: 'Query the workspace’s records and events. Every answer cites what it used.',
    engine: 'Keyword retrieval and rule-based assembly. No AI model is connected; nothing leaves this browser.',
    placeholder: 'Ask a question — a place, an actor, a sector…',
    send: 'Send', suggestions: 'Suggested questions', empty: 'No questions yet.',
    you: 'Question', answer: 'Answer assembled by rules',
    insufficient: 'Insufficient evidence: the records cannot answer this.',
    findings: 'Findings', evidence: 'Records used', events: 'Related events in the fusion engine',
    noEvents: 'No fused event matches.',
    compare: (r: number, p: number) => `${r} matching event(s) in 7 days, against ${p} in the previous 7.`,
    limits: 'Limitations and open questions', next: 'Next steps',
    toReport: 'Create report draft', copy: 'Copy', copied: 'Answer copied', created: 'Report draft created',
    confidence: 'Confidence', none: 'not established', clear: 'Clear conversation',
    q: {
      entity: (n: string) => `What do we know about “${n}”?`,
      province: (n: string) => `What is the situation in ${n} province?`,
      sector: (n: string) => `What are the issues in the ${n} sector?`,
      displacement: 'What population displacement is being reported?',
    },
  },
};

export default function WorkbenchPanel({
  onOpenReports, onNavigate,
}: { onOpenReports: () => void; onNavigate?: (v: ViewKey) => void }) {
  const { lang } = useT();
  const tx = L[lang];
  const records      = useStrategicStore((s) => s.records);
  const createReport = useStrategicStore((s) => s.createReport);
  const events       = useFusionStore((s) => s.events);
  const select       = useFusionStore((s) => s.select);
  const push         = useToastStore((s) => s.push);
  const { actor }    = useActor();

  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const titleOf = (id: string) => records.find((r) => r.id === id)?.title ?? id;

  /* Suggestions come from what is actually in the workspace, so each
     one is a question the assistant has material for. */
  const suggestions = useMemo(() => {
    const out: string[] = [];
    const prov = tallyBy(activeEvents(events), provinceOf)[0];
    if (prov) out.push(tx.q.province(prov.key));
    const ent = summariseEntities(records)[0];
    if (ent) out.push(tx.q.entity(ent.name));
    const sector = records.find((r) => r.status !== 'archived')?.sector;
    if (sector) out.push(tx.q.sector(sector.toLowerCase()));
    if (events.some((e) => e.event_type === 'displacement')) out.push(tx.q.displacement);
    return out;
  }, [events, records, tx]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    setTurns((t) => [...t, { id: ++seq.current, brief: buildBrief(text, records), ctx: relatedEvents(text, events) }]);
    setQuestion('');
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [turns.length]);

  const toReport = (b: Brief) => {
    createReport(b.question, briefToMarkdown(b, titleOf), b.evidence.map((e) => e.recordId), actor);
    push(tx.created, 'success');
    onOpenReports();
  };

  return (
    <div className="h-full flex flex-col bg-b0 min-h-0">
      <WorkspaceHeader title={tx.title} hint={tx.hint}
        actions={turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} className="h-7 px-2 rounded border border-b3 text-2xs text-t2 hover:text-t1 hover:bg-b2">{tx.clear}</button>
        )} />

      <div className="flex-1 min-h-0 overflow-y-auto" aria-live="polite">
        <div className="max-w-3xl mx-auto px-3 md:px-5 py-4 space-y-5">
          {turns.length === 0 && (
            <div className="pt-6" data-testid="assistant-suggestions">
              <div className="text-3xs font-semibold uppercase tracking-[0.09em] text-t3 mb-2">{tx.suggestions}</div>
              <div className="flex flex-col gap-1.5 items-start">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} data-testid="assistant-suggestion"
                    className="text-left px-3 py-2 rounded border border-b3 bg-b1 text-xs text-t1 hover:border-t3 hover:bg-b2 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map(({ id, brief: b, ctx }) => (
            <section key={id} className="space-y-2" data-testid="assistant-turn">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded bg-b2 border border-b3 px-3 py-2">
                  <div className="text-3xs text-t3 mb-0.5">{tx.you}</div>
                  <div className="text-xs text-t1 leading-relaxed">{b.question}</div>
                </div>
              </div>

              <article className="rounded border border-b3 bg-b1" data-testid="brief">
                <header className="px-3 py-2 border-b border-b3 flex flex-wrap items-center gap-2">
                  <span className="text-3xs font-semibold uppercase tracking-[0.09em] text-t3 flex-1">{tx.answer}</span>
                  <span className="text-2xs text-t2">
                    {tx.confidence} : <b className="text-t1 font-medium">{b.confidence.level === 'none' ? tx.none : CONFIDENCE_LABEL[b.confidence.level].toLowerCase()}</b>
                  </span>
                </header>

                <div className="px-3 py-2.5 space-y-3">
                  {!b.sufficient && (
                    <p className="border border-amb/40 bg-amb/[0.07] rounded px-2.5 py-1.5 text-2xs text-amb leading-snug" data-testid="brief-insufficient">
                      {tx.insufficient}
                    </p>
                  )}
                  <p className="text-xs text-t1 leading-relaxed">{b.synthesis}</p>
                  <p className="text-2xs text-t3 leading-snug">{b.confidence.rationale}</p>

                  {b.findings.length > 0 && (
                    <div>
                      <h3 className="text-3xs font-semibold uppercase tracking-[0.09em] text-t3 mb-1">{tx.findings}</h3>
                      <ol className="list-decimal pl-4 space-y-1 text-xs text-t2 leading-relaxed">
                        {b.findings.map((f, i) => (
                          <li key={f.recordId}>{f.text} <sup className="font-data text-blu">[{i + 1}]</sup></li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <details className="group" open={b.evidence.length > 0 && b.evidence.length <= 3}>
                    <summary className="text-2xs text-t2 hover:text-t1 cursor-pointer select-none">
                      {tx.evidence} ({b.evidence.length})
                    </summary>
                    <ol className="mt-1.5 space-y-1.5">
                      {b.evidence.map((e, i) => (
                        <li key={e.recordId} className="text-2xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-data text-blu">[{i + 1}]</span>
                          <span className="text-t1">{e.title}</span>
                          {e.illustrative && <IllustrativeTag />}
                          <span className="text-t3 basis-full pl-6">{e.standing}</span>
                        </li>
                      ))}
                    </ol>
                  </details>

                  <details open={ctx.events.length > 0}>
                    <summary className="text-2xs text-t2 hover:text-t1 cursor-pointer select-none">
                      {tx.events} ({ctx.total})
                    </summary>
                    {ctx.events.length === 0 ? <p className="mt-1 text-2xs text-t3">{tx.noEvents}</p> : (
                      <>
                        <p className="mt-1 text-2xs text-t3" data-testid="assistant-compare">{tx.compare(ctx.recent, ctx.previous)}</p>
                        <ul className="mt-1.5 divide-y divide-b3 border border-b3 rounded">
                          {ctx.events.map((e) => (
                            <li key={e.event_id}>
                              <button type="button" disabled={!onNavigate}
                                onClick={() => { select(e.event_id); onNavigate?.('live'); }}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-b2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                                <span className="text-2xs text-t1 font-medium">{eventTypeLabel(lang, e.event_type)}{e.location ? ` — ${e.location.place_name}` : ''}</span>
                                <StatusBadge status={e.status} />
                                <ConfidenceMeter value={e.confidence} showLabel={false} />
                                <span className="font-data text-3xs text-t3 ml-auto">{ago(e.timestamp, lang)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </details>

                  <details>
                    <summary className="text-2xs text-t2 hover:text-t1 cursor-pointer select-none">
                      {tx.limits} ({b.limitations.length + b.unresolved.length})
                    </summary>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-2xs text-t3 leading-snug">
                      {b.limitations.map((x) => <li key={x}>{x}</li>)}
                      {b.unresolved.map((x) => <li key={x} className="text-t2">{x}</li>)}
                    </ul>
                  </details>

                  <details>
                    <summary className="text-2xs text-t2 hover:text-t1 cursor-pointer select-none">{tx.next}</summary>
                    <ol className="mt-1 list-decimal pl-4 space-y-0.5 text-2xs text-t3 leading-snug">
                      {b.nextSteps.map((x) => <li key={x}>{x}</li>)}
                    </ol>
                  </details>
                </div>

                <footer className="px-3 py-2 border-t border-b3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => toReport(b)} data-testid="brief-to-report"
                    className="h-7 px-2.5 rounded border border-b3 text-2xs text-t1 hover:bg-b2 inline-flex items-center gap-1.5">
                    <Icon name="doc" size={13} />{tx.toReport}
                  </button>
                  <button type="button"
                    onClick={() => { void navigator.clipboard?.writeText(briefToMarkdown(b, titleOf)); push(tx.copied, 'info'); }}
                    className="h-7 px-2.5 rounded border border-b3 text-2xs text-t2 hover:text-t1 hover:bg-b2">{tx.copy}</button>
                </footer>
              </article>
            </section>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <form className="shrink-0 border-t border-b3 bg-b1" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <div className="max-w-3xl mx-auto px-3 md:px-5 py-2.5">
          <div className="flex gap-2">
            <input
              value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={tx.placeholder}
              aria-label={tx.placeholder} data-testid="workbench-question"
              className="flex-1 h-9 bg-b0 border border-b3 hover:border-t3 focus:border-blu rounded px-3 text-xs text-t1 placeholder:text-t3 focus:outline-none"
            />
            <button type="submit" disabled={!question.trim()} data-testid="workbench-run"
              className="h-9 px-3.5 rounded bg-t1 text-b0 text-xs font-semibold hover:bg-white disabled:opacity-40">{tx.send}</button>
          </div>
          <p className="text-3xs text-t3 mt-1.5 leading-snug" data-testid="assistant-engine">{tx.engine}</p>
        </div>
      </form>
    </div>
  );
}
