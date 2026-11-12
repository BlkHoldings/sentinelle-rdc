'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Strategic workspace store
   ═══════════════════════════════════════════════════════════════════════

   Records, reports and the audit trail, behind one typed data-access
   layer. Components call the actions here and never touch storage, so
   replacing the browser store with a server one changes this file only.

   What this layer is honest about:

   • Storage is this browser's localStorage. Nothing is shared between
     users or devices, and clearing site data erases it. The interface
     says so.
   • Roles are checked here, in the client. That makes the workflow
     coherent for a demonstration; it is not access control, because
     anyone can edit client code. Real enforcement belongs on a server
     with row-level security.
   • The audit trail is append-only through this API — there is no
     action that edits or removes an entry — but it lives in the same
     browser storage, so it is a record of what happened, not
     tamper-evidence.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand';
import {
  validateRecord, newId, type StrategicRecord, type FieldErrors, type VerificationStatus,
} from '@/lib/strategic/model';
import { SEED_RECORDS } from '@/lib/strategic/seed';
import { useSettingsStore } from '@/store/useSettingsStore';

const KEY = 'nkoyi.strategic.v1';
const SCHEMA_VERSION = 1;
const AUDIT_CAP = 5000;

export type AuditAction =
  | 'record.create' | 'record.update' | 'record.status' | 'record.archive'
  | 'report.create' | 'report.version' | 'report.submit' | 'report.approve'
  | 'report.return' | 'export' | 'workspace.reset';

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  /** Id of the record or report concerned. */
  target: string;
  /** Human-readable label of the target at the time of the event. */
  label: string;
  detail?: string;
}

export type ReportState = 'draft' | 'in_review' | 'approved';

export interface ReportVersion {
  n: number;
  body: string;
  at: string;
  author: string;
  note: string;
}

export interface Report {
  id: string;
  title: string;
  state: ReportState;
  versions: ReportVersion[];
  /** Records cited by the brief this report was started from. */
  recordIds: string[];
  reviewer?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

interface Persisted {
  version: number;
  records: StrategicRecord[];
  reports: Report[];
  audit: AuditEvent[];
}

export type Level = 'analyst' | 'operator' | 'commander';

/** Who may approve. A second person, with a reviewing role. */
export function canApprove(report: Report, actor: string, level: Level): { ok: boolean; why?: string } {
  if (report.state !== 'in_review') return { ok: false, why: 'Le rapport n’est pas en revue.' };
  if (level === 'analyst') return { ok: false, why: 'Le rôle analyste ne peut pas approuver ; un relecteur est requis.' };
  const author = report.versions[report.versions.length - 1]?.author;
  if (author === actor) return { ok: false, why: 'L’auteur de la version ne peut pas l’approuver lui-même.' };
  return { ok: true };
}

/* ── Data access ─────────────────────────────────────────────────── */

function load(): { data: Persisted; persisted: boolean } {
  const fresh: Persisted = { version: SCHEMA_VERSION, records: SEED_RECORDS, reports: [], audit: [] };
  if (typeof window === 'undefined') return { data: fresh, persisted: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { data: fresh, persisted: true };
    const p = JSON.parse(raw) as Partial<Persisted>;
    // An unknown schema is not guessed at: start clean rather than
    // render records whose shape this build does not understand.
    if (p.version !== SCHEMA_VERSION || !Array.isArray(p.records)) return { data: fresh, persisted: true };
    return {
      data: {
        version: SCHEMA_VERSION, records: p.records,
        reports: Array.isArray(p.reports) ? p.reports : [],
        audit: Array.isArray(p.audit) ? p.audit : [],
      },
      persisted: true,
    };
  } catch {
    return { data: fresh, persisted: false };
  }
}

function save(d: Persisted): boolean {
  try { window.localStorage.setItem(KEY, JSON.stringify(d)); return true; }
  catch { return false; }   // private mode / quota — the session still works
}

export interface StrategicState {
  hydrated: boolean;
  /** False when the browser refused storage: work survives only until reload. */
  persisted: boolean;
  records: StrategicRecord[];
  reports: Report[];
  audit: AuditEvent[];

  hydrate: () => void;
  saveRecord: (r: StrategicRecord, actor: string) => FieldErrors | null;
  setRecordStatus: (id: string, status: VerificationStatus, actor: string) => FieldErrors | null;
  createReport: (title: string, body: string, recordIds: string[], actor: string) => string;
  addReportVersion: (id: string, body: string, note: string, actor: string) => void;
  submitReport: (id: string, actor: string) => void;
  approveReport: (id: string, actor: string, level: Level, note: string) => string | null;
  returnReport: (id: string, actor: string, level: Level, note: string) => string | null;
  logExport: (actor: string, target: string, label: string, detail: string) => void;
  resetWorkspace: (actor: string) => void;
}

export const useStrategicStore = create<StrategicState>((set, get) => {
  /** Apply a change, append its audit event, persist — in one step, so a
   *  mutation can never be saved without the trail entry that explains it. */
  const commit = (
    patch: Partial<Pick<StrategicState, 'records' | 'reports'>>,
    ev: Omit<AuditEvent, 'id' | 'at'>,
  ) => {
    const s = get();
    const audit = [...s.audit, { ...ev, id: newId('aud'), at: new Date().toISOString() }].slice(-AUDIT_CAP);
    const next = { records: patch.records ?? s.records, reports: patch.reports ?? s.reports, audit };
    const ok = save({ version: SCHEMA_VERSION, ...next });
    set({ ...next, persisted: ok });
  };

  return {
    hydrated: false, persisted: true,
    records: [], reports: [], audit: [],

    hydrate() {
      if (get().hydrated) return;
      const { data, persisted } = load();
      /* Seed records are invented examples. Outside demonstration mode
         they are not shown anywhere — the library starts empty and holds
         what analysts enter. */
      const demo = useSettingsStore.getState().dataMode === 'demo';
      const records = demo ? data.records : data.records.filter((r) => !r.illustrative);
      set({ hydrated: true, persisted, records, reports: data.reports, audit: data.audit });
    },

    saveRecord(r, actor) {
      const errors = validateRecord(r);
      if (Object.keys(errors).length) return errors;
      const s = get();
      const exists = s.records.some((x) => x.id === r.id);
      const rec = { ...r, title: r.title.trim(), summary: r.summary.trim(), updatedAt: new Date().toISOString() };
      commit(
        { records: exists ? s.records.map((x) => (x.id === r.id ? rec : x)) : [rec, ...s.records] },
        { actor, action: exists ? 'record.update' : 'record.create', target: rec.id, label: rec.title,
          detail: `${rec.sources.length} source(s)` },
      );
      return null;
    },

    setRecordStatus(id, status, actor) {
      const s = get();
      const cur = s.records.find((x) => x.id === id);
      if (!cur) return { status: 'Dossier introuvable' };
      const rec = { ...cur, status, updatedAt: new Date().toISOString() };
      const errors = validateRecord(rec);
      if (errors.status) return { status: errors.status };
      commit(
        { records: s.records.map((x) => (x.id === id ? rec : x)) },
        { actor, action: status === 'archived' ? 'record.archive' : 'record.status', target: id, label: cur.title,
          detail: `${cur.status} → ${status}` },
      );
      return null;
    },

    createReport(title, body, recordIds, actor) {
      const id = newId('rpt');
      const at = new Date().toISOString();
      const report: Report = {
        id, title: title.trim() || 'Rapport sans titre', state: 'draft', recordIds,
        versions: [{ n: 1, body, at, author: actor, note: 'Version initiale' }],
      };
      commit({ reports: [report, ...get().reports] },
        { actor, action: 'report.create', target: id, label: report.title });
      return id;
    },

    /* Any edit is a new version, and any new version returns the report
       to draft: an approval covers the text that was read, not whatever
       is written afterwards. */
    addReportVersion(id, body, note, actor) {
      const s = get();
      const cur = s.reports.find((x) => x.id === id);
      if (!cur) return;
      const n = cur.versions.length + 1;
      const next: Report = {
        ...cur, state: 'draft', reviewer: undefined, reviewedAt: undefined, reviewNote: undefined,
        versions: [...cur.versions, { n, body, at: new Date().toISOString(), author: actor, note: note.trim() || `Révision ${n}` }],
      };
      commit({ reports: s.reports.map((x) => (x.id === id ? next : x)) },
        { actor, action: 'report.version', target: id, label: cur.title, detail: `v${n}` });
    },

    submitReport(id, actor) {
      const s = get();
      const cur = s.reports.find((x) => x.id === id);
      if (!cur || cur.state !== 'draft') return;
      commit({ reports: s.reports.map((x) => (x.id === id ? { ...x, state: 'in_review' as const } : x)) },
        { actor, action: 'report.submit', target: id, label: cur.title, detail: `v${cur.versions.length}` });
    },

    approveReport(id, actor, level, note) {
      const s = get();
      const cur = s.reports.find((x) => x.id === id);
      if (!cur) return 'Rapport introuvable';
      const gate = canApprove(cur, actor, level);
      if (!gate.ok) return gate.why!;
      const next: Report = { ...cur, state: 'approved', reviewer: actor, reviewedAt: new Date().toISOString(), reviewNote: note.trim() };
      commit({ reports: s.reports.map((x) => (x.id === id ? next : x)) },
        { actor, action: 'report.approve', target: id, label: cur.title, detail: `v${cur.versions.length}` });
      return null;
    },

    returnReport(id, actor, level, note) {
      const s = get();
      const cur = s.reports.find((x) => x.id === id);
      if (!cur) return 'Rapport introuvable';
      const gate = canApprove(cur, actor, level);
      if (!gate.ok) return gate.why!;
      if (!note.trim()) return 'Un motif est requis pour renvoyer un rapport.';
      const next: Report = { ...cur, state: 'draft', reviewer: actor, reviewedAt: new Date().toISOString(), reviewNote: note.trim() };
      commit({ reports: s.reports.map((x) => (x.id === id ? next : x)) },
        { actor, action: 'report.return', target: id, label: cur.title, detail: note.trim().slice(0, 120) });
      return null;
    },

    logExport(actor, target, label, detail) {
      commit({}, { actor, action: 'export', target, label, detail });
    },

    /* Restores the seed records and clears reports. The audit trail is
       kept and gains an entry: resetting is itself an auditable act. */
    resetWorkspace(actor) {
      commit({ records: SEED_RECORDS, reports: [] },
        { actor, action: 'workspace.reset', target: 'workspace', label: 'Espace de travail' });
    },
  };
});
