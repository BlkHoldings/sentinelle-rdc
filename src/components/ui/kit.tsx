'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Interface kit
   ═══════════════════════════════════════════════════════════════════════

   The shared pieces of the intelligence views. Two rules run through
   all of them:

   • Status is never colour alone. Every state has a distinct glyph and a
     written label; colour reinforces, it does not carry the meaning.
   • Anything computed says so. Confidence shows its number, and badges
     carry a tooltip stating what the value is and is not.
   ═══════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';
import type { EventStatus } from '@/lib/fusion/schema';
import type { Category, Origin } from '@/lib/intel/derive';
import { useT, statusKey, type MsgKey } from '@/lib/i18n';

/* Shape differs per status so the set stays readable in greyscale and
   for the common colour-vision deficiencies. Drawn as SVG: the unicode
   equivalents render at different sizes, or not at all, across fonts. */
export const STATUS_STYLE: Record<EventStatus, { color: string }> = {
  confirmed:    { color: '#3fb984' },
  corroborated: { color: '#6f9bff' },
  unverified:   { color: '#9aa3b0' },
  disputed:     { color: '#e2a336' },
  rejected:     { color: '#e5484d' },
  merged:       { color: '#7f8896' },
};

export const CATEGORY_STYLE: Record<Category, { color: string }> = {
  conflict:     { color: '#e5484d' },
  humanitarian: { color: '#58c4dc' },
  political:    { color: '#9d8cff' },
  sensor:       { color: '#7f8896' },
};

function Glyph({ children, color }: { children: ReactNode; color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0"
      fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function StatusGlyph({ status }: { status: EventStatus }) {
  const c = STATUS_STYLE[status].color;
  switch (status) {
    case 'confirmed':    return <Glyph color={c}><circle cx="5" cy="5" r="3.6" fill={c} /></Glyph>;
    case 'corroborated': return <Glyph color={c}><circle cx="5" cy="5" r="3.6" /><path d="M5 1.400a3.600 3.600 0 0 1 0 7.200z" fill={c} stroke="none" /></Glyph>;
    case 'unverified':   return <Glyph color={c}><circle cx="5" cy="5" r="3.600" /></Glyph>;
    case 'disputed':     return <Glyph color={c}><path d="M5 1L9 5 5 9 1 5z" fill={c} /></Glyph>;
    case 'rejected':     return <Glyph color={c}><path d="M2 2l6 6M8 2l-6 6" /></Glyph>;
    default:             return <Glyph color={c}><path d="M1.500 5h7M6 2.500L8.500 5 6 7.500" /></Glyph>;
  }
}

export function CategoryGlyph({ category }: { category: Category }) {
  const c = CATEGORY_STYLE[category].color;
  switch (category) {
    case 'conflict':     return <Glyph color={c}><path d="M5 1.500L9 8.500H1z" fill={c} /></Glyph>;
    case 'humanitarian': return <Glyph color={c}><path d="M5 1.500v7M1.500 5h7" strokeWidth={2.2} /></Glyph>;
    case 'political':    return <Glyph color={c}><rect x="1.800" y="1.800" width="6.400" height="6.400" fill={c} /></Glyph>;
    default:             return <Glyph color={c}><circle cx="5" cy="5" r="3.400" strokeDasharray="2 1.600" /></Glyph>;
  }
}

export function StatusBadge({ status, compact }: { status: EventStatus; compact?: boolean }) {
  const { t } = useT();
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-2xs font-medium whitespace-nowrap"
      style={{ color: s.color }}
      title={t(`status.help.${status}` as MsgKey)}
      data-status={status}
    >
      <StatusGlyph status={status} />
      {compact ? <span className="sr-only">{t(statusKey(status))}</span> : t(statusKey(status))}
    </span>
  );
}

export function CategoryTag({ category }: { category: Category }) {
  const { t } = useT();
  const s = CATEGORY_STYLE[category];
  return (
    <span className="inline-flex items-center gap-1 text-3xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: s.color }}>
      <CategoryGlyph category={category} />
      {t(`cat.${category}` as MsgKey)}
    </span>
  );
}

export function OriginTag({ origin }: { origin: Origin }) {
  const { t } = useT();
  if (origin === 'collected') return null;
  return (
    <span
      className="inline-flex items-center px-1 border border-amb/50 bg-amb/10 text-amb text-3xs font-semibold uppercase tracking-wider whitespace-nowrap"
      title={t('origin.help')}
      data-origin={origin}
    >
      {t(origin === 'simulated' ? 'origin.simulated' : 'origin.mixed')}
    </span>
  );
}

export function confidenceBand(p: number): 'high' | 'medium' | 'low' {
  return p >= 0.75 ? 'high' : p >= 0.45 ? 'medium' : 'low';
}

const BAND_COLOR = { high: '#3fb984', medium: '#e2a336', low: '#e5484d' };

/** Five-segment meter plus the figure and the band in words. */
export function ConfidenceMeter({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const { t } = useT();
  const band = confidenceBand(value);
  const pct = Math.round(value * 100);
  const filled = Math.max(1, Math.round(value * 5));
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      title={t('conf.help')}
      role="img"
      aria-label={`${t('conf.label')} ${pct} % — ${t(`conf.${band}` as MsgKey)}`}
    >
      <span className="inline-flex gap-px" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="w-1 h-2.5" style={{ background: i < filled ? BAND_COLOR[band] : '#242a34' }} />
        ))}
      </span>
      <span className="font-data text-2xs text-t1 tabular-nums" aria-hidden="true">{pct}%</span>
      {showLabel && <span className="text-3xs text-t3" aria-hidden="true">{t(`conf.${band}` as MsgKey)}</span>}
    </span>
  );
}

/* ── Layout primitives ───────────────────────────────────────────── */

export function WorkspaceHeader({
  title, hint, actions, children,
}: { title: string; hint?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="shrink-0 border-b border-b3 bg-b1">
      <div className="px-4 md:px-5 pt-3 pb-2.5 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-t1 text-base font-semibold tracking-tight leading-tight">{title}</h1>
          {hint && <p className="text-t3 text-xs mt-0.5 leading-snug">{hint}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Card({
  title, hint, actions, children, className = '', testid,
}: { title?: string; hint?: string; actions?: ReactNode; children: ReactNode; className?: string; testid?: string }) {
  return (
    <section className={`bg-b1 border border-b3 rounded ${className}`} data-testid={testid}>
      {(title || actions) && (
        <div className="flex items-start gap-2 px-3 pt-2.5 pb-1.5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-t1 text-xs font-semibold leading-tight">{title}</h2>}
            {hint && <p className="text-t3 text-2xs mt-0.5 leading-snug">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="px-3 pb-3">{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="text-t2 text-xs font-medium">{title}</div>
      {children && <div className="text-t3 text-2xs mt-1 leading-relaxed max-w-sm mx-auto">{children}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useT();
  return (
    <div className="p-4 space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-1.5" aria-hidden="true">
          <div className="skeleton h-3" style={{ width: `${68 - (i % 3) * 14}%` }} />
          <div className="skeleton h-2.5 w-full" />
          <div className="skeleton h-2.5" style={{ width: `${40 + (i % 2) * 22}%` }} />
        </div>
      ))}
    </div>
  );
}

export function SegButton({
  active, onClick, children, label,
}: { active: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active} aria-label={label}
      className={`px-2 py-1 text-2xs font-medium border transition-colors first:rounded-l last:rounded-r -ml-px first:ml-0 ${
        active ? 'bg-b3 border-t3 text-t1 z-10 relative' : 'border-b3 text-t3 hover:text-t1 hover:bg-b2'
      }`}
    >
      {children}
    </button>
  );
}

export const selectCls =
  'bg-b0 border border-b3 hover:border-t3 focus:border-blu rounded px-2 py-1 text-t1 text-2xs focus:outline-none transition-colors';

/** Label/value line used throughout the detail panel. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-2xs leading-snug py-0.5">
      <dt className="text-t3 w-28 shrink-0">{label}</dt>
      <dd className="text-t1 min-w-0 break-words">{children}</dd>
    </div>
  );
}
