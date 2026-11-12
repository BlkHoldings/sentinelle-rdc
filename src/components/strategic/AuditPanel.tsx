'use client';

/* Audit journal — every create, change, review and export, newest first. */

import { useMemo, useState } from 'react';
import { useStrategicStore, type AuditAction } from '@/store/useStrategicStore';
import { useToastStore } from '@/store/useToastStore';
import { Frame, Btn, Empty, inputCls, useActor, downloadText } from './ui';

const ACTION: Record<AuditAction, { label: string; color: string }> = {
  'record.create':  { label: 'DOSSIER CRÉÉ',      color: '#3fb984' },
  'record.update':  { label: 'DOSSIER MODIFIÉ',   color: '#58c4dc' },
  'record.status':  { label: 'STATUT CHANGÉ',     color: '#58c4dc' },
  'record.archive': { label: 'DOSSIER ARCHIVÉ',   color: '#e2a336' },
  'report.create':  { label: 'RAPPORT CRÉÉ',      color: '#3fb984' },
  'report.version': { label: 'NOUVELLE VERSION',  color: '#58c4dc' },
  'report.submit':  { label: 'SOUMIS EN REVUE',   color: '#9d8cff' },
  'report.approve': { label: 'RAPPORT APPROUVÉ',  color: '#3fb984' },
  'report.return':  { label: 'RAPPORT RENVOYÉ',   color: '#e2a336' },
  'export':         { label: 'EXPORT',            color: '#f0803c' },
  'workspace.reset':{ label: 'RÉINITIALISATION',  color: '#e5484d' },
};

export default function AuditPanel() {
  const audit = useStrategicStore((s) => s.audit);
  const reset = useStrategicStore((s) => s.resetWorkspace);
  const push  = useToastStore((s) => s.push);
  const { actor } = useActor();
  const [q, setQ] = useState('');
  const [armed, setArmed] = useState(false);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = [...audit].reverse();
    return t ? all.filter((e) => `${e.actor} ${e.label} ${e.detail ?? ''} ${ACTION[e.action].label}`.toLowerCase().includes(t)) : all;
  }, [audit, q]);

  const exportJson = () => {
    downloadText(`nkoyi-journal-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(audit, null, 2));
  };

  return (
    <Frame
      kicker="GOUVERNANCE"
      title="Journal d’audit"
      hint="Ajout seul : aucune action de l’interface ne modifie ni ne supprime une entrée. Conservé dans ce navigateur — une trace, pas une preuve d’intégrité."
      actions={<>
        <Btn onClick={exportJson} disabled={!audit.length}>⬇ JSON</Btn>
        {armed
          ? <Btn tone="danger" onClick={() => { reset(actor); setArmed(false); push('Espace de travail réinitialisé', 'warn'); }}>CONFIRMER — TOUT EFFACER</Btn>
          : <Btn tone="danger" onClick={() => setArmed(true)} title="Restaure les dossiers de démonstration et supprime les rapports. Le journal est conservé.">RÉINITIALISER L’ESPACE</Btn>}
        {armed && <Btn onClick={() => setArmed(false)}>ANNULER</Btn>}
      </>}
    >
      <div className="px-3 md:px-4 py-2 border-b border-b3 bg-b1/60">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer par acteur, objet, action…" aria-label="Filtrer le journal" />
      </div>
      {rows.length === 0 ? (
        <Empty title={audit.length ? 'Aucune entrée ne correspond' : 'Journal vide'}>
          {audit.length ? null : 'Les créations, modifications, relectures et exports s’inscriront ici.'}
        </Empty>
      ) : (
        <ul className="divide-y divide-b3" data-testid="audit-list">
          {rows.map((e) => (
            <li key={e.id} className="px-3 md:px-4 py-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5" data-testid="audit-row">
              <span className="text-t3 text-3xs font-data tabular-nums w-[8.5rem] shrink-0">{e.at.slice(0, 19).replace('T', ' ')}Z</span>
              <span className="text-3xs font-bold tracking-wider w-36 shrink-0" style={{ color: ACTION[e.action].color }}>{ACTION[e.action].label}</span>
              <span className="text-t1 text-2xs min-w-0 flex-1 break-words">{e.label}</span>
              <span className="text-t3 text-3xs ">{e.detail}</span>
              <span className="text-t2 text-3xs ">{e.actor}</span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
