'use client';

/* Primary navigation. Collapses to an icon rail on desktop; on phones it
   is rendered inside a drawer by the page. Every item is a real button
   with its label available to assistive technology in both states. */

import { NAV, type ViewKey } from '@/lib/views';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import Icon from '@/components/ui/Icon';

interface Props {
  activeView: ViewKey;
  onViewChange: (v: ViewKey) => void;
  badges?: Partial<Record<ViewKey, number>>;
  /** Drawer mode: always expanded, no collapse control. */
  drawer?: boolean;
}

export function BrandMark({ size = 22 }: { size?: number }) {
  /* A leopard's rosette, reduced to geometry: nkoyi is the leopard. */
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="23" height="23" rx="3" fill="#161a21" stroke="#2c3440" />
      <path d="M12 5.2a6.800 6.800 0 0 1 5.900 3.400" fill="none" stroke="#e2a336" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.600 12.800a6.800 6.800 0 0 1-4.400 5.600" fill="none" stroke="#e2a336" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.800 18.400a6.800 6.800 0 0 1-4.400-5.600" fill="none" stroke="#e2a336" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.100 8.600A6.800 6.800 0 0 1 9 5.900" fill="none" stroke="#e2a336" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.200" fill="#e6e9ee" />
    </svg>
  );
}

export default function NavRail({ activeView, onViewChange, badges = {}, drawer = false }: Props) {
  const { t } = useT();
  const collapsedPref = useSettingsStore((s) => s.navCollapsed);
  const toggleNav = useSettingsStore((s) => s.toggleNav);
  const collapsed = !drawer && collapsedPref;
  const demo = useSettingsStore((s) => s.dataMode) === 'demo';

  return (
    <nav
      aria-label={t('nav.main')}
      className={`flex flex-col bg-b1 border-r border-b3 shrink-0 h-full transition-[width] duration-150 ${
        collapsed ? 'w-[52px]' : 'w-[216px]'
      }`}
      data-testid="nav-rail" data-collapsed={collapsed ? '1' : '0'}
    >
      <div className={`flex items-center gap-2.5 h-12 shrink-0 border-b border-b3 ${collapsed ? 'justify-center' : 'px-3.5'}`}>
        <BrandMark />
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="text-t1 text-sm font-semibold tracking-[0.18em]">NKOYI</div>
            <div className="text-t3 text-3xs mt-1 truncate">{t('app.tagline')}</div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
        {NAV.map((group) => (
          <div key={group.id} className="mb-1">
            {group.label && (
              collapsed
                ? <div className="mx-3 my-1.5 border-t border-b3" role="separator" />
                : <div className="px-3.5 pt-2.5 pb-1 text-3xs font-semibold uppercase tracking-[0.09em] text-t3">{t(group.label)}</div>
            )}
            {!group.label && group.id === 'system' && <div className="mx-3 my-1.5 border-t border-b3" role="separator" />}
            <ul>
              {group.items.filter((item) => demo || !item.demoOnly).map((item) => {
                const active = activeView === item.key;
                const badge = badges[item.key] ?? 0;
                const label = t(item.label);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onViewChange(item.key)}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? label : undefined}
                      data-view={item.key}
                      className={`group relative w-full flex items-center gap-2.5 h-8 text-xs transition-colors ${
                        collapsed ? 'justify-center' : 'px-3.5'
                      } ${active ? 'text-t1 bg-b2' : 'text-t2 hover:text-t1 hover:bg-b2/60'}`}
                    >
                      {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-amb rounded-r" aria-hidden="true" />}
                      <Icon name={item.icon} className={active ? 'text-t1' : 'text-t3 group-hover:text-t2'} />
                      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate text-left flex-1">{label}</span>}
                      {badge > 0 && (
                        collapsed
                          ? <span className="absolute top-1.5 right-2.5 w-1.5 h-1.5 rounded-full bg-amb" aria-label={String(badge)} />
                          : <span className="font-data text-3xs text-amb tabular-nums" aria-label={`${badge}`}>{badge > 99 ? '99+' : badge}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!drawer && (
        <button
          type="button" onClick={toggleNav}
          aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')} aria-expanded={!collapsed}
          className={`h-9 shrink-0 border-t border-b3 flex items-center gap-2 text-t3 hover:text-t1 hover:bg-b2/60 text-2xs ${
            collapsed ? 'justify-center' : 'px-3.5'
          }`}
        >
          <Icon name={collapsed ? 'chevR' : 'chevL'} size={14} />
          {!collapsed && t('nav.collapse')}
        </button>
      )}
    </nav>
  );
}
