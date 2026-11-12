'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Atelier d’analyse
   ═══════════════════════════════════════════════════════════════════════

   Ask a question of the workspace; get back a structured brief that
   cites the records it used and says where the evidence runs out.

   The panel states, above the input and again in every brief, that no
   language model is involved. See lib/strategic/synthesis.ts.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useStrategicStore } from '@/store/useStrategicStore';
import { useToastStore } from '@/store/useToastStore';
import { buildBrief, briefToMarkdown, type Brief } from '@/lib/strategic/synthesis';
import { CONFIDENCE_LABEL } from '@/lib/strategic/model';
import { Frame, Btn, IllustrativeTag, inputCls, useActor } from './ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mvn-label text-cyn mb-0.5">{title}</h3>
      <div className="text-t2 text-2xs font-mono leading-relaxed">{children}</div>
    </section>
  );
}

export default function WorkbenchPanel({ onOpenReports }: { onOpenReports: () => void }) {
  const records      = useStrategicStore((s) => s.records);
  const createReport = useStrategicStore((s) => s.createReport);
  const push         = useToastStore((s) => s.push);
  const { actor }    = useActor();
  const [question, setQuestion] = useState('');
  const [brief, setBrief] = useState<Brief | null>(null);

  const titleOf = (id: string) => records.find((r) => r.id === id)?.title ?? id;

  const run = () => {
    if (!question.trim()) { push('Saisissez d’abord une question', 'warn'); return; }
    setBrief(buildBrief(question, records));
  };

  const toReport = () => {
    if (!brief) return;
    createReport(brief.question, briefToMarkdown(brief, titleOf), brief.evidence.map((e) => e.recordId), actor);
    push('Brouillon de rapport créé', 'success');
    onOpenReports();
  };

  return (
    <Frame
      kicker="ATELIER D’ANALYSE"
      title="Interroger l’espace de travail"
      hint="Recherche par mots-clés dans vos dossiers, restituée dans une structure fixe. Aucun modèle d’IA n’est connecté ; rien ne quitte ce navigateur."
    >
      <div className="p-3 md:p-4 max-w-3xl space-y-3">
        <div className="panel p-2.5 space-y-2">
          <textarea
            value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
            placeholder="Exemple : quelles sont les contraintes logistiques sur le cuivre au Lualaba ?"
            aria-label="Question d’analyse" className={`${inputCls} resize-y`} data-testid="workbench-question"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-t3 text-3xs font-mono flex-1 min-w-[12rem]">
              {records.filter((r) => r.status !== 'archived').length} dossiers consultables · aucun accès au web
            </span>
            <Btn tone="primary" onClick={run} testid="workbench-run">▶ CONSTRUIRE LE BRIEF</Btn>
          </div>
        </div>

        {brief && (
          <article className="panel p-3 space-y-3" data-testid="brief">
            <header className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="mvn-label">QUESTION</div>
                <h2 className="text-t1 text-xs font-mono font-bold">{brief.question}</h2>
              </div>
              <Btn onClick={() => { void navigator.clipboard?.writeText(briefToMarkdown(brief, titleOf)); push('Brief copié', 'info'); }}>COPIER</Btn>
              <Btn tone="primary" onClick={toReport} testid="brief-to-report">→ BROUILLON DE RAPPORT</Btn>
            </header>

            {!brief.sufficient && (
              <div className="border border-amb/40 bg-amb/10 px-2 py-1 text-amb text-2xs font-mono leading-snug" data-testid="brief-insufficient">
                Preuve insuffisante : l’espace de travail ne permet pas de répondre à cette question.
              </div>
            )}

            <Section title="SYNTHÈSE">{brief.synthesis}</Section>

            <Section title="CONSTATS">
              {brief.findings.length ? (
                <ol className="list-decimal pl-4 space-y-1">
                  {brief.findings.map((f) => (
                    <li key={f.recordId}>{f.text} <span className="text-t3">— [{titleOf(f.recordId)}]</span></li>
                  ))}
                </ol>
              ) : 'Aucun.'}
            </Section>

            <Section title="ÉLÉMENTS DE PREUVE">
              {brief.evidence.length ? (
                <ul className="space-y-1">
                  {brief.evidence.map((e) => (
                    <li key={e.recordId} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-t1">{e.title}</span>
                      {e.illustrative && <IllustrativeTag />}
                      <span className="text-t3 basis-full">{e.standing}</span>
                    </li>
                  ))}
                </ul>
              ) : 'Aucun dossier retrouvé.'}
            </Section>

            <Section title="CONFIANCE">
              <b className="text-t1">{brief.confidence.level === 'none' ? 'Non établie' : CONFIDENCE_LABEL[brief.confidence.level]}</b> — {brief.confidence.rationale}
            </Section>

            <Section title="LIMITES">
              <ul className="list-disc pl-4 space-y-0.5">{brief.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
            </Section>

            <Section title="QUESTIONS OUVERTES">
              {brief.unresolved.length
                ? <ul className="list-disc pl-4 space-y-0.5">{brief.unresolved.map((x) => <li key={x}>{x}</li>)}</ul>
                : 'Aucune relevée.'}
            </Section>

            <Section title="PROCHAINES ÉTAPES">
              <ol className="list-decimal pl-4 space-y-0.5">{brief.nextSteps.map((x) => <li key={x}>{x}</li>)}</ol>
            </Section>
          </article>
        )}
      </div>
    </Frame>
  );
}
