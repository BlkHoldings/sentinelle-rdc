'use client';

import { useMemo } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useFeedStore } from '@/store/useFeedStore';
import { DRONE_ISR } from '@/data/drones';
import { toMGRSSync } from '@/lib/mgrs';
import { SECTIONS } from '@/components/hud/IntelAssessmentPanel';
import type { ViewKey } from '@/components/layout/Sidebar';
import type { IntelEvent } from '@/types/intel';

interface Props {
  activeView:     ViewKey;
  /** On phones the panel fills the content area when its tab is active */
  mobileVisible?: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  'Battles':                    'text-alert',
  'Explosions/Remote violence': 'text-mag',
  'Violence against civilians': 'text-amb',
  'Strategic developments':     'text-grn',
};

const DONUT_COLOR: Record<string, string> = {
  'Battles':                    '#e03030',
  'Explosions/Remote violence': '#c83048',
  'Violence against civilians': '#d09820',
  'Strategic developments':     '#20c880',
};

function priorityOf(e: IntelEvent): 'HIGH' | 'MED' | 'LOW' {
  if ((e.fatalities ?? 0) >= 10 || e.type === 'Battles') return 'HIGH';
  if ((e.fatalities ?? 0) >= 3  || e.type === 'Explosions/Remote violence') return 'MED';
  return 'LOW';
}

const PRIO_STYLE: Record<string, { label: string; color: string; border: string; bg: string }> = {
  HIGH: { label: 'HIGH PRIORITY', color: 'text-alert', border: 'border-alert/40', bg: 'bg-alert/10' },
  MED:  { label: 'MED PRIORITY',  color: 'text-amb',   border: 'border-amb/40',   bg: 'bg-amb/10'   },
  LOW:  { label: 'LOW PRIORITY',  color: 'text-grn',   border: 'border-grn/40',   bg: 'bg-grn/10'   },
};

function incidentId(e: IntelEvent): string {
  const n = (Math.abs(e.lat * 100 + e.lon * 10) | 0) % 99999;
  return `${e.src.toUpperCase().slice(0, 3)}-${n.toString().padStart(5, '0')}`;
}

/* ── Sparkline with filled area ── */
function SparkLine({ data, trend }: { data: number[]; trend: number }) {
  const W = 220;
  const H = 42;
  const mx = Math.max(...data, 1);

  const pts = data.map((v, i) => ({
    x: data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
    y: H - 4 - (v / mx) * (H - 8),
  }));

  const linePts   = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const fillPoly  = [`0,${H}`, ...pts.map((p) => `${p.x},${p.y}`), `${W},${H}`].join(' ');

  const trendPos  = trend >= 0;
  const trendStr  = `${trendPos ? '+' : ''}${trend}%`;

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* Fill area */}
        <polygon points={fillPoly} fill="rgba(224,48,48,0.12)" />
        {/* Glow line */}
        <polyline fill="none" stroke="rgba(224,48,48,0.3)" strokeWidth="5" points={linePts} strokeLinejoin="round" />
        {/* Main line */}
        <polyline fill="none" stroke="#e03030" strokeWidth="1.5" points={linePts} strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) =>
          data[i] > 0 ? <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#e03030" /> : null,
        )}
      </svg>
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex gap-1">
          {['J-6','J-4','J-2','AUJ'].map((l) => (
            <span key={l} className="text-t3 text-2xs font-mono">{l}</span>
          ))}
        </div>
        <span className={`text-2xs font-mono font-bold ${trendPos ? 'text-alert' : 'text-grn'}`}>
          {trendStr} vs J-7
        </span>
      </div>
    </div>
  );
}

/* ── Donut chart ── */
interface DonutSegment { label: string; pct: number; color: string; }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const r    = 27;
  const circ = 2 * Math.PI * r;
  let cumPct = 0;

  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 80 80" className="shrink-0">
        <g transform="rotate(-90 40 40)">
          {/* Base ring */}
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1a2e42" strokeWidth="11" />
          {/* Segments */}
          {segments.map((seg, i) => {
            const dash     = (seg.pct / 100) * circ;
            const startOff = (cumPct / 100) * circ;
            cumPct += seg.pct;
            return (
              <circle
                key={i}
                cx="40" cy="40" r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="11"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-startOff}
              />
            );
          })}
        </g>
        {/* Center label */}
        <text x="40" y="37" textAnchor="middle" fill="#c8d8e8" fontSize="12" fontFamily="monospace" fontWeight="700">
          {total}
        </text>
        <text x="40" y="48" textAnchor="middle" fill="#445870" fontSize="6.5" fontFamily="monospace">
          EVENTS
        </text>
      </svg>

      {/* Legend */}
      <div className="flex-1 space-y-1 min-w-0">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 shrink-0" style={{ background: seg.color }} />
            <span className="text-t3 text-2xs font-mono flex-1 truncate">{seg.label}</span>
            <span className="text-t1 text-2xs font-mono font-bold">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Entity network SVG ── */
function EntityNetwork() {
  const nodes = [
    { x: 75,  y: 55,  r: 9,  color: '#e03030', label: 'M23'     },
    { x: 160, y: 38,  r: 7,  color: '#c83048', label: 'RDF'     },
    { x: 225, y: 75,  r: 5,  color: '#c83048', label: 'ADF'     },
    { x: 45,  y: 108, r: 7,  color: '#1e70f0', label: 'FARDC'   },
    { x: 130, y: 120, r: 5,  color: '#1e70f0', label: 'WAZA'    },
    { x: 195, y: 140, r: 4,  color: '#20c880', label: 'MONUSCO' },
    { x: 255, y: 55,  r: 4,  color: '#d09820', label: 'CODECO'  },
    { x: 88,  y: 158, r: 3,  color: '#18c8e0', label: 'ISR'     },
  ];
  const edges = [[0,1],[0,2],[0,4],[1,0],[2,6],[3,4],[3,7],[4,5],[5,7],[6,2]];

  return (
    <svg width="100%" height="170" viewBox="0 0 280 170" className="bg-b0 border border-b3">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="#1a2e42" strokeWidth="1" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r + 5} fill={n.color} fillOpacity="0.10" />
          <circle cx={n.x} cy={n.y} r={n.r}     fill={n.color} fillOpacity="0.85" />
          <text x={n.x} y={n.y + n.r + 9} textAnchor="middle"
            fill="#445870" fontSize="6.5" fontFamily="monospace" fontWeight="700">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Main component ── */
export default function RightPanel({ activeView, mobileVisible = false }: Props) {
  const feat          = useMapStore((s) => s.selectedFeature);
  const selectFeature = useMapStore((s) => s.selectFeature);
  const events        = useFeedStore((s) => s.events);

  const acledEvents = useMemo(() => events.filter((e) => e.src === 'acled'), [events]);
  const totalKIA    = useMemo(() => events.reduce((a, e) => a + (e.fatalities ?? 0), 0), [events]);
  const strikes     = DRONE_ISR.filter((r) => r.classification === 'strike').length;

  /* Donut breakdown */
  const donutSegments = useMemo<DonutSegment[]>(() => {
    const counts: Record<string, number> = {};
    acledEvents.forEach((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
    const topTotal = sorted.reduce((s, [, c]) => s + c, 0);
    const otherPct = Math.max(0, 100 - Math.round((topTotal / total) * 100));
    const segs: DonutSegment[] = sorted.map(([type, count]) => ({
      label: type.replace(' against civilians', ' / Civ').replace('Explosions/', ''),
      pct:   Math.round((count / total) * 100),
      color: DONUT_COLOR[type] ?? '#445870',
    }));
    if (otherPct > 0) segs.push({ label: 'Autres', pct: otherPct, color: '#445870' });
    return segs;
  }, [acledEvents]);

  /* Sparkline data: last 7 days */
  const { sparkData, trend } = useMemo(() => {
    const buckets = Array(7).fill(0);
    const now = new Date();
    acledEvents.forEach((e) => {
      if (!e.date) return;
      const diff = Math.floor((now.getTime() - new Date(e.date).getTime()) / 86_400_000);
      if (diff >= 0 && diff < 7) buckets[6 - diff]++;
    });
    const recent = buckets.slice(4).reduce((a, b) => a + b, 0);
    const prior  = buckets.slice(0, 3).reduce((a, b) => a + b, 0) || 1;
    const trendVal = Math.round(((recent - prior) / prior) * 100);
    return { sparkData: buckets, trend: trendVal };
  }, [acledEvents]);

  const maxSpark = Math.max(...sparkData, 1);

  /* Selected feature */
  const mgrs = feat ? toMGRSSync(feat.lat, feat.lon) : '';
  const prio = feat ? priorityOf(feat) : 'LOW';
  const ps   = PRIO_STYLE[prio];

  return (
    <div
      className={`${mobileVisible ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[300px] shrink-0 bg-b1 md:border-l border-b3 overflow-y-auto`}
    >

      {/* ── INCIDENT / OVERVIEW ── */}
      {feat ? (
        <div className="shrink-0 border-b border-b3">
          <div className="panel-header px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="mvn-label text-t3 shrink-0">INCIDENT</span>
              <span className="text-t2 text-2xs font-mono font-bold truncate">{incidentId(feat)}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-2xs font-mono font-bold px-1.5 py-0.5 border ${ps.bg} ${ps.border} ${ps.color}`}>
                {ps.label}
              </span>
              <button onClick={() => selectFeature(null)} className="text-t3 hover:text-t1 text-sm ml-1 transition-colors">✕</button>
            </div>
          </div>

          <div className="px-3 py-3 space-y-2">
            <div className={`text-xs font-mono font-bold ${TYPE_COLOR[feat.type] ?? 'text-t1'}`}>
              {feat.type.toUpperCase()}
            </div>
            {mgrs && <div className="text-t3 text-2xs font-mono">GRID: {mgrs}</div>}
            <div className="text-t3 text-2xs font-mono">SOURCE: {feat.src.toUpperCase()}</div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
              {feat.actor1 && (
                <>
                  <div>
                    <div className="mvn-label mb-0.5">THREAT TYPE</div>
                    <div className="text-t2 text-2xs font-mono">{feat.type}</div>
                  </div>
                  <div>
                    <div className="mvn-label mb-0.5">AFFILIATION</div>
                    <div className="text-t2 text-2xs font-mono">{feat.actor1}</div>
                  </div>
                </>
              )}
              {feat.platform && (
                <div>
                  <div className="mvn-label mb-0.5">PLATEFORME</div>
                  <div className="text-cyn text-2xs font-mono">{feat.platform}</div>
                </div>
              )}
              {feat.status && (
                <div>
                  <div className="mvn-label mb-0.5">STATUT</div>
                  <div className="text-t2 text-2xs font-mono">{feat.status}</div>
                </div>
              )}
              <div>
                <div className="mvn-label mb-0.5">DATE</div>
                <div className="text-t2 text-2xs font-mono">{feat.date || feat.time || '—'}</div>
              </div>
              <div>
                <div className="mvn-label mb-0.5">LIEU</div>
                <div className="text-t2 text-2xs font-mono truncate">{feat.location ?? feat.admin1 ?? '—'}</div>
              </div>
              {(feat.fatalities ?? 0) > 0 && (
                <div>
                  <div className="mvn-label mb-0.5">PERTES</div>
                  <div className="text-alert text-xs font-mono font-bold">▲ {feat.fatalities} KIA</div>
                </div>
              )}
              {feat.actor2 && (
                <div>
                  <div className="mvn-label mb-0.5">CONTRE</div>
                  <div className="text-t2 text-2xs font-mono">{feat.actor2}</div>
                </div>
              )}
            </div>

            {(feat.desc ?? feat.notes) && (
              <div className="p-2 bg-b0 border border-b3 mt-1">
                <p className="text-t2 text-2xs font-mono leading-relaxed">{feat.desc ?? feat.notes}</p>
              </div>
            )}

            <button className="w-full py-1.5 border border-blu/40 text-blu text-2xs font-mono hover:bg-blu/10 hover:border-blu transition-colors">
              VIEW INCIDENT
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-b border-b3">
          <div className="panel-header px-3 py-2 flex items-center gap-2">
            <div className="w-1 h-1 bg-blu shrink-0" />
            <span className="mvn-label">SITUATION — AOR RDC</span>
          </div>
          <div className="grid grid-cols-3 border-b border-b3">
            {[
              { label: 'EVENTS',  val: acledEvents.length, color: 'text-alert' },
              { label: 'STRIKES', val: strikes,             color: 'text-mag'   },
              { label: 'KIA',     val: totalKIA,            color: 'text-alert' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex flex-col items-center py-2 gap-0.5 border-r border-b3 last:border-r-0">
                <span className={`font-mono font-bold text-base ${color}`}>{val}</span>
                <span className="mvn-label">{label}</span>
              </div>
            ))}
          </div>
          {activeView === 'intelligence' && (
            <div className="divide-y divide-b3 max-h-[28vh] overflow-y-auto">
              {SECTIONS.slice(0, 3).map(({ key, label, color, dot, text }) => (
                <div key={key} className="px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-1 h-1 shrink-0 ${dot}`} />
                    <span className={`mvn-label ${color}`}>{label}</span>
                  </div>
                  <p className="text-t2 text-2xs font-mono leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── THREAT OVERVIEW ── */}
      <div className="border-b border-b3 shrink-0">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between">
          <span className="mvn-label">THREAT OVERVIEW</span>
          <button className="text-t3 hover:text-t2 text-xs transition-colors">▾</button>
        </div>
        <div className="px-3 pb-1 pt-2">
          <div className="flex items-end justify-between mb-1">
            <span className="mvn-label">PAST 72H</span>
            <div className="flex items-baseline gap-1">
              <span className="text-alert font-mono font-bold text-lg">{acledEvents.length}</span>
              <span className="text-t3 text-2xs font-mono">TOTAL THREATS</span>
            </div>
          </div>
          <SparkLine data={sparkData} trend={trend} />
        </div>
      </div>

      {/* ── THREAT BREAKDOWN ── */}
      <div className="border-b border-b3 shrink-0">
        <div className="panel-header px-3 py-1.5">
          <span className="mvn-label">THREAT BREAKDOWN</span>
        </div>
        <div className="px-3 py-2">
          {donutSegments.length === 0 ? (
            <div className="text-t3 text-2xs font-mono">AUCUN ÉVÉNEMENT</div>
          ) : (
            <DonutChart segments={donutSegments} total={acledEvents.length} />
          )}
        </div>
      </div>

      {/* ── ENTITY NETWORK ── */}
      <div className="flex-1 min-h-0">
        <div className="panel-header px-3 py-1.5 flex items-center justify-between">
          <span className="mvn-label">ENTITY NETWORK</span>
          <div className="flex items-center gap-2">
            <span className="text-t3 text-2xs font-mono">LINK ANALYSIS</span>
            <button className="text-t3 hover:text-t2 text-xs transition-colors">⤢</button>
          </div>
        </div>
        <div className="px-3 py-2">
          <EntityNetwork />
        </div>
      </div>
    </div>
  );
}
