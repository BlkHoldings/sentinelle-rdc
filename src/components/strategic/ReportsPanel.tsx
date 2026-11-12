'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Rapports
   ═══════════════════════════════════════════════════════════════════════

   Versioned reports with a second-person approval step. Three rules do
   the work: every edit is a new version; a new version voids any earlier
   approval; and the author of a version cannot approve it.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useStrategicStore, canApprove, type Report, type ReportState } from '@/store/useStrategicStore';
import { useToastStore } from '@/store/useToastStore';
import { Frame, Btn, Empty, inputCls, useActor, downloadText } from './ui';

const STATE: Record<ReportState, { label: string; color: string }> = {
  draft:     { label: 'BROUILLON', color: '#7890a8' },
  in_review: { label: 'EN REVUE',  color: '#18c8e0' },
  approved:  { label: 'APPROUVÉ',  color: '#20c880' },
};

const stamp = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

export default function ReportsPanel({ onOpenWorkbench }: { onOpenWorkbench: () => void }) {
  const reports = useStrategicStore((s) => s.reports);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = reports.find((r) => r.id === openId) ?? reports[0] ?? null;

  return (
    <Frame
      kicker="RAPPORTS"
      title="Rapports versionnés et approbation"
      hint="Un rapport part d’un brief de l’atelier. Il ne peut être marqué approuvé que par un relecteur distinct de son auteur."
      actions={<Btn tone="primary" onClick={onOpenWorkbench}>＋ DEPUIS L’ATELIER</Btn>}
    >
      {reports.length === 0 ? (
        <Empty title="Aucun rapport">
          Construisez un brief dans l’atelier d’analyse, puis choisissez « Brouillon de rapport ».
        </Empty>
      ) : (
        <div className="flex flex-col lg:flex-row min-h-full">
          <ul className="lg:w-72 shrink-0 divide-y divide-b3 border-b lg:border-b-0 lg:border-r border-b3">
            {reports.map((r) => (
              <li key={r.id}>
                <button onClick={() => setOpenId(r.id)} data-testid="report-row"
                  className={`w-full text-left px-3 py-2 ${open?.id === r.id ? 'bg-blu/10' : 'hover:bg-b1'}`}>
                  <div className="text-t1 text-2xs font-mono font-bold line-clamp-2">{r.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-3xs font-mono font-bold" style={{ color: STATE[r.state].color }}>{STATE[r.state].label}</span>
                    <span className="text-t3 text-3xs font-mono">v{r.versions.length}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {open && <ReportView key={open.id} report={open} />}
        </div>
      )}
    </Frame>
  );
}

function ReportView({ report }: { report: Report }) {
  const addVersion = useStrategicStore((s) => s.addReportVersion);
  const submit     = useStrategicStore((s) => s.submitReport);
  const approve    = useStrategicStore((s) => s.approveReport);
  const sendBack   = useStrategicStore((s) => s.returnReport);
  const logExport  = useStrategicStore((s) => s.logExport);
  const push       = useToastStore((s) => s.push);
  const { actor, level } = useActor();

  const latest = report.versions[report.versions.length - 1];
  const [viewN, setViewN]   = useState(latest.n);
  const [editing, setEdit]  = useState(false);
  const [body, setBody]     = useState(latest.body);
  const [note, setNote]     = useState('');
  const [review, setReview] = useState('');

  const shown = report.versions.find((v) => v.n === viewN) ?? latest;
  const gate = canApprove(report, actor, level);

  const saveVersion = () => {
    if (body === latest.body) { push('Aucune modification à enregistrer', 'warn'); return; }
    addVersion(report.id, body, note, actor);
    setEdit(false); setNote(''); setViewN(latest.n + 1);
    push(`Version ${latest.n + 1} enregistrée — le rapport repasse en brouillon`, 'info');
  };

  const act = (fn: typeof approve, ok: string) => {
    const err = fn(report.id, actor, level, review);
    if (err) push(err, 'warn'); else { push(ok, 'success'); setReview(''); }
  };

  const exportMd = () => {
    /* The export carries its own standing. A file that leaves the
       platform must not be able to pass for approved when it was not. */
    const banner = report.state === 'approved'
      ? `> APPROUVÉ par ${report.reviewer} le ${stamp(report.reviewedAt!)} — version ${latest.n}`
      : `> NON APPROUVÉ — ${STATE[report.state].label}. Ne pas diffuser à l’extérieur.`;
    const head = shown.n === latest.n ? banner : `> VERSION ANTÉRIEURE v${shown.n} — remplacée par v${latest.n}.`;
    downloadText(`nkoyi-rapport-v${shown.n}.md`, 'text/markdown', `${head}\n\n${shown.body}\n`);
    logExport(actor, report.id, report.title, `v${shown.n}, Markdown, ${STATE[report.state].label}`);
  };

  return (
    <div className="flex-1 min-w-0 p-3 md:p-4 space-y-3" data-testid="report-view">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-t1 text-sm font-mono font-bold leading-snug">{report.title}</h2>
          <div className="text-3xs font-mono mt-0.5">
            <b style={{ color: STATE[report.state].color }} data-testid="report-state">{STATE[report.state].label}</b>
            <span className="text-t3"> · v{latest.n} par {latest.author} · {stamp(latest.at)} · {report.recordIds.length} dossier(s) cité(s)</span>
          </div>
        </div>
        <Btn onClick={exportMd}>⬇ MARKDOWN</Btn>
        {!editing && <Btn onClick={() => { setBody(latest.body); setEdit(true); setViewN(latest.n); }} testid="report-edit">✎ RÉVISER</Btn>}
        {report.state === 'draft' && !editing && <Btn tone="primary" onClick={() => submit(report.id, actor)} testid="report-submit">→ SOUMETTRE</Btn>}
      </div>

      {report.reviewNote && (
        <div className="border border-b3 bg-b1 px-2 py-1 text-2xs font-mono text-t2">
          <span className="mvn-label mr-1">{report.state === 'approved' ? 'NOTE D’APPROBATION' : 'RENVOYÉ PAR LE RELECTEUR'}</span>
          {report.reviewNote} <span className="text-t3">— {report.reviewer}</span>
        </div>
      )}

      {report.state === 'in_review' && (
        <div className="panel p-2.5 space-y-1.5" data-testid="review-box">
          <div className="mvn-label text-cyn">RELECTURE</div>
          {!gate.ok && <div className="text-amb text-2xs font-mono" data-testid="review-blocked">▸ {gate.why}</div>}
          <input className={inputCls} value={review} onChange={(e) => setReview(e.target.value)}
            placeholder="Note de relecture (obligatoire pour un renvoi)" disabled={!gate.ok} />
          <div className="flex gap-1.5">
            <Btn tone="primary" disabled={!gate.ok} onClick={() => act(approve, 'Rapport approuvé')} testid="report-approve">✓ APPROUVER</Btn>
            <Btn disabled={!gate.ok} onClick={() => act(sendBack, 'Rapport renvoyé à l’auteur')}>↩ RENVOYER</Btn>
          </div>
          <div className="text-t3 text-3xs font-mono">
            Contrôle effectué dans le navigateur : cohérent pour la démonstration, sans valeur de contrôle d’accès.
          </div>
        </div>
      )}

      {editing ? (
        <div className="space-y-1.5">
          <textarea className={`${inputCls} resize-y leading-relaxed`} rows={18} value={body} onChange={(e) => setBody(e.target.value)} data-testid="report-body" />
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce qui change dans cette version" />
          <div className="flex gap-1.5">
            <Btn tone="primary" onClick={saveVersion} testid="report-save">ENREGISTRER COMME v{latest.n + 1}</Btn>
            <Btn onClick={() => setEdit(false)}>ANNULER</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mvn-label mr-1">VERSIONS</span>
            {report.versions.map((v) => (
              <button key={v.n} onClick={() => setViewN(v.n)} title={`${v.note} — ${v.author}, ${stamp(v.at)}`}
                className={`px-1.5 py-0.5 border text-3xs font-mono ${
                  shown.n === v.n ? 'border-cyn text-cyn bg-cyn/10' : 'border-b3 text-t3 hover:text-t1'
                }`}>
                v{v.n}
              </button>
            ))}
            <span className="text-t3 text-3xs font-mono ml-1">{shown.note} — {shown.author}</span>
          </div>
          {shown.n !== latest.n && (
            <div className="text-amb text-2xs font-mono">▸ Version antérieure, remplacée par v{latest.n}.</div>
          )}
          <pre className="panel p-3 text-t2 text-2xs font-mono leading-relaxed whitespace-pre-wrap break-words">{shown.body}</pre>
        </>
      )}
    </div>
  );
}
