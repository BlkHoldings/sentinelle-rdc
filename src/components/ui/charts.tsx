'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Charts
   ═══════════════════════════════════════════════════════════════════════

   Two forms cover what the analytical views need: a time series and a
   ranked bar list. Both are plain SVG/HTML — the charts here are small
   and specific enough that a charting library would add weight without
   adding anything a reader can see.

   Every chart has a table behind it. The toggle in the card header swaps
   the drawing for the same numbers as rows, which is what a screen
   reader gets and what anyone who wants exact values should use.
   ═══════════════════════════════════════════════════════════════════════ */

import { useId, useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { Card, EmptyState } from './kit';

export interface SeriesDef { key: string; label: string; color: string }

/** Card wrapper that owns the chart/table toggle. */
export function ChartCard({
  title, hint, empty, chart, table, footer, className, testid,
}: {
  title: string; hint?: string; empty: boolean; chart: ReactNode; table: ReactNode;
  footer?: ReactNode; className?: string; testid?: string;
}) {
  const { t } = useT();
  const [asTable, setAsTable] = useState(false);
  return (
    <Card
      title={title} hint={hint} className={className} testid={testid}
      actions={!empty && (
        <button
          type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
          className="text-3xs text-t3 hover:text-t1 underline underline-offset-2 shrink-0"
        >
          {asTable ? t('an.chart') : t('an.table')}
        </button>
      )}
    >
      {empty ? <EmptyState title={t('an.empty')} /> : asTable ? table : chart}
      {footer && <div className="text-3xs text-t3 mt-2 leading-snug">{footer}</div>}
    </Card>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-56 overflow-auto">
      <table className="w-full text-2xs">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`sticky top-0 bg-b1 text-t3 font-medium py-1 border-b border-b3 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-b3/50">
              {r.map((c, j) => (
                <td key={j} className={`py-1 ${j ? 'text-right font-data tabular-nums text-t1' : 'text-t2'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Time series ─────────────────────────────────────────────────── */

const W = 600, H = 150, PAD = { l: 28, r: 8, t: 8, b: 18 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  for (const step of [1, 1.5, 2, 3, 4, 5, 7.5, 10]) if (n <= step) return step * p;
  return 10 * p;
}

/**
 * Stacked area by series, with a hover/focus readout.
 *
 * The y axis always starts at zero: these are counts, and a truncated
 * axis would turn a move from 40 to 44 into a cliff.
 */
export function TrendChart<T extends Record<string, string | number>>({
  data, xKey, series, label,
}: { data: T[]; xKey: keyof T & string; series: SeriesDef[]; label: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const totals = data.map((d) => series.reduce((a, s) => a + Number(d[s.key] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  /* Stack bottom-up so each band's upper edge is the running total. */
  const base = new Array(n).fill(0);
  const bands = series.map((s) => {
    const lower = [...base];
    const upper = data.map((d, i) => (base[i] += Number(d[s.key] ?? 0)));
    const top = upper.map((v, i) => `${x(i)},${y(v)}`).join(' L');
    const bottom = lower.map((v, i) => `${x(i)},${y(v)}`).reverse().join(' L');
    return { ...s, area: `M${top} L${bottom} Z`, line: `M${top}` };
  });

  const ticks = [0, max / 2, max];
  const step = Math.max(1, Math.ceil(n / 6));
  const h = hover != null ? data[hover] : null;

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-labelledby={id}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / iw) * (n - 1)))));
          }}
        >
          <title id={id}>{label}</title>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(tk)} y2={y(tk)} stroke="#242a34" strokeWidth={1} strokeDasharray={tk ? '2 4' : undefined} />
              <text x={PAD.l - 5} y={y(tk) + 3} textAnchor="end" fontSize={9} fill="#7f8896" className="font-data">{Math.round(tk)}</text>
            </g>
          ))}
          {bands.map((b) => (
            <g key={b.key}>
              <path d={b.area} fill={b.color} opacity={0.16} />
              <path d={b.line} fill="none" stroke={b.color} strokeWidth={1.5} strokeLinejoin="round" />
            </g>
          ))}
          {data.map((d, i) => ((i % step === 0 && n - 1 - i >= step / 2) || i === n - 1) && (
            <text key={i} x={x(i)} y={H - 4} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={9} fill="#7f8896" className="font-data">
              {String(d[xKey]).slice(5)}
            </text>
          ))}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#9aa3b0" strokeWidth={1} />
          )}
        </svg>
        {h && (
          <div
            className="absolute top-0 pointer-events-none bg-b2 border border-b3 rounded px-2 py-1 text-3xs shadow-float whitespace-nowrap"
            style={hover! > n / 2 ? { right: `${100 - (x(hover!) / W) * 100 + 1}%` } : { left: `${(x(hover!) / W) * 100 + 1}%` }}
          >
            <div className="font-data text-t1">{String(h[xKey])}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-t2">
                <span className="w-2 h-0.5" style={{ background: s.color }} />
                {s.label}
                <span className="font-data text-t1 ml-auto pl-3 tabular-nums">{Number(h[s.key] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-3xs text-t2">
              <span className="w-2.5 h-0.5" style={{ background: s.color }} aria-hidden="true" />{s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

/* ── Ranked bars ─────────────────────────────────────────────────── */

export interface BarRow { key: string; label: string; value: number; note?: string; color?: string; glyph?: ReactNode }

export function BarList({ rows, max, unit = '', limit = 10 }: { rows: BarRow[]; max?: number; unit?: string; limit?: number }) {
  const top = rows.slice(0, limit);
  const m = max ?? Math.max(1, ...top.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {top.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline gap-2 text-2xs">
            <span className="text-t1 truncate min-w-0 flex-1">
              {r.glyph && <span className="inline-block mr-1.5 align-[-1px]">{r.glyph}</span>}
              {r.label}
            </span>
            {r.note && <span className="text-t3 text-3xs shrink-0">{r.note}</span>}
            <span className="font-data text-t1 tabular-nums shrink-0">{r.value.toLocaleString('fr-FR')}{unit}</span>
          </div>
          <div className="h-1 bg-b3/70 mt-0.5 rounded-sm overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-sm" style={{ width: `${Math.max(1.5, (r.value / m) * 100)}%`, background: r.color ?? '#6f9bff' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Inline sparkline for KPI tiles. Decorative: the figure beside it is the data. */
export function Spark({ values, color = '#6f9bff' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${16 - (v / max) * 14}`).join(' ');
  return (
    <svg width={60} height={18} viewBox="0 0 60 18" aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
