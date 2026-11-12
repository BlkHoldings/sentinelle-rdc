'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Analytical views
   ═══════════════════════════════════════════════════════════════════════

   Regional analysis and the humanitarian picture. Every figure is
   computed from the fusion store or a live feed at render time; each
   card states its basis, and how much of it came from the simulated
   stream. Where a series is not connected — official displacement
   tracking, for one — the card says that instead of drawing a curve.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo } from 'react';
import { useFusionStore } from '@/store/useFusionStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useOpenDataStore } from '@/store/useOpenDataStore';
import type { FetchResult } from '@/lib/live/client';
import { SOURCE_PROFILES, posteriorFor } from '@/lib/fusion/reliability';
import type { EventStatus } from '@/lib/fusion/schema';
import { useT, eventTypeLabel, familyLabel, statusKey } from '@/lib/i18n';
import {
  filterFeed, dailySeries, weeklySeries, tallyBy, provinceOf, categoryOf, originOf, familyMix, ago,
} from '@/lib/intel/derive';
import { WorkspaceHeader, Card, EmptyState, Skeleton, STATUS_STYLE, CATEGORY_STYLE, StatusGlyph } from '@/components/ui/kit';
import { ChartCard, DataTable, TrendChart, BarList } from '@/components/ui/charts';
import IntelFeed from './IntelFeed';
import type { ViewKey } from '@/lib/views';

const RANGE_DAYS = { '24h': 7, '72h': 14, '7d': 14, '30d': 30, all: 60 } as const;

function useWindow() {
  const events = useFusionStore((s) => s.events);
  const seeded = useFusionStore((s) => s.seeded);
  const range = useFeedStore((s) => s.timeRange);
  const inWin = useMemo(
    () => filterFeed(events, { range }).filter((e) => categoryOf(e) !== 'sensor'),
    [events, range],
  );
  return { events, seeded, range, inWin };
}

export function RegionalPanel() {
  const { t, lang } = useT();
  const { events, seeded, range, inWin } = useWindow();
  const reliability = useFusionStore((s) => s.reliability);

  const days = RANGE_DAYS[range];
  const daily = useMemo(() => dailySeries(events, days), [events, days]);
  const weekly = useMemo(() => weeklySeries(dailySeries(events, 56)), [events]);
  const byProvince = useMemo(() => tallyBy(inWin, provinceOf), [inWin]);
  const byType = useMemo(() => tallyBy(inWin, (e) => e.event_type), [inWin]);
  const byStatus = useMemo(() => tallyBy(inWin, (e) => e.status), [inWin]);
  const mix = useMemo(() => familyMix(inWin), [inWin]);
  const simulated = useMemo(() => inWin.filter((e) => originOf(e) === 'simulated').length, [inWin]);

  /* Recomputed when events change: an adjudication both updates the
     posteriors and republishes the event list. */
  const rel = useMemo(() => {
    const state = reliability();
    return SOURCE_PROFILES.map((p) => ({ p, post: posteriorFor(state, p.type) }))
      .sort((a, b) => b.post.mean - a.post.mean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reliability, events]);

  const basis = t('an.basis', { n: inWin.length, s: simulated });
  const empty = inWin.length === 0;
  const series = [
    { key: 'conflict', label: t('cat.conflict'), color: CATEGORY_STYLE.conflict.color },
    { key: 'humanitarian', label: t('cat.humanitarian'), color: CATEGORY_STYLE.humanitarian.color },
    { key: 'political', label: t('cat.political'), color: CATEGORY_STYLE.political.color },
  ];

  return (
    <div className="h-full flex flex-col bg-b0 min-h-0">
      <WorkspaceHeader title={t('an.title')} hint={t('an.hint')} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!seeded ? <Skeleton rows={6} /> : (
          <div className="p-3 md:p-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3 max-w-[110rem]" data-testid="regional">
            <ChartCard
              className="lg:col-span-2" testid="chart-trend"
              title={t('an.trend')} empty={daily.every((d) => d.total === 0)} footer={basis}
              chart={<TrendChart data={daily} xKey="day" series={series} label={t('an.trend')} />}
              table={<DataTable
                head={[t('an.day'), ...series.map((s) => s.label), 'Total']}
                rows={[...daily].reverse().map((d) => [d.day, d.conflict, d.humanitarian, d.political, d.total])}
              />}
            />
            <ChartCard
              title={t('an.weekly')} empty={weekly.every((w) => w.total === 0)} testid="chart-weekly"
              chart={<BarList rows={weekly.map((w) => ({ key: w.label, label: `${t('an.week')} ${w.label}`, value: w.total, color: '#9aa3b0' }))} limit={8} />}
              table={<DataTable head={[t('an.week'), t('an.count')]} rows={weekly.map((w) => [w.label, w.total])} />}
            />
            <ChartCard
              title={t('an.province')} empty={empty || byProvince.length === 0} testid="chart-province"
              chart={<BarList rows={byProvince.map((p) => ({
                key: p.key, label: p.key, value: p.count,
                note: p.fatalities ? `${p.fatalities} ${t('detail.fatalities')}` : undefined,
              }))} />}
              table={<DataTable
                head={[t('detail.province'), t('an.count'), t('kpi.corroborated'), t('kpi.fatalities')]}
                rows={byProvince.map((p) => [p.key, p.count, p.confirmed, p.fatalities])}
              />}
            />
            <ChartCard
              title={t('an.type')} empty={empty} testid="chart-type"
              chart={<BarList rows={byType.map((x) => ({
                key: x.key, label: eventTypeLabel(lang, x.key as never), value: x.count, color: '#9d8cff',
              }))} />}
              table={<DataTable head={[t('detail.classification'), t('an.count')]}
                rows={byType.map((x) => [eventTypeLabel(lang, x.key as never), x.count])} />}
            />
            <ChartCard
              title={t('an.status')} empty={empty} testid="chart-status"
              chart={<BarList rows={byStatus.map((x) => {
                const st = STATUS_STYLE[x.key as EventStatus];
                return {
                  key: x.key, label: t(statusKey(x.key as EventStatus)), value: x.count, color: st.color, glyph: <StatusGlyph status={x.key as EventStatus} />,
                  note: `${Math.round((x.count / inWin.length) * 100)} %`,
                };
              })} />}
              table={<DataTable head={['', t('an.count'), t('an.share')]}
                rows={byStatus.map((x) => [t(statusKey(x.key as EventStatus)), x.count, `${Math.round((x.count / inWin.length) * 100)} %`])} />}
            />
            <ChartCard
              title={t('an.mix')} empty={mix.length === 0} testid="chart-mix"
              chart={<BarList rows={mix.map((m) => ({
                key: m.family, label: familyLabel(lang, m.family), value: m.reports, color: '#58c4dc',
                note: m.simulated ? `${m.simulated} ${t('origin.simulated').toLowerCase()}` : undefined,
              }))} />}
              table={<DataTable head={['', t('an.count'), t('origin.simulated')]}
                rows={mix.map((m) => [familyLabel(lang, m.family), m.reports, m.simulated])} />}
            />
            <ChartCard
              className="lg:col-span-2 2xl:col-span-1" testid="chart-reliability"
              title={t('an.reliability')} hint={t('an.reliability.hint')} empty={false}
              chart={<BarList max={100} unit=" %" limit={12} rows={rel.map(({ p, post }) => ({
                key: p.type, label: p.label, value: Math.round(post.mean * 100),
                color: post.mean >= 0.75 ? '#3fb984' : post.mean >= 0.5 ? '#e2a336' : '#e5484d',
                note: post.n >= 0.5 ? t('an.observations', { n: Math.round(post.n) }) : t('an.prior'),
              }))} />}
              table={<DataTable head={['', '%', '±', t('detail.grade')]}
                rows={rel.map(({ p, post }) => [p.label, Math.round(post.mean * 100), Math.round(post.sd * 100), p.baseGrade])} />}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Loading, failed, or the content — the three states every live card has. */
function Live<T>({ r, name, children }: { r: FetchResult<T>; name: string; children: (d: T) => React.ReactNode }) {
  const { t } = useT();
  if (r.data) return <>{children(r.data)}</>;
  if (r.health === 'loading' || r.health === 'idle') return <Skeleton rows={2} />;
  return <p className="text-2xs text-amb leading-relaxed" data-testid="src-down">{t('src.down', { name })} <span className="text-t3">{r.error}</span></p>;
}

export function HumanitarianPanel({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { t, lang } = useT();
  const { events, seeded, range, inWin } = useWindow();
  const select = useFusionStore((s) => s.select);
  const reliefweb = useLiveStore((s) => s.reliefweb);
  const gdacs = useLiveStore((s) => s.gdacs);
  const displacement = useOpenDataStore((s) => s.displacement);
  const who = useOpenDataStore((s) => s.who);
  const hydro = useOpenDataStore((s) => s.hydro);

  const hum = useMemo(() => inWin.filter((e) => categoryOf(e) === 'humanitarian'), [inWin]);
  const days = RANGE_DAYS[range];
  const daily = useMemo(() => dailySeries(events, days), [events, days]);
  const displaced = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inWin) {
      const d = e.casualties.displaced ?? 0;
      const p = provinceOf(e);
      if (d > 0 && p) m.set(p, (m.get(p) ?? 0) + d);
    }
    return [...m.entries()].map(([key, value]) => ({ key, label: key, value, color: '#58c4dc' })).sort((a, b) => b.value - a.value);
  }, [inWin]);

  const rwDown = reliefweb.health === 'error' || reliefweb.health === 'idle';

  return (
    <div className="h-full flex flex-col bg-b0 min-h-0">
      <WorkspaceHeader title={t('hum.title')} hint={t('hum.hint')} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!seeded ? <Skeleton rows={6} /> : (
          <div className="p-3 md:p-4 grid gap-3 lg:grid-cols-2 max-w-[90rem]" data-testid="humanitarian">
            {/* Official series first: they are the reference figures. */}
            <Card title={t('hum.official')} hint={t('hum.official.hint')} className="lg:col-span-2" testid="hum-official">
              <Live r={displacement} name="UNHCR">
                {(rows) => {
                  const data = rows.map((r) => ({
                    year: `${r.year}`, idps: r.idpsUnhcr ?? 0, idmc: r.idpsIdmc ?? 0,
                    abroad: r.refugeesAbroad ?? 0, hosted: r.refugeesHosted ?? 0,
                  }));
                  const last = rows[rows.length - 1];
                  const n = (v: number | null) => (v == null ? '—' : v.toLocaleString('fr-FR'));
                  return (
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          {([['hum.series.idps', last.idpsUnhcr], ['hum.series.idmc', last.idpsIdmc], ['hum.series.abroad', last.refugeesAbroad], ['hum.series.hosted', last.refugeesHosted]] as const).map(([k, v]) => (
                            <div key={k}>
                              <div className="text-3xs text-t3 leading-tight">{t(k)}</div>
                              <div className="font-data text-base text-t1 tabular-nums">{n(v)}</div>
                              <div className="font-data text-3xs text-t3">{last.year}</div>
                            </div>
                          ))}
                        </div>
                        <BarList
                          rows={rows.map((r) => ({ key: String(r.year), label: String(r.year), value: r.idpsUnhcr ?? r.idpsIdmc ?? 0, color: '#58c4dc', note: t('hum.series.idps') }))}
                          limit={12}
                        />
                      </div>
                      <div className="lg:w-[26rem]">
                        <DataTable
                          head={[t('year'), t('hum.series.idps'), t('hum.series.idmc'), t('hum.series.abroad'), t('hum.series.hosted')]}
                          rows={[...data].reverse().map((d) => [d.year, d.idps.toLocaleString('fr-FR'), d.idmc.toLocaleString('fr-FR'), d.abroad.toLocaleString('fr-FR'), d.hosted.toLocaleString('fr-FR')])}
                        />
                      </div>
                    </div>
                  );
                }}
              </Live>
            </Card>

            <Card title={t('hum.who')} testid="hum-who"
              hint={who.fetchedAt ? `${t('feed.updated')} ${ago(who.fetchedAt, lang)}` : undefined}>
              <Live r={who} name="OMS">
                {(items) => items.length === 0 ? <p className="text-2xs text-t3">{t('hum.who.none')}</p> : (
                  <ul className="divide-y divide-b3 max-h-72 overflow-y-auto -mx-3">
                    {items.map((w) => (
                      <li key={w.id} className="px-3 py-2">
                        <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs text-t1 hover:text-blu hover:underline leading-snug">{w.title}</a>
                        <div className="font-data text-3xs text-t3 mt-0.5">{w.published.slice(0, 10)} · {w.id}</div>
                        <p className="text-2xs text-t2 mt-1 leading-relaxed line-clamp-4">{w.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Live>
            </Card>

            <Card title={t('hum.rivers')} hint={t('hum.rivers.hint')} className="lg:col-span-2" testid="hum-rivers">
              <Live r={hydro} name="GloFAS">
                {(rows) => (
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                    {rows.map((r) => {
                      const pct = r.ratio == null ? null : Math.round((r.ratio - 1) * 100);
                      const rising = pct != null && pct > 15;
                      return (
                        <div key={r.name} className="flex items-end gap-2 border-b border-b3 pb-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-t1 truncate">{r.name} <span className="text-t3 text-2xs">· {r.river}</span></div>
                            <div className="font-data text-2xs text-t2 tabular-nums">{r.today == null ? '—' : `${Math.round(r.today).toLocaleString('fr-FR')} m³/s`}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-data text-2xs tabular-nums ${rising ? 'text-amb' : 'text-t2'}`}>
                              {pct == null ? '—' : `${pct >= 0 ? '▲ +' : '▼ '}${pct} %`} <span className="text-t3">{t('hum.rivers.vsWeek')}</span>
                            </div>
                            <div className="font-data text-3xs text-t3">{t('hum.rivers.peak')} {r.forecastPeakDate.slice(5) || '—'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Live>
            </Card>

            <ChartCard
              title={t('hum.trend')} empty={daily.every((d) => d.humanitarian === 0)} testid="hum-trend"
              chart={<TrendChart data={daily} xKey="day" label={t('hum.trend')}
                series={[{ key: 'humanitarian', label: t('cat.humanitarian'), color: CATEGORY_STYLE.humanitarian.color }]} />}
              table={<DataTable head={[t('an.day'), t('an.count')]} rows={[...daily].reverse().map((d) => [d.day, d.humanitarian])} />}
            />
            <ChartCard
              title={t('hum.displaced.province')} empty={displaced.length === 0} footer={t('hum.displacement.gap')} testid="hum-displaced"
              chart={<BarList rows={displaced} />}
              table={<DataTable head={[t('detail.province'), t('detail.displaced')]} rows={displaced.map((d) => [d.label, d.value])} />}
            />
            <Card title={`${t('hum.events')} (${hum.length})`} className="lg:row-span-2 flex flex-col" testid="hum-events">
              {hum.length === 0 ? <EmptyState title={t('feed.empty')}>{t('feed.empty.hint')}</EmptyState> : (
                <div className="h-[26rem] -mx-3 border-t border-b3">
                  <IntelFeed events={hum} selectedId={null} compact
                    onSelect={(id) => { select(id); onNavigate('live'); }} />
                </div>
              )}
            </Card>
            <Card title={t('hum.reliefweb')} testid="hum-reliefweb"
              hint={reliefweb.fetchedAt ? `${t('feed.updated')} ${ago(reliefweb.fetchedAt, lang)}` : undefined}>
              {reliefweb.health === 'loading' ? <Skeleton rows={2} />
                : rwDown ? <p className="text-2xs text-amb leading-relaxed" data-testid="rw-down">{reliefweb.error || t('hum.reliefweb.down')}</p>
                : !reliefweb.data?.length ? <p className="text-2xs text-t3">{t('hum.reliefweb.empty')}</p>
                : (
                  <ul className="divide-y divide-b3 max-h-64 overflow-y-auto -mx-3">
                    {reliefweb.data.slice(0, 20).map((r) => (
                      <li key={r.id} className="px-3 py-1.5">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-t1 hover:text-blu hover:underline leading-snug">{r.title}</a>
                        <div className="text-3xs text-t3 mt-0.5"><span className="font-data">{r.date.slice(0, 10)}</span> · {r.source}</div>
                      </li>
                    ))}
                  </ul>
                )}
            </Card>
            <Card title={t('hum.gdacs')} testid="hum-gdacs">
              {gdacs.health === 'loading' ? <Skeleton rows={1} />
                : gdacs.health !== 'ok' ? <p className="text-2xs text-amb">GDACS — {lang === 'fr' ? 'ne répond pas' : 'not responding'}</p>
                : !gdacs.data?.length ? <p className="text-2xs text-t3">{t('hum.gdacs.none')}</p>
                : (
                  <ul className="space-y-1">
                    {gdacs.data.slice(0, 8).map((a) => (
                      <li key={a.id} className="text-2xs">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-t1 hover:underline">{a.title}</a>
                        <span className="text-t3"> · {a.level}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
