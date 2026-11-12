'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Bibliothèque de dossiers
   ═══════════════════════════════════════════════════════════════════════

   Search, review and edit strategic records. Every record shows its
   confidence and its verification status as two separate things, lists
   its sources with full provenance, and says plainly when it has none.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { useStrategicStore } from '@/store/useStrategicStore';
import { useToastStore } from '@/store/useToastStore';
import {
  SECTORS, ACCESS_BASES, STATUS_LABEL, CONFIDENCE_LABEL, filterRecords, blankRecord, blankSource,
  attentionIndex, standingLabel,
  type StrategicRecord, type Sector, type VerificationStatus, type FieldErrors, type Confidence,
  type AccessBasis, type SourceRef,
} from '@/lib/strategic/model';
import {
  Frame, Btn, ConfidenceTag, StatusTag, IllustrativeTag, Empty, Field, inputCls, useActor, downloadText,
} from './ui';

type StatusFilter = VerificationStatus | 'all' | 'active';

const csvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;

export default function LibraryPanel() {
  const records     = useStrategicStore((s) => s.records);
  const saveRecord  = useStrategicStore((s) => s.saveRecord);
  const setStatus   = useStrategicStore((s) => s.setRecordStatus);
  const logExport   = useStrategicStore((s) => s.logExport);
  const push        = useToastStore((s) => s.push);
  const { actor, level } = useActor();

  const [query, setQuery]   = useState('');
  const [sector, setSector] = useState<Sector | 'all'>('all');
  const [status, setStatusFilter] = useState<StatusFilter>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft]   = useState<StrategicRecord | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const shown = useMemo(
    () => filterRecords(records, { query, sector, status }),
    [records, query, sector, status],
  );
  const open = records.find((r) => r.id === openId) ?? null;

  const startNew  = () => { setDraft(blankRecord(actor)); setErrors({}); setOpenId(null); };
  const startEdit = (r: StrategicRecord) => { setDraft(structuredClone(r)); setErrors({}); };

  const submit = () => {
    if (!draft) return;
    /* Editing seed content makes it the analyst's own record: it stops
       being illustrative the moment someone takes responsibility for it. */
    const errs = saveRecord({ ...draft, illustrative: false }, actor);
    if (errs) { setErrors(errs); return; }
    push('Dossier enregistré', 'success');
    setOpenId(draft.id); setDraft(null);
  };

  const changeStatus = (r: StrategicRecord, s: VerificationStatus) => {
    const errs = setStatus(r.id, s, actor);
    if (errs?.status) push(errs.status, 'warn');
    else push(`Statut : ${STATUS_LABEL[s]}`, 'info');
  };

  const exportCsv = () => {
    const head = 'id,titre,secteur,pays,region,confiance,statut,sources,illustratif,maj';
    const rows = shown.map((r) => [
      r.id, r.title, r.sector, r.country, r.region, CONFIDENCE_LABEL[r.confidence],
      STATUS_LABEL[r.status], r.sources.length, r.illustrative ? 'oui' : 'non', r.updatedAt,
    ].map(csvCell).join(','));
    downloadText(`nkoyi-dossiers-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', `﻿${[head, ...rows].join('\n')}`);
    logExport(actor, 'library', 'Bibliothèque de dossiers', `${shown.length} dossier(s), CSV`);
  };

  return (
    <Frame
      kicker="BASE DE CONNAISSANCE"
      title="Dossiers stratégiques"
      hint="Énergie, mines, infrastructure, commerce, politique publique — chaque affirmation rattachée à ses sources."
      actions={<>
        <Btn onClick={exportCsv} disabled={!shown.length} title="Exporter la sélection affichée">⬇ CSV</Btn>
        <Btn tone="primary" onClick={startNew} testid="new-record">＋ NOUVEAU DOSSIER</Btn>
      </>}
    >
      <div className="flex flex-col lg:flex-row min-h-full">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 px-3 md:px-4 py-2 border-b border-b3 bg-b1/60">
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher titre, région, entité, éditeur…"
              aria-label="Rechercher dans les dossiers"
              className={`${inputCls} flex-1 min-w-[12rem]`} data-testid="record-search"
            />
            <select value={sector} onChange={(e) => setSector(e.target.value as Sector | 'all')}
              aria-label="Secteur" className={`${inputCls} !w-auto`} data-testid="sector-filter">
              <option value="all">Tous secteurs</option>
              {SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Statut" className={`${inputCls} !w-auto`}>
              <option value="active">Actifs</option>
              <option value="all">Tous, archives comprises</option>
              {(Object.keys(STATUS_LABEL) as VerificationStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="px-3 md:px-4 py-1 text-t3 text-3xs tracking-wider" data-testid="record-count">
            {shown.length} DOSSIER{shown.length > 1 ? 'S' : ''} SUR {records.length}
          </div>

          {shown.length === 0 ? (
            <Empty title="Aucun dossier ne correspond">
              {records.length ? 'Élargissez la recherche ou changez de filtre.' : 'La bibliothèque est vide. Créez le premier dossier.'}
            </Empty>
          ) : (
            <ul className="divide-y divide-b3 border-y border-b3">
              {shown.map((r) => {
                const att = attentionIndex(r);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => { setOpenId(r.id); setDraft(null); }}
                      data-testid="record-row"
                      className={`w-full text-left px-3 md:px-4 py-2 transition-colors ${
                        openId === r.id ? 'bg-blu/10' : 'hover:bg-b1'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-t1 text-xs font-bold">{r.title}</span>
                        {r.illustrative && <IllustrativeTag />}
                      </div>
                      <div className="text-t3 text-2xs mt-0.5 line-clamp-2">{r.summary}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-t2 text-3xs tracking-wider">{r.sector.toUpperCase()} · {r.country}{r.region ? ` / ${r.region}` : ''}</span>
                        <ConfidenceTag value={r.confidence} />
                        <StatusTag value={r.status} />
                        <span className={`text-3xs ${r.sources.length ? 'text-t3' : 'text-alert'}`}>
                          {r.sources.length ? `${r.sources.length} source${r.sources.length > 1 ? 's' : ''}` : 'AUCUNE SOURCE'}
                        </span>
                        <span className="text-3xs text-t3 ml-auto" title="Indice d’attention — voir Signaux">▲ {att.score}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {(draft || open) && (
          <aside className="lg:w-[26rem] shrink-0 border-t lg:border-t-0 lg:border-l border-b3 bg-b1" data-testid="record-drawer">
            {draft ? (
              <RecordForm draft={draft} errors={errors} onChange={setDraft} onCancel={() => setDraft(null)} onSubmit={submit} />
            ) : open ? (
              <RecordDetail record={open} canVerify={level !== 'analyst'}
                onEdit={() => startEdit(open)} onStatus={(s) => changeStatus(open, s)} onClose={() => setOpenId(null)} />
            ) : null}
          </aside>
        )}
      </div>
    </Frame>
  );
}

function RecordDetail({
  record: r, canVerify, onEdit, onStatus, onClose,
}: {
  record: StrategicRecord; canVerify: boolean;
  onEdit: () => void; onStatus: (s: VerificationStatus) => void; onClose: () => void;
}) {
  const att = attentionIndex(r);
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mvn-label">{r.sector} · {r.country}{r.region ? ` / ${r.region}` : ''}</div>
          <h2 className="text-t1 text-sm font-bold leading-snug">{r.title}</h2>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="text-t3 hover:text-t1 text-xs">✕</button>
      </div>

      {r.illustrative && (
        <div className="border border-amb/40 bg-amb/10 px-2 py-1 text-amb text-2xs leading-snug">
          Contenu illustratif, inventé pour la démonstration. Ne pas citer. Le modifier en fait votre dossier.
        </div>
      )}

      <p className="text-t2 text-2xs leading-relaxed">{r.summary}</p>

      <div className="flex flex-wrap gap-1.5">
        <ConfidenceTag value={r.confidence} />
        <StatusTag value={r.status} />
      </div>
      <div className="text-t3 text-3xs ">{standingLabel(r)}</div>

      {r.entities.length > 0 && (
        <div>
          <div className="mvn-label mb-0.5">ENTITÉS</div>
          <div className="flex flex-wrap gap-1">
            {r.entities.map((e) => <span key={e} className="px-1 border border-b3 text-t2 text-3xs ">{e}</span>)}
          </div>
        </div>
      )}

      <div>
        <div className="mvn-label mb-0.5">SOURCES ({r.sources.length})</div>
        {r.sources.length === 0 ? (
          <div className="text-alert text-2xs ">Aucune source rattachée — ce dossier n’est étayé par rien.</div>
        ) : (
          <ul className="space-y-1.5">
            {r.sources.map((s) => (
              <li key={s.id} className="border border-b3 bg-b0 px-2 py-1.5">
                <div className="text-t1 text-2xs font-bold break-words">{s.title}</div>
                <div className="text-t2 text-3xs ">{s.publisher}</div>
                {/^https?:/i.test(s.url)
                  ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyn text-3xs break-all hover:underline">{s.url}</a>
                  : <div className="text-t2 text-3xs break-words">Réf. {s.url}</div>}
                <div className="text-t3 text-3xs mt-0.5">
                  Publiée {s.published || 'date inconnue'} · consultée {s.retrieved} · {s.access}
                </div>
                {s.notes && <div className="text-t3 text-3xs mt-0.5 italic">{s.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mvn-label mb-0.5">INDICE D’ATTENTION — {att.score}/100</div>
        <ul className="text-3xs text-t3 space-y-0.5">
          {att.factors.length ? att.factors.map((f) => (
            <li key={f.label} className="flex gap-2"><span className="text-t2 w-7 text-right shrink-0">+{f.points}</span>{f.label}</li>
          )) : <li>Rien à signaler.</li>}
        </ul>
      </div>

      <div className="text-t3 text-3xs ">
        Créé par {r.createdBy} · mis à jour {r.updatedAt.slice(0, 16).replace('T', ' ')} UTC
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-b3">
        <Btn onClick={onEdit} testid="edit-record">✎ MODIFIER</Btn>
        {r.status === 'draft' && <Btn onClick={() => onStatus('in_review')}>→ METTRE EN REVUE</Btn>}
        {r.status === 'in_review' && (
          <Btn tone="primary" onClick={() => onStatus('verified')} disabled={!canVerify}
            title={canVerify ? undefined : 'Réservé aux relecteurs (rôle opérateur ou supérieur)'}>✓ VÉRIFIER</Btn>
        )}
        {r.status !== 'disputed' && r.status !== 'archived' && <Btn onClick={() => onStatus('disputed')}>≠ CONTESTÉ</Btn>}
        {r.status !== 'draft' && r.status !== 'archived' && <Btn onClick={() => onStatus('draft')}>↺ BROUILLON</Btn>}
        {r.status !== 'archived'
          ? <Btn tone="danger" onClick={() => onStatus('archived')}>ARCHIVER</Btn>
          : <Btn onClick={() => onStatus('draft')}>RESTAURER</Btn>}
      </div>
    </div>
  );
}

function RecordForm({
  draft, errors, onChange, onCancel, onSubmit,
}: {
  draft: StrategicRecord; errors: FieldErrors;
  onChange: (r: StrategicRecord) => void; onCancel: () => void; onSubmit: () => void;
}) {
  const set = <K extends keyof StrategicRecord>(k: K, v: StrategicRecord[K]) => onChange({ ...draft, [k]: v });
  const setSource = (i: number, patch: Partial<SourceRef>) =>
    set('sources', draft.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const nErr = Object.keys(errors).length;

  return (
    <form className="p-3 space-y-2.5" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate data-testid="record-form">
      <div className="flex items-center gap-2">
        <h2 className="text-t1 text-sm font-bold flex-1">{draft.title ? 'Modifier le dossier' : 'Nouveau dossier'}</h2>
        <button type="button" onClick={onCancel} aria-label="Annuler" className="text-t3 hover:text-t1 text-xs">✕</button>
      </div>

      {nErr > 0 && (
        <div className="border border-alert/50 bg-alert/10 px-2 py-1 text-alert text-2xs " role="alert" data-testid="form-errors">
          {nErr} point{nErr > 1 ? 's' : ''} à corriger avant l’enregistrement.
        </div>
      )}

      <Field label="TITRE" error={errors.title}>
        <input className={inputCls} value={draft.title} onChange={(e) => set('title', e.target.value)}
          placeholder="Titre clair et descriptif" name="title" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="SECTEUR" error={errors.sector}>
          <select className={inputCls} value={draft.sector} onChange={(e) => set('sector', e.target.value as Sector)}>
            {SECTORS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="PAYS / ENSEMBLE" error={errors.country}>
          <input className={inputCls} value={draft.country} onChange={(e) => set('country', e.target.value)} />
        </Field>
      </div>

      <Field label="RÉGION" hint="Province, corridor ou région">
        <input className={inputCls} value={draft.region} onChange={(e) => set('region', e.target.value)} />
      </Field>

      <Field label="RÉSUMÉ" error={errors.summary}>
        <textarea className={`${inputCls} resize-y`} rows={4} value={draft.summary} name="summary"
          onChange={(e) => set('summary', e.target.value)}
          placeholder="Ce que la preuve établit, et ce qu’elle n’établit pas." />
      </Field>

      <Field label="ENTITÉS" hint="Systèmes, organisations, projets — séparés par des virgules. Jamais de personnes privées.">
        <input className={inputCls} value={draft.entities.join(', ')}
          onChange={(e) => set('entities', e.target.value.split(',').map((x) => x.trimStart()))}
          onBlur={() => set('entities', draft.entities.map((x) => x.trim()).filter(Boolean))} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="CONFIANCE" error={errors.confidence} hint="Votre jugement sur la preuve">
          <select className={inputCls} value={draft.confidence} onChange={(e) => set('confidence', e.target.value as Confidence)} name="confidence">
            {(Object.keys(CONFIDENCE_LABEL) as Confidence[]).map((c) => <option key={c} value={c}>{CONFIDENCE_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="LAT / LON" error={errors.coords} hint="Facultatif — pour la carte">
          <div className="flex gap-1">
            <input className={inputCls} inputMode="decimal" placeholder="lat" defaultValue={draft.lat ?? ''}
              onChange={(e) => set('lat', num(e.target.value))} />
            <input className={inputCls} inputMode="decimal" placeholder="lon" defaultValue={draft.lon ?? ''}
              onChange={(e) => set('lon', num(e.target.value))} />
          </div>
        </Field>
      </div>
      {errors.status && <div className="text-alert text-3xs " role="alert">▸ {errors.status}</div>}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="mvn-label flex-1">SOURCES ({draft.sources.length})</span>
          <Btn onClick={() => set('sources', [...draft.sources, blankSource()])} testid="add-source">＋ SOURCE</Btn>
        </div>
        {draft.sources.length === 0 && (
          <div className="text-t3 text-3xs ">Un dossier sans source reste un brouillon et ne peut pas être mis en revue.</div>
        )}
        <div className="space-y-2">
          {draft.sources.map((s, i) => {
            const er = (k: string) => errors[`sources.${i}.${k}`];
            return (
              <fieldset key={s.id} className="border border-b3 bg-b0 p-2 space-y-1.5">
                <div className="flex items-center">
                  <span className="mvn-label flex-1">SOURCE {i + 1}</span>
                  <button type="button" className="text-t3 hover:text-alert text-3xs "
                    onClick={() => set('sources', draft.sources.filter((_, j) => j !== i))}>RETIRER</button>
                </div>
                <Field label="TITRE" error={er('title')}>
                  <input className={inputCls} value={s.title} onChange={(e) => setSource(i, { title: e.target.value })} />
                </Field>
                <Field label="ÉDITEUR / ORGANISME" error={er('publisher')}>
                  <input className={inputCls} value={s.publisher} onChange={(e) => setSource(i, { publisher: e.target.value })} />
                </Field>
                <Field label="URL OU RÉFÉRENCE" error={er('url')}>
                  <input className={inputCls} value={s.url} onChange={(e) => setSource(i, { url: e.target.value })} placeholder="https://… ou cote du document" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="PUBLIÉE LE" error={er('published')}>
                    <input type="date" className={inputCls} value={s.published} onChange={(e) => setSource(i, { published: e.target.value })} />
                  </Field>
                  <Field label="CONSULTÉE LE" error={er('retrieved')}>
                    <input type="date" className={inputCls} value={s.retrieved} onChange={(e) => setSource(i, { retrieved: e.target.value })} />
                  </Field>
                </div>
                <Field label="BASE D’ACCÈS">
                  <select className={inputCls} value={s.access} onChange={(e) => setSource(i, { access: e.target.value as AccessBasis })}>
                    {ACCESS_BASES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="NOTES DE L’ANALYSTE">
                  <input className={inputCls} value={s.notes} onChange={(e) => setSource(i, { notes: e.target.value })} />
                </Field>
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="flex gap-1.5 pt-1 border-t border-b3">
        <Btn type="submit" tone="primary" testid="save-record">ENREGISTRER</Btn>
        <Btn onClick={onCancel}>ANNULER</Btn>
      </div>
    </form>
  );
}
