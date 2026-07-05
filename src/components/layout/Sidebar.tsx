'use client';

import { useFeedStore } from '@/store/useFeedStore';
import { useApiStore } from '@/store/useApiStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useMapStore } from '@/store/useMapStore';
import { flyTo } from '@/lib/mapController';
import { DRONE_ISR } from '@/data/drones';
import { MIL_POSITIONS } from '@/data/military';
import { useRouter } from 'next/navigation';
import type { IntelEvent } from '@/types/intel';

export type ViewKey =
  | 'overview' | 'incidents' | 'intelligence' | 'entities'
  | 'effects'  | 'logistics' | 'planning'     | 'reports';

interface Props {
  activeView:   ViewKey;
  onViewChange: (v: ViewKey) => void;
  onRefresh?:   () => void;
}

const NAV: { key: ViewKey; label: string; sym: string }[] = [
  { key: 'overview',     label: 'OVERVIEW',     sym: '⊞' },
  { key: 'incidents',    label: 'INCIDENTS',    sym: '⚠' },
  { key: 'intelligence', label: 'INTELLIGENCE', sym: '◈' },
  { key: 'entities',     label: 'ENTITIES',     sym: '◉' },
  { key: 'effects',      label: 'EFFECTS',      sym: '✦' },
  { key: 'logistics',    label: 'LOGISTICS',    sym: '⊟' },
  { key: 'planning',     label: 'PLANNING',     sym: '⊕' },
  { key: 'reports',      label: 'REPORTS',      sym: '≡' },
];

function sevOf(e: IntelEvent): 'HIGH' | 'MED' | 'LOW' {
  if ((e.fatalities ?? 0) >= 10 || e.type === 'Battles') return 'HIGH';
  if ((e.fatalities ?? 0) >= 3  || e.type === 'Explosions/Remote violence') return 'MED';
  return 'LOW';
}

const SEV: Record<string, { border: string; text: string }> = {
  HIGH: { border: 'border-l-alert', text: 'text-alert' },
  MED:  { border: 'border-l-amb',   text: 'text-amb'   },
  LOW:  { border: 'border-l-grn',   text: 'text-grn'   },
};

function timeAgo(dateStr: string): string {
  const diff = new Date('2026-07-03').getTime() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return '1D AGO';
  return `${days}D AGO`;
}

export default function Sidebar({ activeView, onViewChange, onRefresh }: Props) {
  const router      = useRouter();
  const session     = useAuthStore((s) => s.session);
  const logout      = useAuthStore((s) => s.logout);
  const lastRefresh = useRefreshStore((s) => s.lastRefresh);
  const events      = useFeedStore((s) => s.events);
  const status      = useApiStore((s) => s.status);
  const selectFeature = useMapStore((s) => s.selectFeature);

  const handleAlertClick = (e: IntelEvent) => {
    selectFeature(e, [e.lon, e.lat]);
    flyTo({ longitude: e.lon, latitude: e.lat, zoom: 9 });
    onViewChange('incidents');
  };

  const acledN = events.filter((e) => e.src === 'acled').length;
  const firmsN = events.filter((e) => e.src === 'firms').length;

  const alerts = [...events]
    .filter((e) => e.src === 'acled' && e.date)
    .sort((a, b) => {
      const w = { HIGH: 3, MED: 2, LOW: 1 };
      return w[sevOf(b)] - w[sevOf(a)] || b.date.localeCompare(a.date);
    })
    .slice(0, 6);

  const SOURCES = [
    { label: 'ACLED EVENTS',  count: acledN,              total: acledN || '—',       ok: status.acled    === 'ok' },
    { label: 'FIRMS THERMAL', count: firmsN,              total: firmsN || '—',       ok: status.firms    === 'ok' },
    { label: 'DRONE ISR',     count: DRONE_ISR.length,    total: DRONE_ISR.length,    ok: status.drone    === 'ok' },
    { label: 'MIL POSITIONS', count: MIL_POSITIONS.length,total: MIL_POSITIONS.length,ok: true                    },
    { label: 'MONUSCO RPTS',  count: 7,                   total: 12,                  ok: true                    },
    { label: 'OSINT SOURCES', count: 143,                 total: 143,                 ok: true                    },
    { label: 'PARTNER NETS',  count: 6,                   total: 9,                   ok: true                    },
  ];

  const majTime = lastRefresh
    ? (() => {
        const d = new Date(lastRefresh);
        return `${d.getUTCHours().toString().padStart(2,'0')}${d.getUTCMinutes().toString().padStart(2,'0')}Z`;
      })()
    : null;

  const handleLogout = () => { logout(); router.replace('/'); };

  return (
    <div className="flex flex-col bg-b1 border-r border-b3 w-[182px] shrink-0 overflow-hidden">

      {/* Brand */}
      <div className="px-3 py-2.5 border-b border-b3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border border-alert flex items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 bg-alert" />
          </div>
          <div className="min-w-0">
            <div className="text-t1 font-mono font-bold text-xs tracking-widest leading-none">SENTINELLE</div>
            <div className="text-t3 text-2xs font-mono tracking-wider">RDC · C2 · GOTHAM</div>
          </div>
        </div>
      </div>

      {/* Operation */}
      <div className="px-3 py-2 border-b border-b3 shrink-0">
        <div className="mvn-label mb-0.5">OPÉRATION</div>
        <div className="text-t1 text-xs font-mono font-bold">SENTINELLE-RDC</div>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="w-1.5 h-1.5 bg-grn animate-pulse-slow" />
          <span className="text-grn text-2xs font-mono font-bold">ACTIVE</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="shrink-0 border-b border-b3">
        {NAV.map(({ key, label, sym }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={`
              w-full flex items-center gap-2.5 px-3 py-1.5 text-left
              text-2xs font-mono font-medium border-l-2 transition-colors
              ${activeView === key
                ? 'border-l-blu bg-blu/10 text-t1'
                : 'border-l-transparent text-t3 hover:text-t2 hover:bg-b2/60'}
            `}
          >
            <span className="shrink-0 w-3.5 text-center text-xs">{sym}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Latest Alerts */}
      <div className="border-b border-b3 shrink-0">
        <div className="px-3 py-1 flex items-center justify-between">
          <span className="mvn-label">ALERTS ({alerts.length})</span>
          <button
            onClick={() => onViewChange('incidents')}
            className="text-blu text-2xs font-mono hover:text-t1 transition-colors"
          >
            VIEW ALL
          </button>
        </div>
        {alerts.map((e, i) => {
          const sev = sevOf(e);
          const { border, text } = SEV[sev];
          return (
            <button
              key={i}
              onClick={() => handleAlertClick(e)}
              className={`w-full text-left border-l-2 ${border} pl-2 pr-2 py-1 border-b border-b3/40 last:border-b-0 hover:bg-b2/60 transition-colors`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className={`text-2xs font-mono font-bold ${text}`}>{sev}</span>
                <span className="text-t3 text-2xs font-mono shrink-0">{timeAgo(e.date)}</span>
              </div>
              <div className="text-t2 text-2xs font-mono leading-tight truncate">{e.location ?? e.type}</div>
            </button>
          );
        })}
      </div>

      {/* Connected Sources — scrollable */}
      <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
        <div className="px-3 py-1 shrink-0">
          <span className="mvn-label">CONNECTED SOURCES</span>
        </div>
        {SOURCES.map(({ label, count, total, ok }) => (
          <div key={label} className="flex items-center justify-between px-3 py-1 border-b border-b3/30">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`w-1 h-1 shrink-0 ${ok ? 'bg-grn' : 'bg-t3'}`} />
              <span className="text-t3 text-2xs font-mono truncate">{label}</span>
            </div>
            <span className={`text-2xs font-mono shrink-0 ${ok ? 'text-t2' : 'text-t3'}`}>
              {count} / {total}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: session + controls */}
      <div className="border-t border-b3 px-3 py-2 shrink-0 space-y-1">
        {session && (
          <div className="flex items-center justify-between">
            <span className="text-t3 text-2xs font-mono truncate">{session.user}</span>
            <span className="text-t3 text-2xs font-mono shrink-0">{session.clearance}</span>
          </div>
        )}
        {majTime && (
          <div className="text-t3 text-2xs font-mono">MAJ: {majTime}</div>
        )}
        <div className="flex items-center gap-1 mt-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex-1 py-1 border border-b3 text-t3 hover:border-t3 hover:text-t2 text-2xs font-mono transition-colors"
            >
              REFRESH
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex-1 py-1 border border-alert/30 text-alert/60 hover:border-alert hover:text-alert text-2xs font-mono transition-colors"
          >
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
}
