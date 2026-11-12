'use client';

/* Live intelligence workspace: filters, the feed, and the record of the
   selected event side by side. Selecting never navigates — the record
   opens in place, and on a phone it covers the feed with a way back. */

import { useMemo, useState } from 'react';
import { useFusionStore } from '@/store/useFusionStore';
import { useFeedStore } from '@/store/useFeedStore';
import type { EventStatus } from '@/lib/fusion/schema';
import { useT, statusKey, type MsgKey } from '@/lib/i18n';
import { filterFeed, activeEvents, provinceOf, type Category } from '@/lib/intel/derive';
import { WorkspaceHeader, EmptyState, Skeleton, SegButton, selectCls } from '@/components/ui/kit';
import IntelFeed from './IntelFeed';
import IntelDetail from './IntelDetail';
import type { ViewKey } from '@/lib/views';

const CATS: (Category | 'all')[] = ['all', 'conflict', 'humanitarian', 'political'];
const STATUSES: EventStatus[] = ['confirmed', 'corroborated', 'unverified', 'disputed'];

export default function LivePanel({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { t } = useT();
  const events = useFusionStore((s) => s.events);
  const seeded = useFusionStore((s) => s.seeded);
  const selectedId = useFusionStore((s) => s.selectedId);
  const select = useFusionStore((s) => s.select);
  const range = useFeedStore((s) => s.timeRange);
  const query = useFeedStore((s) => s.searchQuery);

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<EventStatus | 'all'>('all');
  const [province, setProvince] = useState('all');
  const [hideSimulated, setHideSimulated] = useState(false);

  const provinces = useMemo(
    () => [...new Set(activeEvents(events).map(provinceOf).filter(Boolean))].sort(),
    [events],
  );
  const shown = useMemo(
    () => filterFeed(events, { range, query, category, status, province, hideSimulated }),
    [events, range, query, category, status, province, hideSimulated],
  );
  const selected = events.find((e) => e.event_id === selectedId && e.status !== 'merged') ?? null;

  return (
    <div className="h-full flex flex-col bg-b0 min-h-0">
      <WorkspaceHeader title={t('feed.title')} hint={t('feed.hint')}>
        <div className="px-4 md:px-5 pb-2.5 flex flex-wrap items-center gap-2">
          <div className="flex" role="group" aria-label={t('cat.all')}>
            {CATS.map((c) => (
              <SegButton key={c} active={category === c} onClick={() => setCategory(c)}>
                {t(`cat.${c}` as MsgKey)}
              </SegButton>
            ))}
          </div>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as EventStatus | 'all')}
            aria-label={t('feed.status.all')} data-testid="feed-status">
            <option value="all">{t('feed.status.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(statusKey(s))}</option>)}
          </select>
          <select className={selectCls} value={province} onChange={(e) => setProvince(e.target.value)} aria-label={t('feed.province.all')}>
            <option value="all">{t('feed.province.all')}</option>
            {provinces.map((p) => <option key={p}>{p}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-2xs text-t2 cursor-pointer">
            <input type="checkbox" checked={hideSimulated} onChange={(e) => setHideSimulated(e.target.checked)}
              className="accent-[#6f9bff] w-3.5 h-3.5" data-testid="feed-hide-sim" />
            {t('feed.hideSim')}
          </label>
          <span className="ml-auto font-data text-2xs text-t3 tabular-nums" aria-live="polite" data-testid="feed-count">
            {t('feed.count', { n: shown.length.toLocaleString('fr-FR') })}
          </span>
        </div>
      </WorkspaceHeader>

      <div className="flex-1 min-h-0 flex relative">
        <div className={`min-w-0 flex-1 ${selected ? 'hidden lg:block' : ''}`}>
          {!seeded ? <Skeleton rows={6} />
            : shown.length === 0 ? <EmptyState title={t('feed.empty')}>{t('feed.empty.hint')}</EmptyState>
            : <IntelFeed events={shown} selectedId={selectedId} onSelect={select} compact={!!selected} />}
        </div>
        {selected ? (
          <div className="w-full lg:w-[30rem] xl:w-[34rem] shrink-0 lg:border-l border-b3 min-h-0">
            <IntelDetail event={selected} onClose={() => select(null)} onNavigate={onNavigate} />
          </div>
        ) : (
          <div className="hidden lg:flex w-[30rem] xl:w-[34rem] shrink-0 border-l border-b3 bg-b1 items-center justify-center">
            <p className="text-t3 text-xs">{t('feed.select')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
