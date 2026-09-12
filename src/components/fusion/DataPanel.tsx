'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Data Access Workspace
   ═══════════════════════════════════════════════════════════════════════

   One place to answer three questions that a map cannot:

     1. Which upstreams are actually alive, how fast, and how stale?
     2. What exactly did they return — the records, not a rendering?
     3. How do I get it out of here?

   The health table is the point. Every source states whether it needs a
   key, where its documentation is, and what its last call returned,
   including the failure text. An analyst who cannot tell a quiet theatre
   from a broken feed will eventually trust neither.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { useLiveStore } from '@/store/useLiveStore';
import { useFusionStore } from '@/store/useFusionStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useToastStore } from '@/store/useToastStore';
import { flyTo, getMapBounds } from '@/lib/mapController';
import { stalenessHours, type FetchResult, type SourceHealth } from '@/lib/live/client';
import { ISR_COLOR, MOBILITY_COLOR } from '@/lib/live/weather';
import { volcanicCandidates } from '@/lib/live/geophysical';
import { OSM_CATEGORY_COLOR, OSM_CATEGORY_LABEL } from '@/lib/live/osm';
import { EVENT_TYPE_LABEL } from '@/lib/fusion/schema';

const HEALTH_STYLE: Record<SourceHealth, { dot: string; text: string; label: string }> = {
  idle:     { dot: 'bg-t3',    text: 'text-t3',    label: 'INACTIF' },
  loading:  { dot: 'bg-cyn animate-pulse-fast', text: 'text-cyn', label: 'EN COURS' },
  ok:       { dot: 'bg-grn',   text: 'text-grn',   label: 'OK' },
  degraded: { dot: 'bg-amb',   text: 'text-amb',   label: 'DÉGRADÉ' },
  error:    { dot: 'bg-alert', text: 'text-alert', label: 'ÉCHEC' },
};

type Tab = 'sources' | 'weather' | 'seismic' | 'humanitarian' | 'osm' | 'events';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sources',      label: 'SOURCES' },
  { key: 'weather',      label: 'MÉTÉO' },
  { key: 'seismic',      label: 'SISMICITÉ' },
  { key: 'humanitarian', label: 'HUMANITAIRE' },
  { key: 'osm',          label: 'INFRASTRUCTURE' },
  { key: 'events',       label: 'ÉVÉNEMENTS FUSIONNÉS' },
];

/* ── Export helpers ─────────────────────────────────────────────── */

function download(name: string, body: string, mime: string) {
  const blob = new Blob([body], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(rows: readonly Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 accents correctly rather than as mojibake.
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function toGeoJSON(rows: readonly Record<string, unknown>[], latKey = 'lat', lonKey = 'lon') {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: rows
      .filter((r) => typeof r[latKey] === 'number' && typeof r[lonKey] === 'number')
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r[lonKey], r[latKey]] },
        properties: Object.fromEntries(Object.entries(r).filter(([k]) => k !== latKey && k !== lonKey)),
      })),
  }, null, 2);
}

/** Accepts any record-shaped array; the export helpers only ever read
 *  keys and values, so a concrete interface is as usable as an index
 *  signature here. */
function ExportBar<T extends object>({ rows, name, geo = true }: {
  rows: readonly T[]; name: string; geo?: boolean;
}) {
  const push = useToastStore((s) => s.push);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '');
  const plain = rows as readonly Record<string, unknown>[];
  const go = (ext: string, body: string, mime: string) => {
    if (!rows.length) { push('Rien à exporter', 'warn'); return; }
    download(`sentinelle-${name}-${stamp}.${ext}`, body, mime);
    push(`${rows.length} enregistrement(s) exporté(s) (.${ext})`, 'success');
  };
  return (
    <div className="flex items-center gap-1">
      <span className="text-3xs font-mono text-t3 mr-1">{rows.length} enr.</span>
      <button onClick={() => go('csv', toCSV(plain), 'text/csv')}
        className="border border-b3 text-t2 hover:text-t1 px-1.5 py-0.5 text-3xs font-mono transition-colors">
        ↓ CSV
      </button>
      <button onClick={() => go('json', JSON.stringify(rows, null, 2), 'application/json')}
        className="border border-b3 text-t2 hover:text-t1 px-1.5 py-0.5 text-3xs font-mono transition-colors">
        ↓ JSON
      </button>
      {geo && (
        <button onClick={() => go('geojson', toGeoJSON(plain), 'application/geo+json')}
          className="border border-cyn/40 text-cyn hover:bg-cyn/15 px-1.5 py-0.5 text-3xs font-mono transition-colors">
          ↓ GEOJSON
        </button>
      )}
    </div>
  );
}

/* ── Source health row ──────────────────────────────────────────── */

function SourceRow({ meta, result, onRefresh }: {
  meta: { id: string; label: string; purpose: string; provider: string; docs: string; cadence: string; requiresKey: boolean };
  result: FetchResult<unknown>;
  onRefresh?: () => void;
}) {
  const st = HEALTH_STYLE[result.health];
  const stale = stalenessHours(result);
  return (
    <div className="border border-b3 bg-b1 p-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className={`w-1.5 h-1.5 shrink-0 ${st.dot}`} />
        <span className="text-t1 text-2xs font-mono font-bold">{meta.label}</span>
        <span className={`text-3xs font-mono border px-1 ${st.text} border-current/40`}>{st.label}</span>
        {!meta.requiresKey && (
          <span className="text-3xs font-mono text-grn/70 border border-grn/30 px-1">SANS CLÉ</span>
        )}
        {onRefresh && (
          <button onClick={onRefresh}
            className="ml-auto border border-b3 text-t3 hover:text-t1 px-1.5 py-0.5 text-3xs font-mono transition-colors">
            ⟳
          </button>
        )}
      </div>

      <div className="text-t2 text-3xs font-mono leading-tight mt-1">{meta.purpose}</div>

      <div className="grid grid-cols-2 gap-x-3 mt-1 text-3xs font-mono">
        <span className="text-t3">Fournisseur</span>
        <span className="text-t2 truncate">{meta.provider}</span>
        <span className="text-t3">Cadence</span>
        <span className="text-t2">{meta.cadence}</span>
        {result.fetchedAt && (
          <>
            <span className="text-t3">Dernier appel</span>
            <span className="text-t2">
              {new Date(result.fetchedAt).toISOString().slice(11, 19)}Z · {result.latencyMs} ms
            </span>
            <span className="text-t3">Enregistrements</span>
            <span className={result.count ? 'text-t1' : 'text-amb'}>{result.count}</span>
          </>
        )}
        {stale != null && (
          <>
            <span className="text-t3">Fraîcheur</span>
            <span className={stale > 24 ? 'text-amb' : 'text-t2'}>
              donnée la plus récente il y a {stale < 1 ? `${Math.round(stale * 60)} min` : `${stale.toFixed(1)} h`}
            </span>
          </>
        )}
      </div>

      {result.error && (
        <div className="text-alert text-3xs font-mono mt-1 leading-tight break-words">
          {result.error}
        </div>
      )}
      <a href={meta.docs} target="_blank" rel="noopener noreferrer"
        className="text-3xs font-mono text-blu hover:text-cyn mt-1 inline-block transition-colors">
        documentation ↗
      </a>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */

export default function DataPanel() {
  const live = useLiveStore();
  const push = useToastStore((s) => s.push);
  const fusionEvents = useFusionStore((s) => s.events);
  const feedEvents = useFeedStore((s) => s.events);
  const [tab, setTab] = useState<Tab>('sources');

  const weather = live.weather.data ?? [];
  const seismic = live.seismic.data ?? [];
  const reports = live.reliefweb.data ?? [];
  const osm     = live.osm.data ?? [];
  const alerts  = live.gdacs.data ?? [];
  const volcanic = useMemo(() => volcanicCandidates(seismic), [seismic]);

  const eventRows = useMemo(() => fusionEvents.slice(0, 800).map((e) => ({
    event_id: e.event_id,
    timestamp: e.timestamp,
    type: EVENT_TYPE_LABEL[e.event_type],
    lat: e.location?.lat ?? null,
    lon: e.location?.lon ?? null,
    place: e.location?.place_name ?? '',
    radius_km: e.location?.radius_km ?? null,
    province: e.geo?.admin.province ?? '',
    territory: e.geo?.admin.territory ?? '',
    actors: e.actors.join(' / '),
    fatalities: e.casualties.fatalities ?? null,
    confidence: e.confidence,
    status: e.status,
    independent_sources: e.independent_sources,
    reports: e.provenance.length,
    priority: e.priority,
  })), [fusionEvents]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-b0">

      {/* Controls */}
      <div className="shrink-0 border-b border-b3 bg-b1 p-2 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-t1 text-2xs font-mono font-bold tracking-widest">ACCÈS AUX DONNÉES</span>
          <button
            onClick={() => { void live.refreshAll(); }}
            disabled={live.busy}
            className="border border-cyn/40 text-cyn hover:bg-cyn/15 px-2 py-0.5 text-2xs font-mono transition-colors disabled:opacity-50"
          >
            {live.busy ? '⟳ COLLECTE…' : '⟳ TOUT ACTUALISER'}
          </button>
          <button
            onClick={() => (live.autoRefresh ? live.stopAuto() : live.startAuto())}
            className={`border px-2 py-0.5 text-2xs font-mono transition-colors ${
              live.autoRefresh ? 'border-grn/50 text-grn bg-grn/10' : 'border-b3 text-t3 hover:text-t2'
            }`}
          >
            {live.autoRefresh ? '● AUTO ACTIF' : '○ AUTO INACTIF'}
          </button>
          <span className="text-3xs font-mono text-t3 ml-auto">
            toutes les sources sont publiques et sans clé
          </span>
        </div>

        <div className="flex flex-wrap gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-1.5 py-0.5 text-3xs font-mono border transition-colors ${
                tab === t.key ? 'border-blu text-t1 bg-blu/15' : 'border-b3 text-t3 hover:text-t2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2">

        {/* ── SOURCES ── */}
        {tab === 'sources' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              <SourceRow meta={live.meta[0]} result={live.weather}   onRefresh={() => void live.refreshWeather()} />
              <SourceRow meta={live.meta[1]} result={live.seismic}   onRefresh={() => void live.refreshSeismic()} />
              <SourceRow meta={live.meta[2]} result={live.reliefweb} onRefresh={() => void live.refreshReliefWeb()} />
              <SourceRow meta={live.meta[3]} result={live.gdacs}     onRefresh={() => void live.refreshGdacs()} />
              <SourceRow meta={live.meta[4]} result={live.osm} />
            </div>
            <div className="border border-b3 bg-b1 p-2.5 text-3xs font-mono text-t3 leading-relaxed">
              <span className="text-t2">Note de fiabilité.</span> Ces flux sont appelés
              directement depuis le navigateur : un échec peut venir du fournisseur, du
              réseau local, ou d&apos;une politique CORS côté fournisseur. Un flux en échec
              n&apos;interrompt pas les autres et ne vide jamais la carte silencieusement —
              l&apos;état est toujours affiché ici. Aucune de ces sources ne remplace une
              corroboration terrain.
            </div>
          </>
        )}

        {/* ── WEATHER ── */}
        {tab === 'weather' && (
          <>
            <div className="flex items-center gap-2">
              <span className="mvn-label">CONDITIONS PAR SITE</span>
              <div className="ml-auto"><ExportBar rows={weather} name="meteo" /></div>
            </div>
            {!weather.length && (
              <div className="text-t3 text-2xs font-mono">
                Aucune donnée — lancez une actualisation.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {weather.map((w) => (
                <button key={w.name}
                  onClick={() => flyTo({ longitude: w.lon, latitude: w.lat, zoom: 10 })}
                  className="border border-b3 bg-b1 p-2 text-left hover:border-t3 transition-colors">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-t1 text-2xs font-mono font-bold">{w.name}</span>
                    <span className="text-t3 text-3xs font-mono ml-auto">
                      {w.temperature_c != null ? `${w.temperature_c.toFixed(1)} °C` : '—'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1 text-3xs font-mono">
                    <span className={ISR_COLOR[w.isr]}>ISR {w.isr}</span>
                    <span className={MOBILITY_COLOR[w.mobility]}>AXES {w.mobility}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 mt-1 text-3xs font-mono">
                    <span className="text-t3">Plafond</span>
                    <span className="text-t2">{w.cloud_base_m != null ? `${Math.round(w.cloud_base_m)} m` : '—'}</span>
                    <span className="text-t3">Visibilité</span>
                    <span className="text-t2">{w.visibility_m != null ? `${(w.visibility_m / 1000).toFixed(1)} km` : '—'}</span>
                    <span className="text-t3">Pluie 24 h</span>
                    <span className="text-t2">{w.rain_24h_mm != null ? `${w.rain_24h_mm} mm` : '—'}</span>
                    <span className="text-t3">Pluie 72 h</span>
                    <span className="text-t2">{w.rain_72h_mm != null ? `${w.rain_72h_mm} mm` : '—'}</span>
                    <span className="text-t3">Vent</span>
                    <span className="text-t2">
                      {w.wind_kmh != null ? `${Math.round(w.wind_kmh)} km/h` : '—'}
                      {w.wind_gust_kmh != null && ` (raf. ${Math.round(w.wind_gust_kmh)})`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="text-3xs font-mono text-t3 leading-tight">
              ISR et praticabilité sont des évaluations dérivées de seuils explicites
              (plafond &lt; 600 m ou visibilité &lt; 3 km → défavorable ; pluie 24 h &gt; 40 mm
              ou 72 h &gt; 90 mm → impraticable), pas des sorties de modèle.
            </div>
          </>
        )}

        {/* ── SEISMIC ── */}
        {tab === 'seismic' && (
          <>
            <div className="flex items-center gap-2">
              <span className="mvn-label">SÉISMES — 30 DERNIERS JOURS</span>
              <div className="ml-auto"><ExportBar rows={seismic} name="sismicite" /></div>
            </div>
            {volcanic.length > 0 && (
              <div className="border border-amb/40 bg-amb/[0.06] p-2">
                <div className="text-amb text-2xs font-mono font-bold">
                  ◬ {volcanic.length} événement(s) compatible(s) avec une activité volcano-tectonique
                </div>
                <div className="text-t3 text-3xs font-mono leading-tight mt-0.5">
                  Moins de 60 km du Nyiragongo et moins de 25 km de profondeur. Indicatif :
                  la discrimination volcano-tectonique exige un réseau local (OVG), pas un
                  catalogue téléséismique.
                </div>
              </div>
            )}
            <div className="border border-b3 bg-b1 divide-y divide-b3/40">
              {!seismic.length && <div className="p-2 text-t3 text-2xs font-mono">Aucune donnée.</div>}
              {seismic.slice(0, 60).map((e) => (
                <button key={e.id}
                  onClick={() => flyTo({ longitude: e.lon, latitude: e.lat, zoom: 9 })}
                  className="w-full text-left p-1.5 hover:bg-b2/60 transition-colors">
                  <div className="flex items-baseline gap-2 text-2xs font-mono">
                    <span className={`font-bold ${e.magnitude >= 4.5 ? 'text-alert' : e.magnitude >= 3.5 ? 'text-amb' : 'text-t2'}`}>
                      M{e.magnitude.toFixed(1)}
                    </span>
                    <span className="text-t2 truncate flex-1">{e.place}</span>
                    <span className="text-t3 text-3xs shrink-0">
                      {e.depth_km.toFixed(0)} km prof. · {e.km_to_nyiragongo} km Nyiragongo
                    </span>
                    <span className="text-t3 text-3xs shrink-0">
                      {new Date(e.time).toISOString().slice(5, 16).replace('T', ' ')}Z
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── HUMANITARIAN ── */}
        {tab === 'humanitarian' && (
          <>
            <div className="flex items-center gap-2">
              <span className="mvn-label">RAPPORTS RELIEFWEB — RDC</span>
              <div className="ml-auto"><ExportBar rows={reports} name="reliefweb" geo={false} /></div>
            </div>
            <div className="text-3xs font-mono text-t3 leading-tight">
              Ces rapports alimentent aussi la chaîne de fusion comme source de famille
              « terrain », dont la décote de corrélation est la plus faible du modèle —
              une corroboration ReliefWeb pèse donc lourd sur la confiance.
            </div>
            {alerts.length > 0 && (
              <div className="border border-b3 bg-b1 p-2">
                <div className="mvn-label mb-1">ALERTES GDACS</div>
                {alerts.slice(0, 8).map((a) => (
                  <div key={a.id} className="text-3xs font-mono flex items-baseline gap-1.5">
                    <span className={
                      a.level === 'Red' ? 'text-alert' : a.level === 'Orange' ? 'text-amb' : 'text-grn'
                    }>{a.level || '—'}</span>
                    <span className="text-t3">{a.type}</span>
                    <span className="text-t2 truncate">{a.title}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-b3 bg-b1 divide-y divide-b3/40">
              {!reports.length && <div className="p-2 text-t3 text-2xs font-mono">Aucune donnée.</div>}
              {reports.slice(0, 40).map((r) => (
                <div key={r.id} className="p-2">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-cyn text-3xs font-mono">{r.source}</span>
                    <span className="text-t3 text-3xs font-mono">
                      {new Date(r.date).toISOString().slice(0, 10)}
                    </span>
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-3xs font-mono text-blu hover:text-cyn ml-auto transition-colors">
                      source ↗
                    </a>
                  </div>
                  <div className="text-t1 text-2xs font-mono font-bold leading-snug mt-0.5">{r.title}</div>
                  <div className="text-t2 text-3xs font-mono leading-snug mt-0.5">
                    {r.body.slice(0, 260)}{r.body.length > 260 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── OSM ── */}
        {tab === 'osm' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mvn-label">INFRASTRUCTURE OSM — VUE COURANTE</span>
              <button
                onClick={() => {
                  /* Query exactly what the operator is looking at. If the
                     map has not loaded there is no viewport to speak of,
                     and guessing one would return data about somewhere
                     else entirely — so say so instead. */
                  const b = getMapBounds();
                  if (!b) { push('Carte non chargée — ouvrez la vue CARTE d\'abord', 'warn'); return; }
                  void live.queryOsm(b);
                }}
                className="border border-cyn/40 text-cyn hover:bg-cyn/15 px-2 py-0.5 text-2xs font-mono transition-colors"
              >
                ⌖ INTERROGER LA VUE
              </button>
              <div className="ml-auto"><ExportBar rows={osm} name="osm" /></div>
            </div>
            <div className="text-3xs font-mono text-t3 leading-tight">
              Requête à la demande (quota d&apos;usage équitable Overpass). La couverture OSM
              est inégale dans l&apos;est de la RDC : dense à Goma et Bukavu, ténue en milieu
              rural. <span className="text-amb">L&apos;absence d&apos;un objet ici n&apos;est pas
              une preuve de son absence sur le terrain.</span>
            </div>
            {live.osm.error && (
              <div className="text-alert text-2xs font-mono">{live.osm.error}</div>
            )}
            <div className="border border-b3 bg-b1 divide-y divide-b3/40">
              {!osm.length && <div className="p-2 text-t3 text-2xs font-mono">Aucun résultat.</div>}
              {osm.slice(0, 200).map((f) => (
                <button key={f.id}
                  onClick={() => flyTo({ longitude: f.lon, latitude: f.lat, zoom: 16 })}
                  className="w-full text-left p-1.5 hover:bg-b2/60 transition-colors">
                  <div className="flex items-baseline gap-2 text-2xs font-mono">
                    <span className="w-1.5 h-1.5 shrink-0"
                      style={{ background: OSM_CATEGORY_COLOR[f.category] }} />
                    <span className="text-t1 truncate flex-1">{f.name}</span>
                    <span className="text-t3 text-3xs shrink-0">{OSM_CATEGORY_LABEL[f.category]}</span>
                    <span className="text-t3 text-3xs shrink-0">
                      {f.lat.toFixed(5)}, {f.lon.toFixed(5)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── FUSED EVENTS ── */}
        {tab === 'events' && (
          <>
            <div className="flex items-center gap-2">
              <span className="mvn-label">ÉVÉNEMENTS FUSIONNÉS — TABLE BRUTE</span>
              <div className="ml-auto"><ExportBar rows={eventRows} name="evenements" /></div>
            </div>
            <div className="text-3xs font-mono text-t3">
              {fusionEvents.length} événements fusionnés · {feedEvents.length} enregistrements
              de collecte bruts (ACLED / FIRMS / UAS)
            </div>
            <div className="overflow-x-auto border border-b3 bg-b1">
              <table className="w-full text-3xs font-mono">
                <thead className="bg-b2 text-t3">
                  <tr>
                    {['DTG', 'TYPE', 'LIEU', '±KM', 'ACTEURS', 'TUÉS', 'CONF', 'SRC', 'ÉTAT'].map((h) => (
                      <th key={h} className="text-left px-1.5 py-1 font-normal whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b3/40">
                  {eventRows.slice(0, 300).map((r) => (
                    <tr key={r.event_id} className="hover:bg-b2/50">
                      <td className="px-1.5 py-0.5 text-t3 whitespace-nowrap">
                        {r.timestamp.slice(5, 16).replace('T', ' ')}Z
                      </td>
                      <td className="px-1.5 py-0.5 text-t2 whitespace-nowrap">{r.type}</td>
                      <td className="px-1.5 py-0.5 text-t1 whitespace-nowrap">{r.place || '—'}</td>
                      <td className="px-1.5 py-0.5 text-t3">{r.radius_km?.toFixed(1) ?? '—'}</td>
                      <td className="px-1.5 py-0.5 text-t2 max-w-[180px] truncate">{r.actors || '—'}</td>
                      <td className="px-1.5 py-0.5 text-alert">{r.fatalities ?? '—'}</td>
                      <td className={`px-1.5 py-0.5 ${
                        r.confidence >= 0.8 ? 'text-grn' : r.confidence >= 0.6 ? 'text-cyn'
                          : r.confidence >= 0.4 ? 'text-amb' : 'text-alert'}`}>
                        {(r.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="px-1.5 py-0.5 text-t3">{r.independent_sources}/{r.reports}</td>
                      <td className="px-1.5 py-0.5 text-t3 whitespace-nowrap">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
