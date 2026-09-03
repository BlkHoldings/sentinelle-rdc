'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Fusion Console
   ═══════════════════════════════════════════════════════════════════════

   Operator view of the pipeline itself: topic depths, throughput,
   consumer lag, dedup ratio, and a live tail of what is moving through.

   This exists because a fusion pipeline that cannot be observed cannot be
   trusted. When the map suddenly shows half as many incidents, the watch
   officer needs to know whether the theatre went quiet or the normaliser
   started dropping reports — and those two look identical from the map.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useFusionStore } from '@/store/useFusionStore';
import { getBus, TOPICS, type TopicName } from '@/lib/fusion/bus';
import { SOURCE_PROFILES, posteriorFor, gradeFor } from '@/lib/fusion/reliability';
import { ADMIRALTY_RELIABILITY, EVENT_TYPE_LABEL, type FusedEvent } from '@/lib/fusion/schema';

/* ── Topology graph ─────────────────────────────────────────────── */

const STAGES: { title: string; topics: TopicName[]; note: string }[] = [
  {
    title: 'COLLECTE',
    topics: [TOPICS.RAW_SOCIAL, TOPICS.RAW_NEWS, TOPICS.RAW_FIELD, TOPICS.RAW_SENSORS],
    note: 'Adaptateurs de source → rapports bruts',
  },
  {
    title: 'NORMALISATION',
    topics: [TOPICS.NORMALIZED],
    note: 'Extraction d\'entités · classification · géocodage · notation de source',
  },
  {
    title: 'FUSION',
    topics: [TOPICS.ENRICHED],
    note: 'Dédoublonnage · enrichissement géospatial · fusion bayésienne',
  },
  {
    title: 'DIFFUSION',
    topics: [TOPICS.ALERTS, TOPICS.TRIAGE, TOPICS.FEEDBACK],
    note: 'Alertes · file analyste · boucle de rétroaction',
  },
];

const TOPIC_LABEL: Record<string, string> = {
  [TOPICS.RAW_SOCIAL]: 'social_media',
  [TOPICS.RAW_NEWS]:   'news',
  [TOPICS.RAW_FIELD]:  'field_reports',
  [TOPICS.RAW_SENSORS]: 'sensors',
  [TOPICS.NORMALIZED]: 'normalized.events',
  [TOPICS.ENRICHED]:   'enriched.events',
  [TOPICS.ALERTS]:     'alerts',
  [TOPICS.TRIAGE]:     'triage.pending',
  [TOPICS.FEEDBACK]:   'adjudications',
};

function Stat({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="border border-b3 bg-b1 px-2.5 py-1.5">
      <div className="mvn-label">{label}</div>
      <div className={`text-base font-mono font-bold leading-tight ${accent ?? 'text-t1'}`}>{value}</div>
      {sub && <div className="text-t3 text-3xs font-mono">{sub}</div>}
    </div>
  );
}

export default function FusionConsole() {
  const stats = useFusionStore((s) => s.stats);
  const topics = useFusionStore((s) => s.topics);
  const running = useFusionStore((s) => s.running);
  const events = useFusionStore((s) => s.events);
  const feeds = useFusionStore((s) => s.feeds);
  const lastScanMs = useFusionStore((s) => s.lastScanMs);
  const start = useFusionStore((s) => s.start);
  const stop = useFusionStore((s) => s.stop);
  const pullFeeds = useFusionStore((s) => s.pullFeeds);
  const runScan = useFusionStore((s) => s.runScan);

  const [tail, setTail] = useState<{ topic: string; key: string; label: string; at: number }[]>([]);
  const [pulling, setPulling] = useState(false);

  /* Live tail off the enriched topic — cheap, and the most informative
     single stream to watch. */
  useEffect(() => {
    const id = setInterval(() => {
      const msgs = getBus().tail<FusedEvent>(TOPICS.ENRICHED, 14);
      setTail(
        msgs.reverse().map((m) => ({
          topic: 'enriched',
          key: m.key.slice(-8),
          label: `${EVENT_TYPE_LABEL[m.value.event_type]} — ${m.value.location?.place_name ?? '?'} (${(m.value.confidence * 100).toFixed(0)}%)`,
          at: m.timestamp,
        })),
      );
    }, 1500);
    return () => clearInterval(id);
  }, []);

  /* Ratio over the reports actually retained, not over everything ever
     ingested — those are different populations, and mixing them was how
     the console ended up claiming 60 events beside 1 087 single-source
     ones. */
  const dedupRatio = stats.reports > 0
    ? ((stats.duplicatesCollapsed / stats.reports) * 100).toFixed(0)
    : '0';

  const totalDepth = topics.reduce((s, t) => s + t.depth, 0);
  const totalRate = topics.reduce((s, t) => s + t.rate, 0);
  const maxLag = topics.reduce((s, t) => Math.max(s, t.maxLag), 0);

  const reliability = useFusionStore((s) => s.reliability)();

  const handlePull = async () => {
    setPulling(true);
    try { await pullFeeds(); } finally { setPulling(false); }
  };

  return (
    <div className="h-full overflow-y-auto min-h-0 p-3 space-y-3 bg-b0">

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 ${running ? 'bg-grn animate-pulse-slow' : 'bg-t3'}`} />
          <span className="text-t1 text-2xs font-mono font-bold tracking-widest">
            PIPELINE {running ? 'EN COURS' : 'ARRÊTÉ'}
          </span>
        </div>
        <button
          onClick={() => (running ? stop() : start())}
          className="border border-b3 text-t2 hover:text-t1 px-2 py-0.5 text-2xs font-mono transition-colors"
        >
          {running ? '❚❚ SUSPENDRE' : '▶ REPRENDRE'}
        </button>
        <button
          onClick={handlePull}
          disabled={pulling}
          className="border border-cyn/40 text-cyn hover:bg-cyn/15 px-2 py-0.5 text-2xs font-mono transition-colors disabled:opacity-50"
        >
          {pulling ? '⟳ COLLECTE…' : '⟳ TIRER LES FLUX RSS'}
        </button>
        <button
          onClick={runScan}
          className="border border-pur/40 text-pur hover:bg-pur/15 px-2 py-0.5 text-2xs font-mono transition-colors"
        >
          ◈ RELANCER LE BALAYAGE
        </button>
        {lastScanMs > 0 && (
          <span className="text-t3 text-3xs font-mono">balayage : {lastScanMs} ms</span>
        )}
      </div>

      {/* ── Headline stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-1.5">
        <Stat label="INGÉRÉS" value={stats.ingested} sub="rapports bruts" />
        <Stat label="NORMALISÉS" value={stats.normalized} sub="schéma unifié" />
        <Stat label="RAPPORTS RETENUS" value={stats.reports} sub="dans la fenêtre" />
        <Stat label="ÉVÉNEMENTS" value={stats.clusters} sub="après fusion" accent="text-cyn" />
        <Stat label="DOUBLONS" value={`${dedupRatio}%`} sub={`${stats.duplicatesCollapsed} absorbés`} accent="text-grn" />
        <Stat label="COMPARAISONS" value={stats.comparisons.toLocaleString('fr-FR')} sub="paires évaluées" />
        <Stat label="ALERTES" value={stats.alerts} sub="priorité ≥ 55" accent={stats.alerts ? 'text-alert' : undefined} />
        <Stat label="CYCLE FUSION" value={`${stats.lastFlushMs} ms`} sub={`débit ${totalRate.toFixed(1)}/s`} />
      </div>

      {/* ── Topology ── */}
      <div className="border border-b3 bg-b1 p-2.5">
        <div className="mvn-label mb-2">TOPOLOGIE DU FLUX</div>
        <div className="flex flex-col lg:flex-row gap-1.5 items-stretch">
          {STAGES.map((stage, si) => (
            <div key={stage.title} className="flex items-stretch gap-1.5 flex-1 min-w-0">
              <div className="flex-1 min-w-0 border border-b3 bg-b0 p-2">
                <div className="text-t1 text-2xs font-mono font-bold tracking-widest mb-0.5">
                  {stage.title}
                </div>
                <div className="text-t3 text-3xs font-mono leading-tight mb-1.5">{stage.note}</div>
                <div className="space-y-1">
                  {stage.topics.map((tn) => {
                    const t = topics.find((x) => x.name === tn);
                    const rate = t?.rate ?? 0;
                    const lag = t?.maxLag ?? 0;
                    return (
                      <div key={tn} className="font-mono">
                        <div className="flex items-baseline gap-1 text-3xs">
                          <span className="text-cyn truncate">{TOPIC_LABEL[tn]}</span>
                          <span className="text-t1 ml-auto shrink-0">{t?.totalProduced ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-[3px] bg-b3 relative">
                            <div
                              className={`absolute inset-y-0 left-0 ${lag > 20 ? 'bg-amb' : 'bg-blu'}`}
                              style={{ width: `${Math.min(100, ((t?.depth ?? 0) / 400) * 100)}%` }}
                            />
                          </div>
                          <span className="text-t3 text-3xs shrink-0 w-16 text-right">
                            {rate.toFixed(1)}/s
                            {lag > 0 && <span className="text-amb"> ▲{lag}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {si < STAGES.length - 1 && (
                <div className="hidden lg:flex items-center text-t3 text-sm shrink-0">▸</div>
              )}
            </div>
          ))}
        </div>
        <div className="text-t3 text-3xs font-mono mt-2 leading-tight">
          Journal append-only adressé par offset, groupes de consommateurs indépendants,
          décalage (lag) observable — même contrat qu&apos;un déploiement Kafka, exécuté
          dans l&apos;onglet. Profondeur totale : {totalDepth} messages · décalage max : {maxLag}.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ── Live tail ── */}
        <div className="border border-b3 bg-b1 p-2.5">
          <div className="mvn-label mb-1.5">FLUX ENRICHI — DERNIERS MESSAGES</div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {!tail.length && <div className="text-t3 text-2xs font-mono">En attente…</div>}
            {tail.map((m, i) => (
              <div key={`${m.key}-${i}`} className="flex items-baseline gap-2 text-3xs font-mono">
                <span className="text-t3 shrink-0">
                  {new Date(m.at).toISOString().slice(11, 19)}
                </span>
                <span className="text-cyn shrink-0">{m.key}</span>
                <span className="text-t2 truncate">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Source reliability posteriors ── */}
        <div className="border border-b3 bg-b1 p-2.5">
          <div className="mvn-label mb-1.5">FIABILITÉ DES SOURCES — LOI A POSTERIORI</div>
          <div className="text-t3 text-3xs font-mono mb-1.5 leading-tight">
            Bêta–Bernoulli, décroissance exponentielle sur 90 j. Mise à jour à chaque
            adjudication d&apos;analyste.
          </div>
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {SOURCE_PROFILES
              .map((p) => ({ p, post: posteriorFor(reliability, p.type) }))
              .sort((a, b) => b.post.mean - a.post.mean)
              .map(({ p, post }) => {
                const grade = gradeFor(post.mean);
                const drifted = grade !== p.baseGrade;
                return (
                  <div key={p.type} className="flex items-center gap-1.5 text-3xs font-mono">
                    <span className="text-t2 w-32 truncate shrink-0">{p.label}</span>
                    <span
                      className={`w-5 text-center shrink-0 ${drifted ? 'text-amb font-bold' : 'text-t3'}`}
                      title={ADMIRALTY_RELIABILITY[grade].label}
                    >
                      {grade}
                    </span>
                    <div className="flex-1 h-[4px] bg-b3 relative min-w-8">
                      <div
                        className="absolute inset-y-0 left-0 bg-cyn/70"
                        style={{ width: `${post.mean * 100}%` }}
                      />
                      {/* ±1σ band — how much the estimate is trusted */}
                      <div
                        className="absolute inset-y-0 bg-t1/25"
                        style={{
                          left: `${Math.max(0, (post.mean - post.sd) * 100)}%`,
                          width: `${Math.min(100, post.sd * 200)}%`,
                        }}
                      />
                    </div>
                    <span className="text-t1 w-8 text-right shrink-0">{(post.mean * 100).toFixed(0)}%</span>
                    <span className="text-t3 w-10 text-right shrink-0" title="observations pondérées">
                      n={post.n.toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── External feed health ── */}
      {feeds.length > 0 && (
        <div className="border border-b3 bg-b1 p-2.5">
          <div className="mvn-label mb-1">SANTÉ DES FLUX EXTERNES</div>
          {feeds.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-2xs font-mono">
              <div className={`w-1.5 h-1.5 ${f.ok ? 'bg-grn' : 'bg-alert'}`} />
              <span className="text-t2 w-28">{f.label}</span>
              <span className={f.ok ? 'text-grn' : 'text-alert'}>
                {f.ok ? `${f.reports.length} article(s) pertinent(s)` : (f.error ?? 'échec')}
              </span>
            </div>
          ))}
          <div className="text-t3 text-3xs font-mono mt-1 leading-tight">
            Les flux passent par un relais CORS public : l&apos;échec est fréquent et attendu,
            le reste de la chaîne continue sans eux.
          </div>
        </div>
      )}

      {/* ── Fusion effect ── */}
      <div className="border border-b3 bg-b1 p-2.5">
        <div className="mvn-label mb-1.5">EFFET DE LA FUSION</div>
        <div className="text-2xs font-mono text-t2 leading-relaxed">
          <span className="text-t1 font-bold">{stats.reports}</span> rapports retenus se sont
          résolus en <span className="text-cyn font-bold">{stats.clusters}</span> événements
          distincts — <span className="text-grn font-bold">{dedupRatio} %</span> du volume
          était de la redondance.{' '}
          <span className="text-t1">{events.filter((e) => e.independent_sources >= 3).length}</span>{' '}
          événements sont soutenus par au moins trois familles de sources indépendantes ;{' '}
          <span className="text-amb">{events.filter((e) => e.independent_sources === 1).length}</span>{' '}
          reposent encore sur une seule et ne devraient pas être exploités sans corroboration.
          {stats.ingested > stats.reports && (
            <> {stats.ingested - stats.reports} rapports plus anciens sont sortis de la
            fenêtre de rétention.</>
          )}
        </div>
      </div>
    </div>
  );
}
