'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Intelligence feed
   ═══════════════════════════════════════════════════════════════════════

   A chronological stream of fused events. Windowed: only the rows on
   screen exist in the DOM, so a 1 500-event window scrolls as easily as
   a 20-event one. Row height is fixed in rem so the text-size setting
   scales rows and their contents together.
   ═══════════════════════════════════════════════════════════════════════ */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FusedEvent } from '@/lib/fusion/schema';
import { useT, eventTypeLabel } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import { categoryOf, originOf, provinceOf, firstPublished, lastUpdated, zulu, ago } from '@/lib/intel/derive';
import { StatusBadge, CategoryTag, OriginTag, ConfidenceMeter, CATEGORY_STYLE } from '@/components/ui/kit';

const ROW_REM = 5.5;
const OVERSCAN = 6;

const Row = memo(function Row({
  e, selected, onSelect, compact,
}: { e: FusedEvent; selected: boolean; onSelect: (id: string) => void; compact: boolean }) {
  const { t, lang } = useT();
  const cat = categoryOf(e);
  const place = e.location?.place_name;
  const province = provinceOf(e);
  return (
    <button
      type="button" onClick={() => onSelect(e.event_id)}
      aria-current={selected ? 'true' : undefined} data-testid="feed-row" data-id={e.event_id}
      className={`w-full h-full text-left px-4 py-2 border-b border-b3 flex gap-3 transition-colors ${
        selected ? 'bg-b2' : 'hover:bg-b2/50'
      }`}
    >
      <span className="w-0.5 self-stretch rounded shrink-0" style={{ background: CATEGORY_STYLE[cat].color, opacity: selected ? 1 : 0.55 }} aria-hidden="true" />
      <span className="min-w-0 flex-1 flex flex-col">
        <span className="flex items-center gap-x-2.5 whitespace-nowrap overflow-hidden">
          <CategoryTag category={cat} />
          <StatusBadge status={e.status} />
          <OriginTag origin={originOf(e)} />
          <span className="font-data text-3xs text-t3 tabular-nums ml-auto shrink-0" title={`${t('feed.reported')} ${zulu(e.timestamp)}`}>
            {ago(e.timestamp, lang)}
          </span>
        </span>
        <span className="text-t1 text-xs font-medium leading-snug mt-0.5 truncate">
          {eventTypeLabel(lang, e.event_type)}
          {place && <span className="text-t2 font-normal"> — {place}{province && province !== place ? `, ${province}` : ''}</span>}
        </span>
        <span className="text-t3 text-2xs leading-snug truncate">{e.description}</span>
        <span className="mt-auto flex items-center gap-x-3 text-3xs text-t3 whitespace-nowrap overflow-hidden">
          <ConfidenceMeter value={e.confidence} showLabel={false} />
          <span className="truncate">{e.source.handle ?? e.source.type} · {t('feed.sources', { n: e.provenance.length, f: e.independent_sources })}</span>
          {!compact && (
            <span className="font-data tabular-nums ml-auto hidden xl:inline">
              {t('feed.published')} {zulu(firstPublished(e)).slice(5, 16)} · {t('feed.updated')} {ago(lastUpdated(e), lang)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
});

export default function IntelFeed({
  events, selectedId, onSelect, compact = false,
}: { events: FusedEvent[]; selectedId: string | null; onSelect: (id: string) => void; compact?: boolean }) {
  const { t } = useT();
  const scale = useSettingsStore((s) => s.scale);
  const ref = useRef<HTMLDivElement>(null);
  const [rowPx, setRowPx] = useState(ROW_REM * 16);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useLayoutEffect(() => {
    setRowPx(ROW_REM * parseFloat(getComputedStyle(document.documentElement).fontSize || '16'));
  }, [scale]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / rowPx) - OVERSCAN);
  const last = Math.min(events.length, Math.ceil((scrollTop + height) / rowPx) + OVERSCAN);

  /* ↑/↓ and j/k move the selection and keep it in view. */
  const onKeyDown = useCallback((ev: React.KeyboardEvent) => {
    const dir = ev.key === 'ArrowDown' || ev.key === 'j' ? 1 : ev.key === 'ArrowUp' || ev.key === 'k' ? -1 : 0;
    if (!dir || !events.length) return;
    ev.preventDefault();
    const cur = events.findIndex((e) => e.event_id === selectedId);
    const next = Math.max(0, Math.min(events.length - 1, cur + dir));
    onSelect(events[next].event_id);
    const el = ref.current;
    if (el) {
      const top = next * rowPx;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + rowPx > el.scrollTop + el.clientHeight) el.scrollTop = top + rowPx - el.clientHeight;
    }
  }, [events, selectedId, onSelect, rowPx]);

  return (
    <div
      ref={ref} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} onKeyDown={onKeyDown}
      className="h-full overflow-y-auto" role="feed" aria-label={t('feed.list')} aria-busy="false"
      data-testid="intel-feed" data-total={events.length}
    >
      <div style={{ height: events.length * rowPx, position: 'relative' }}>
        {events.slice(first, last).map((e, i) => (
          <div
            key={e.event_id} role="article" aria-posinset={first + i + 1} aria-setsize={events.length}
            style={{ position: 'absolute', top: (first + i) * rowPx, left: 0, right: 0, height: rowPx }}
          >
            <Row e={e} selected={e.event_id === selectedId} onSelect={onSelect} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );
}
