'use client';

/* Entities and signals — two read-only views derived from the records.
   Neither stores anything of its own: change a record and both follow. */

import { useMemo, useState } from 'react';
import { useStrategicStore } from '@/store/useStrategicStore';
import { summariseEntities, attentionIndex } from '@/lib/strategic/model';
import { Frame, Empty, ConfidenceTag, StatusTag, IllustrativeTag } from './ui';

export function EntitiesPanel() {
  const records = useStrategicStore((s) => s.records);
  const entities = useMemo(() => summariseEntities(records), [records]);
  const [sel, setSel] = useState<string | null>(null);
  const current = entities.find((e) => e.name === sel) ?? null;

  return (
    <Frame
      kicker="EXPLORATEUR D’ENTITÉS"
      title="Systèmes, organisations et projets"
      hint="Calculé à partir des entités nommées dans les dossiers. Un lien signifie « cités dans le même dossier », rien de plus."
    >
      {entities.length === 0 ? (
        <Empty title="Aucune entité">Renseignez le champ « Entités » des dossiers pour les voir apparaître ici.</Empty>
      ) : (
        <div className="p-3 md:p-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {entities.map((e) => {
            const active = current?.name === e.name;
            return (
              <div key={e.name} className={`panel p-2.5 ${active ? 'border-cyn' : ''}`} data-testid="entity-card">
                <button className="w-full text-left" onClick={() => setSel(active ? null : e.name)}>
                  <div className="mvn-label">{e.sectors.join(' · ')}</div>
                  <div className="text-t1 text-xs font-mono font-bold leading-snug">{e.name}</div>
                  <div className="text-t3 text-2xs font-mono mt-0.5">
                    {e.records.length} dossier{e.records.length > 1 ? 's' : ''} · {e.linked.length} entité{e.linked.length > 1 ? 's' : ''} liée{e.linked.length > 1 ? 's' : ''}
                  </div>
                </button>
                {active && (
                  <div className="mt-2 pt-2 border-t border-b3 space-y-2">
                    <div>
                      <div className="mvn-label mb-0.5">DOSSIERS</div>
                      <ul className="space-y-1">
                        {e.records.map((r) => (
                          <li key={r.id} className="text-2xs font-mono text-t2">
                            {r.title}
                            <span className="flex flex-wrap gap-1 mt-0.5">
                              <ConfidenceTag value={r.confidence} /><StatusTag value={r.status} />
                              {r.illustrative && <IllustrativeTag />}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {e.linked.length > 0 && (
                      <div>
                        <div className="mvn-label mb-0.5">CO-CITÉES</div>
                        <ul className="space-y-0.5">
                          {e.linked.map((l) => (
                            <li key={l.name}>
                              <button onClick={() => setSel(l.name)} className="text-cyn text-2xs font-mono hover:underline text-left">
                                {l.name} <span className="text-t3">· {l.shared} dossier{l.shared > 1 ? 's' : ''} en commun</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Frame>
  );
}

export function SignalsPanel() {
  const records = useStrategicStore((s) => s.records);
  const ranked = useMemo(
    () => records.filter((r) => r.status !== 'archived')
      .map((r) => ({ r, att: attentionIndex(r) }))
      .sort((a, b) => b.att.score - a.att.score),
    [records],
  );

  return (
    <Frame
      kicker="RISQUES ET SIGNAUX"
      title="Où le travail d’analyse est attendu"
      hint="L’indice mesure le besoin de relecture d’un dossier — pas l’importance ni le risque de son sujet. Chaque point est justifié."
    >
      {ranked.length === 0 ? (
        <Empty title="Aucun dossier actif" />
      ) : (
        <div className="p-3 md:p-4 grid gap-2 md:grid-cols-2">
          {ranked.map(({ r, att }) => {
            const color = att.score >= 60 ? '#e03030' : att.score >= 35 ? '#d09820' : '#20c880';
            return (
              <div key={r.id} className="panel p-2.5" data-testid="signal-card">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mvn-label">{r.sector} · {r.region || r.country}</div>
                    <div className="text-t1 text-xs font-mono font-bold leading-snug">{r.title}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-mono font-bold leading-none" style={{ color }}>{att.score}</div>
                    <div className="text-t3 text-3xs font-mono">/100</div>
                  </div>
                </div>
                <div className="h-1 bg-b3 mt-1.5">
                  <div className="h-full" style={{ width: `${att.score}%`, background: color }} />
                </div>
                <ul className="mt-1.5 text-3xs font-mono text-t3 space-y-0.5">
                  {att.factors.map((f) => (
                    <li key={f.label} className="flex gap-2"><span className="text-t2 w-7 text-right shrink-0">+{f.points}</span>{f.label}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <ConfidenceTag value={r.confidence} /><StatusTag value={r.status} />
                  {r.illustrative && <IllustrativeTag />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Frame>
  );
}
