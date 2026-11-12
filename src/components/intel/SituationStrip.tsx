'use client';

/* The line of indicators above the overview map: the state of the
   theatre for the selected period, each figure with its basis. A tile
   whose comparison has no baseline says so instead of showing 0 %. */

import { useMemo } from 'react';
import { useFusionStore } from '@/store/useFusionStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useT, type MsgKey } from '@/lib/i18n';
import { situation, dailySeries, ago } from '@/lib/intel/derive';
import { Spark } from '@/components/ui/charts';
import type { ViewKey } from '@/lib/views';

function Tile({
  label, value, sub, tone, onClick, children, testid,
}: {
  label: string; value: string; sub?: string; tone?: string; onClick?: () => void;
  children?: React.ReactNode; testid?: string;
}) {
  const body = (
    <>
      <div className="text-3xs text-t3 uppercase tracking-[0.07em] font-semibold truncate">{label}</div>
      <div className="flex items-end gap-2 mt-0.5">
        <span className={`font-data text-lg leading-none tabular-nums ${tone ?? 'text-t1'}`}>{value}</span>
        {children}
      </div>
      {sub && <div className="text-3xs text-t3 mt-1 truncate">{sub}</div>}
    </>
  );
  const cls = 'min-w-[8.5rem] flex-1 px-3 py-2 text-left border-r border-b3 last:border-r-0';
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:bg-b2/60 transition-colors`} data-testid={testid}>{body}</button>
    : <div className={cls} data-testid={testid}>{body}</div>;
}

export default function SituationStrip({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { t, lang } = useT();
  const events = useFusionStore((s) => s.events);
  const seeded = useFusionStore((s) => s.seeded);
  const clusters = useFusionStore((s) => s.clusters);
  const range = useFeedStore((s) => s.timeRange);
  const feeds = [
    useLiveStore((s) => s.weather.health), useLiveStore((s) => s.seismic.health),
    useLiveStore((s) => s.reliefweb.health), useLiveStore((s) => s.gdacs.health),
  ];
  const up = feeds.filter((h) => h === 'ok').length;

  const s = useMemo(() => situation(events, range), [events, range]);
  const spark = useMemo(() => dailySeries(events, 14).map((d) => d.total), [events]);
  const significant = clusters.filter((c) => c.significant).length;
  const nf = (n: number) => n.toLocaleString('fr-FR');
  const dash = '—';

  const change = s.changePct == null ? t('kpi.noBaseline')
    : `${s.changePct > 0 ? '▲ +' : s.changePct < 0 ? '▼ ' : '● '}${Math.round(s.changePct)} % ${t('kpi.vsPrev')}`;

  return (
    <section
      aria-label={`${t('nav.overview')} — ${t(`range.${range}` as MsgKey)}`}
      className="shrink-0 bg-b1 border-b border-b3 flex overflow-x-auto" data-testid="situation-strip"
    >
      <Tile label={`${t('kpi.incidents')} · ${t(`range.${range}` as MsgKey)}`} value={seeded ? nf(s.total) : dash}
        sub={seeded ? change : undefined} onClick={() => onNavigate('live')} testid="kpi-incidents">
        <Spark values={spark} color="#9aa3b0" />
      </Tile>
      <Tile label={t('kpi.corroborated')}
        value={s.corroboratedShare == null ? dash : `${Math.round(s.corroboratedShare * 100)} %`}
        sub={seeded && s.total ? t('kpi.simNote', { n: s.simulated, t: s.total }) : undefined}
        onClick={() => onNavigate('regional')} />
      <Tile label={t('kpi.fatalities')} value={seeded ? nf(s.fatalities) : dash} tone={s.fatalities ? 'text-alert' : undefined} />
      <Tile label={t('kpi.humanitarian')} value={seeded ? nf(s.humanitarian) : dash}
        sub={s.displaced ? `${nf(s.displaced)} ${t('detail.displaced')}` : undefined}
        onClick={() => onNavigate('humanitarian')} />
      <Tile label={t('kpi.alerts')} value={seeded ? String(significant) : dash}
        tone={significant ? 'text-amb' : undefined} onClick={() => onNavigate('anomalies')} />
      <Tile label={t('kpi.freshness')} value={s.freshest ? ago(s.freshest, lang) : dash}
        sub={`${t('kpi.feeds')} ${up}/${feeds.length}`} tone={up ? undefined : 'text-amb'}
        onClick={() => onNavigate('data')} testid="kpi-fresh" />
    </section>
  );
}
