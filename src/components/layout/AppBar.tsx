'use client';

/* ═══════════════════════════════════════════════════════════════════════
   NKOYI — Application bar
   ═══════════════════════════════════════════════════════════════════════

   Global controls: search, period, synchronisation, notifications,
   language, profile. Each one reads or writes a store that the views
   already use, so the bar changes what is on screen rather than keeping
   a second copy of the state.

   The synchronisation indicator reports what the upstreams actually
   returned. With every feed down it says so, in amber, with a count of
   zero — it has no "live" state it can show on its own authority.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedStore, type TimeRange } from '@/store/useFeedStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useOpenDataStore } from '@/store/useOpenDataStore';
import { useFeedHealth } from '@/hooks/useFeedHealth';
import { useFusionStore } from '@/store/useFusionStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT, LANGS, type MsgKey } from '@/lib/i18n';
import { ago } from '@/lib/intel/derive';
import { needsTriage } from '@/lib/intel/triage';
import Icon, { type IconName } from '@/components/ui/Icon';
import { BrandMark } from './NavRail';
import type { ViewKey } from '@/lib/views';

const RANGES: TimeRange[] = ['24h', '72h', '7d', '30d', 'all'];

/** Button + panel that closes on outside click and Escape, and returns
 *  focus to its trigger. */
function Menu({
  label, icon, badge, children, align = 'right', testid, text,
}: {
  label: string; icon: IconName; badge?: ReactNode; children: (close: () => void) => ReactNode;
  align?: 'left' | 'right'; testid?: string; text?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        ref={btn} type="button" onClick={() => setOpen((v) => !v)}
        aria-label={label} aria-haspopup="true" aria-expanded={open} title={label} data-testid={testid}
        className={`relative h-8 min-w-8 px-2 flex items-center gap-1.5 rounded text-t2 hover:text-t1 hover:bg-b2 transition-colors ${open ? 'bg-b2 text-t1' : ''}`}
      >
        <Icon name={icon} />
        {text}
        {badge}
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 z-[120] w-72 max-w-[calc(100vw-1rem)] bg-b1 border border-b3 rounded shadow-float animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuTitle({ children }: { children: ReactNode }) {
  return <div className="px-3 py-2 border-b border-b3 text-t1 text-xs font-semibold">{children}</div>;
}

export default function AppBar({
  onNavigate, onOpenDrawer,
}: { onNavigate: (v: ViewKey) => void; onOpenDrawer: () => void }) {
  const { t, lang } = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const setLang = useSettingsStore((s) => s.setLang);

  const timeRange = useFeedStore((s) => s.timeRange);
  const setTimeRange = useFeedStore((s) => s.setTimeRange);
  const searchQuery = useFeedStore((s) => s.searchQuery);
  const setSearch = useFeedStore((s) => s.setSearch);
  const [q, setQ] = useState(searchQuery);
  useEffect(() => { setQ(searchQuery); }, [searchQuery]);

  /* ── Synchronisation ── */
  const busy = useLiveStore((s) => s.busy);
  const refreshAll = useLiveStore((s) => s.refreshAll);
  const refreshOpen = useOpenDataStore((s) => s.refreshAll);
  const lastRefresh = useRefreshStore((s) => s.lastRefresh);
  const refreshFn = useRefreshStore((s) => s.refreshFn);
  const { feeds: status, up, total } = useFeedHealth();
  const feeds = status.map((f) => ({ name: f.name, r: f.result }));

  /* ── Notifications: derived, never stored ── */
  const events = useFusionStore((s) => s.events);
  const clusters = useFusionStore((s) => s.clusters);
  const triage = events.filter(needsTriage).length;
  const significant = clusters.filter((c) => c.significant).length;
  const down = feeds.filter((f) => f.r.health === 'error' && !f.r.data);
  const notes: { key: string; text: string; view: ViewKey; tone: string; glyph: string }[] = [];
  if (significant) notes.push({
    key: 'c', view: 'anomalies', tone: 'text-alert', glyph: '▲',
    text: lang === 'fr' ? `${significant} cluster(s) spatio-temporel(s) significatif(s)` : `${significant} significant spatio-temporal cluster(s)`,
  });
  if (triage) notes.push({
    key: 't', view: 'triage', tone: 'text-amb', glyph: '◆',
    text: lang === 'fr' ? `${triage} événement(s) en attente de triage` : `${triage} event(s) awaiting triage`,
  });
  for (const f of down) notes.push({
    key: `d-${f.name}`, view: 'data', tone: 'text-t2', glyph: '○',
    text: lang === 'fr' ? `${f.name} ne répond pas` : `${f.name} is not responding`,
  });

  /* Clock ticks once a minute: seconds on a toolbar are motion without information. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const submit = () => setSearch(q.trim());

  return (
    <header className="h-12 shrink-0 bg-b1 border-b border-b3 flex items-center gap-1.5 px-2 md:px-3 z-header" data-testid="app-bar">
      <button
        type="button" onClick={onOpenDrawer} aria-label={t('nav.open')}
        className="md:hidden h-8 w-8 flex items-center justify-center rounded text-t2 hover:text-t1 hover:bg-b2"
      >
        <Icon name="menu" />
      </button>
      <div className="md:hidden flex items-center gap-2 mr-auto">
        <BrandMark size={20} />
        <span className="text-t1 text-sm font-semibold tracking-[0.18em]">NKOYI</span>
      </div>

      {/* Search */}
      <form
        role="search" className="hidden md:block relative flex-1 max-w-md"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)} onBlur={submit}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setSearch(''); } }}
          placeholder={t('bar.search')} aria-label={t('bar.search.label')} data-testid="global-search"
          className={`w-full h-8 bg-b0 border rounded pl-8 pr-9 text-xs text-t1 placeholder:text-t3 focus:outline-none transition-colors ${
            searchQuery ? 'border-blu' : 'border-b3 hover:border-t3 focus:border-blu'
          }`}
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-data text-3xs text-t3 border border-b3 rounded px-1" aria-hidden="true">/</kbd>
      </form>

      {/* Period */}
      <div className="hidden lg:flex items-center ml-1" role="group" aria-label={t('bar.period')} data-testid="period">
        {RANGES.map((r) => (
          <button
            key={r} type="button" onClick={() => setTimeRange(r)} aria-pressed={timeRange === r}
            className={`h-8 px-2 text-2xs font-medium border -ml-px first:ml-0 first:rounded-l last:rounded-r transition-colors ${
              timeRange === r ? 'bg-b3 border-t3 text-t1 relative z-10' : 'border-b3 text-t3 hover:text-t1 hover:bg-b2'
            }`}
          >
            {t(`range.${r}` as MsgKey)}
          </button>
        ))}
      </div>
      <select
        value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} aria-label={t('bar.period')}
        className="lg:hidden h-8 bg-b0 border border-b3 rounded px-1.5 text-2xs text-t1"
      >
        {RANGES.map((r) => <option key={r} value={r}>{t(`range.${r}` as MsgKey)}</option>)}
      </select>

      <div className="hidden md:block flex-1" />

      {now && (
        <div className="hidden xl:block font-data text-2xs text-t3 tabular-nums mr-1" title="UTC">
          {now.toISOString().slice(11, 16)}Z
        </div>
      )}

      {/* Synchronisation */}
      <Menu
        label={`${t('bar.sync')} — ${up ? t('bar.sync.feeds', { up, n: total }) : t('bar.sync.none')}`}
        icon="sync" testid="sync-menu"
        text={<span className={`hidden sm:inline font-data text-2xs tabular-nums ${up ? 'text-grn' : 'text-amb'}`}>{up}/{total}</span>}
        badge={<span className={`absolute top-1.5 left-5 w-1.5 h-1.5 rounded-full ${up ? 'bg-grn' : 'bg-amb'}`} aria-hidden="true" />}
      >
        {(close) => (
          <>
            <MenuTitle>{up ? t('bar.sync.feeds', { up, n: total }) : t('bar.sync.none')}</MenuTitle>
            <ul className="py-1">
              {feeds.map((f) => {
                const ok = f.r.health === 'ok' || f.r.health === 'degraded';
                const off = f.r.health === 'idle' && !!f.r.error;
                return (
                  <li key={f.name} className="px-3 py-1 flex items-center gap-2 text-2xs">
                    <span aria-hidden="true" className={ok ? 'text-grn' : f.r.health === 'loading' ? 'text-t3' : 'text-amb'}>{ok ? '●' : f.r.health === 'loading' ? '◌' : '○'}</span>
                    <span className="text-t1 flex-1">{f.name}</span>
                    <span className="text-t3 font-data">
                      {ok ? (f.r.fetchedAt ? ago(new Date(f.r.fetchedAt).toISOString(), lang) : 'ok') : f.r.health === 'loading' ? '…' : off ? (lang === 'fr' ? 'à configurer' : 'needs setup') : (lang === 'fr' ? 'hors ligne' : 'offline')}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 py-1.5 border-t border-b3 text-3xs text-t3">
              {t('bar.sync.last')} : {lastRefresh ? ago(new Date(lastRefresh).toISOString(), lang) : t('bar.sync.never')}
            </div>
            <div className="p-2 border-t border-b3 flex gap-1.5">
              <button type="button" disabled={busy}
                onClick={() => { refreshFn?.(); void refreshAll(); void refreshOpen(); }}
                className="flex-1 h-7 rounded border border-b3 text-2xs text-t1 hover:bg-b2 disabled:opacity-40">
                {t('bar.sync.refresh')}
              </button>
              <button type="button" onClick={() => { onNavigate('data'); close(); }}
                className="flex-1 h-7 rounded border border-b3 text-2xs text-t2 hover:text-t1 hover:bg-b2">
                {t('bar.sync.manage')}
              </button>
            </div>
          </>
        )}
      </Menu>

      {/* Notifications */}
      <Menu
        label={`${t('bar.notifications')} (${notes.length})`} icon="bell" testid="notif-menu"
        badge={notes.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full bg-amb text-b0 font-data text-3xs font-bold flex items-center justify-center" aria-hidden="true">
            {notes.length}
          </span>
        )}
      >
        {(close) => (
          <>
            <MenuTitle>{t('bar.notifications')}</MenuTitle>
            {notes.length === 0
              ? <div className="px-3 py-4 text-2xs text-t3">{t('bar.notifications.none')}</div>
              : (
                <ul className="py-1">
                  {notes.map((n) => (
                    <li key={n.key}>
                      <button type="button" onClick={() => { onNavigate(n.view); close(); }}
                        className="w-full text-left px-3 py-1.5 flex items-start gap-2 text-2xs text-t1 hover:bg-b2">
                        <span aria-hidden="true" className={`${n.tone} mt-px`}>{n.glyph}</span>
                        <span className="flex-1">{n.text}</span>
                        <Icon name="chevR" size={12} className="text-t3 mt-0.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </>
        )}
      </Menu>

      {/* Language */}
      <div className="hidden sm:flex items-center" role="group" aria-label={t('bar.language')} data-testid="lang-switch">
        {LANGS.map((l) => (
          <button key={l.code} type="button" onClick={() => setLang(l.code)} aria-pressed={lang === l.code}
            title={l.label} lang={l.code}
            className={`h-8 px-1.5 text-2xs font-semibold uppercase transition-colors ${
              lang === l.code ? 'text-t1' : 'text-t3 hover:text-t2'
            }`}>
            {l.code}
          </button>
        ))}
      </div>

      {/* Profile */}
      <Menu label={t('bar.profile')} icon="user" testid="profile-menu">
        {() => (
          <>
            <div className="px-3 py-2.5 border-b border-b3">
              <div className="text-t1 text-xs font-semibold">{session?.user}</div>
              <div className="text-t3 text-2xs mt-0.5">{t('bar.role')} : {session?.level}</div>
            </div>
            <div className="sm:hidden px-3 py-2 border-b border-b3 flex items-center gap-2">
              <span className="text-2xs text-t3 flex-1">{t('bar.language')}</span>
              {LANGS.map((l) => (
                <button key={l.code} type="button" onClick={() => setLang(l.code)} aria-pressed={lang === l.code}
                  className={`px-1.5 text-2xs font-semibold uppercase ${lang === l.code ? 'text-t1' : 'text-t3'}`}>{l.code}</button>
              ))}
            </div>
            <div className="p-2 space-y-1">
              <button type="button" onClick={() => onNavigate('settings')}
                className="w-full h-7 rounded text-left px-2 text-2xs text-t1 hover:bg-b2">{t('nav.settings')}</button>
              <button type="button" onClick={() => { logout(); router.replace('/'); }} data-testid="logout"
                className="w-full h-7 rounded text-left px-2 text-2xs text-alert hover:bg-alert/10">{t('bar.logout')}</button>
            </div>
          </>
        )}
      </Menu>
    </header>
  );
}
