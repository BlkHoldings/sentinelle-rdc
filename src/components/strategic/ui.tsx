'use client';

/* Shared pieces for the strategic workspaces. */

import { Component, type ReactNode } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useStrategicStore, type Level } from '@/store/useStrategicStore';
import {
  CONFIDENCE_LABEL, CONFIDENCE_COLOR, STATUS_LABEL, STATUS_COLOR,
  type Confidence, type VerificationStatus,
} from '@/lib/strategic/model';

export function useActor(): { actor: string; level: Level } {
  const session = useAuthStore((s) => s.session);
  return { actor: session?.user?.toUpperCase() ?? 'ANONYME', level: (session?.level ?? 'analyst') as Level };
}

/** Client-side file save. */
export function downloadText(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function Frame({
  kicker, title, hint, actions, children,
}: { kicker: string; title: string; hint: string; actions?: ReactNode; children: ReactNode }) {
  const persisted = useStrategicStore((s) => s.persisted);
  return (
    <div className="h-full flex flex-col bg-b0 min-h-0">
      <div className="shrink-0 px-3 md:px-4 py-2 border-b border-b3 bg-b1 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="mvn-label text-cyn">{kicker}</div>
          <h1 className="text-t1 text-sm font-mono font-bold tracking-wide">{title}</h1>
          <p className="text-t3 text-2xs font-mono leading-snug">{hint}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {!persisted && (
        <div className="shrink-0 px-3 md:px-4 py-1 bg-amb/10 border-b border-amb/40 text-amb text-2xs font-mono">
          ▸ Le navigateur refuse le stockage local : vos saisies seront perdues au rechargement de la page.
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

export function Btn({
  children, onClick, tone = 'default', disabled, title, type = 'button', testid,
}: {
  children: ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean; title?: string; type?: 'button' | 'submit'; testid?: string;
}) {
  const tones = {
    default: 'border-b3 text-t2 hover:text-t1 hover:border-t3',
    primary: 'border-cyn text-cyn bg-cyn/10 hover:bg-cyn/20',
    danger:  'border-alert/50 text-alert/80 hover:text-alert hover:border-alert',
  };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title} data-testid={testid}
      className={`px-2 py-1 border text-2xs font-mono font-bold tracking-wider transition-colors
                  disabled:opacity-35 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Tag({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return (
    <span title={title}
      className="inline-flex items-center gap-1 px-1 border text-3xs font-mono font-bold tracking-wider whitespace-nowrap"
      style={{ color, borderColor: `${color}66`, background: `${color}14` }}>
      {children}
    </span>
  );
}

/* Confidence and status are always two separate badges, with their own
   words: the model keeps them apart and the display must not merge them. */
export function ConfidenceTag({ value }: { value: Confidence }) {
  return <Tag color={CONFIDENCE_COLOR[value]} title="Jugement de l’analyste sur la solidité de la preuve">CONF. {CONFIDENCE_LABEL[value].toUpperCase()}</Tag>;
}

export function StatusTag({ value }: { value: VerificationStatus }) {
  return <Tag color={STATUS_COLOR[value]} title="État du processus de vérification">{STATUS_LABEL[value].toUpperCase()}</Tag>;
}

export function IllustrativeTag() {
  return <Tag color="#d09820" title="Contenu de démonstration, inventé — pas un constat">ILLUSTRATIF</Tag>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="m-4 border border-dashed border-b3 px-4 py-8 text-center">
      <div className="text-t2 text-xs font-mono font-bold">{title}</div>
      {children && <div className="text-t3 text-2xs font-mono mt-1 leading-relaxed max-w-md mx-auto">{children}</div>}
    </div>
  );
}

export const inputCls =
  'w-full bg-b0 border border-b3 focus:border-cyn px-2 py-1 text-t1 text-2xs font-mono placeholder:text-t3 focus:outline-none transition-colors';

export function Field({
  label, error, children, hint,
}: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mvn-label">{label}</span>
      {children}
      {error
        ? <span className="block text-alert text-3xs font-mono mt-0.5" role="alert">▸ {error}</span>
        : hint ? <span className="block text-t3 text-3xs font-mono mt-0.5">{hint}</span> : null}
    </label>
  );
}

/** A crash in one workspace must not take the console down with it. */
export class WorkspaceBoundary extends Component<{ children: ReactNode; name: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-6 bg-b0">
        <div className="panel max-w-md p-4 border-alert/50">
          <div className="text-alert text-xs font-mono font-bold">ERREUR — {this.props.name}</div>
          <p className="text-t2 text-2xs font-mono mt-1 leading-relaxed">
            Cet espace a rencontré une erreur et a été arrêté. Le reste de la console fonctionne ; vos données enregistrées ne sont pas touchées.
          </p>
          <pre className="text-t3 text-3xs font-mono mt-2 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
          <div className="mt-3"><Btn onClick={() => this.setState({ error: null })}>RÉESSAYER</Btn></div>
        </div>
      </div>
    );
  }
}
