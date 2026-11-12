'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useToastStore } from '@/store/useToastStore';
import { useMapStore } from '@/store/useMapStore';
import { useDrawStore, type DrawTool } from '@/store/useDrawStore';
import { useFusionStore } from '@/store/useFusionStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useStrategicStore } from '@/store/useStrategicStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useOpenDataStore } from '@/store/useOpenDataStore';
import { fetchFIRMS, fetchCopernicus, fetchACLED } from '@/lib/api';
import { ACLED_FALLBACK } from '@/data/acled-fallback';
import { DRONE_ISR } from '@/data/drones';
import { ALL_ITEMS, WORKSPACE_VIEWS, type ViewKey } from '@/lib/views';
import { LAYERS } from '@/lib/layers';
import { useT } from '@/lib/i18n';
import { filterFeed } from '@/lib/intel/derive';
import { preloadMGRS } from '@/lib/mgrs';
import GlobeMap from '@/components/globe/GlobeMap';
import CoordHUD from '@/components/hud/CoordHUD';
import NavRail from '@/components/layout/NavRail';
import AppBar from '@/components/layout/AppBar';
import FilterBar from '@/components/layout/FilterBar';
import RightPanel from '@/components/panels/RightPanel';
import BottomPanels from '@/components/panels/BottomPanels';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ToastContainer from '@/components/ui/Toast';
import MapLegend from '@/components/hud/MapLegend';
import BasemapControl from '@/components/hud/BasemapControl';
import HelpOverlay from '@/components/hud/HelpOverlay';
import SituationStrip from '@/components/intel/SituationStrip';
import IntelFeed from '@/components/intel/IntelFeed';
import IntelDetail from '@/components/intel/IntelDetail';
import { needsTriage } from '@/lib/intel/triage';
import { WorkspaceBoundary } from '@/components/strategic/ui';
import { Skeleton, EmptyState, SegButton } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import type { IntelEvent } from '@/types/intel';

/* Workspaces load on first visit. The map view is the landing surface
   and ships in the main bundle; a triage queue the operator may never
   open should not delay it. */
const Loading = () => <Skeleton rows={6} />;

const LivePanel         = dynamic(() => import('@/components/intel/LivePanel'), { ssr: false, loading: Loading });
const RegionalPanel     = dynamic(() => import('@/components/intel/AnalysisPanels').then((m) => m.RegionalPanel), { ssr: false, loading: Loading });
const HumanitarianPanel = dynamic(() => import('@/components/intel/AnalysisPanels').then((m) => m.HumanitarianPanel), { ssr: false, loading: Loading });
const SettingsPanel     = dynamic(() => import('@/components/intel/SettingsPanel'), { ssr: false, loading: Loading });
const TriageQueue       = dynamic(() => import('@/components/fusion/TriageQueue'), { ssr: false, loading: Loading });
const FusionConsole     = dynamic(() => import('@/components/fusion/FusionConsole'), { ssr: false, loading: Loading });
const AnomalyPanel      = dynamic(() => import('@/components/fusion/AnomalyPanel'), { ssr: false, loading: Loading });
const SitrepPanel       = dynamic(() => import('@/components/fusion/SitrepPanel'), { ssr: false, loading: Loading });
const DataPanel         = dynamic(() => import('@/components/fusion/DataPanel'), { ssr: false, loading: Loading });
const LibraryPanel      = dynamic(() => import('@/components/strategic/LibraryPanel'), { ssr: false, loading: Loading });
const EntitiesPanel     = dynamic(() => import('@/components/strategic/InsightPanels').then((m) => m.EntitiesPanel), { ssr: false, loading: Loading });
const SignalsPanel      = dynamic(() => import('@/components/strategic/InsightPanels').then((m) => m.SignalsPanel), { ssr: false, loading: Loading });
const WorkbenchPanel    = dynamic(() => import('@/components/strategic/WorkbenchPanel'), { ssr: false, loading: Loading });
const ReportsPanel      = dynamic(() => import('@/components/strategic/ReportsPanel'), { ssr: false, loading: Loading });
const AuditPanel        = dynamic(() => import('@/components/strategic/AuditPanel'), { ssr: false, loading: Loading });

type MobileTab = 'map' | 'feed' | 'intel' | 'activity' | 'comms';

const MOBILE_TABS: { key: MobileTab; fr: string; en: string; icon: 'map' | 'pulse' | 'layers' | 'list' | 'signal' }[] = [
  { key: 'map',      fr: 'Carte',     en: 'Map',       icon: 'map' },
  { key: 'feed',     fr: 'Flux',      en: 'Feed',      icon: 'pulse' },
  { key: 'intel',    fr: 'Situation', en: 'Situation', icon: 'layers' },
  { key: 'activity', fr: 'Activité',  en: 'Activity',  icon: 'list' },
  { key: 'comms',    fr: 'Comms',     en: 'Comms',     icon: 'signal' },
];

const DRAW_TOOLS: { key: DrawTool; sym: string; title: string }[] = [
  { key: 'select', sym: '↖', title: 'Sélectionner' },
  { key: 'rect',   sym: '▭', title: 'Rectangle — 2 clics' },
  { key: 'circle', sym: '○', title: 'Cercle — centre puis rayon' },
  { key: 'poly',   sym: '△', title: 'Polygone — clics, double-clic pour fermer' },
  { key: 'note',   sym: '✎', title: 'Annoter — clic sur la carte' },
];

function MapTools({ onHelp }: { onHelp: () => void }) {
  const { tool, setTool, shapes, notes, clearAll } = useDrawStore();
  const hasDrawings = shapes.length > 0 || notes.length > 0;
  const base = 'w-8 h-8 text-xs flex items-center justify-center transition-colors border-b border-b3 last:border-b-0';
  return (
    <div className="absolute top-3 left-3 z-hud hidden md:flex flex-col bg-b1/95 border border-b3 rounded overflow-hidden shadow-panel" role="toolbar" aria-label="Outils de carte">
      {DRAW_TOOLS.map(({ key, sym, title }) => (
        <button key={key} type="button" title={title} aria-label={title} aria-pressed={tool === key}
          onClick={() => setTool(key)}
          className={`${base} ${tool === key ? 'bg-b3 text-t1' : 'text-t3 hover:text-t1 hover:bg-b2'}`}>
          <span aria-hidden="true">{sym}</span>
        </button>
      ))}
      {hasDrawings && (
        <button type="button" title="Effacer les dessins" aria-label="Effacer les dessins" onClick={clearAll}
          className={`${base} text-alert/80 hover:text-alert hover:bg-alert/10`}>
          <span aria-hidden="true">✕</span>
        </button>
      )}
      <button type="button" onClick={onHelp} title="Raccourcis clavier (?)" aria-label="Raccourcis clavier"
        className={`${base} text-t3 hover:text-t1 hover:bg-b2`}>?</button>
    </div>
  );
}

/** Right-hand column of the overview: latest developments or situation. */
function OverviewSide({ activeView, mobileVisible }: { activeView: ViewKey; mobileVisible: boolean }) {
  const { t } = useT();
  const events = useFusionStore((s) => s.events);
  const seeded = useFusionStore((s) => s.seeded);
  const selectedId = useFusionStore((s) => s.selectedId);
  const select = useFusionStore((s) => s.select);
  const range = useFeedStore((s) => s.timeRange);
  const query = useFeedStore((s) => s.searchQuery);
  const [tab, setTab] = useState<'latest' | 'situation'>('latest');
  const latest = useMemo(() => filterFeed(events, { range, query }).slice(0, 200), [events, range, query]);
  const demo = useSettingsStore((s) => s.dataMode) === 'demo';

  /* The legacy side panel reads the illustrative datasets; outside
     demonstration mode every map view shows the live feed instead. */
  if (activeView !== 'overview' && demo) return <RightPanel activeView={activeView} mobileVisible={mobileVisible} />;

  return (
    <aside className={`${mobileVisible ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[340px] shrink-0 bg-b1 md:border-l border-b3 min-h-0`}
      aria-label={t('ov.sidePanel')} data-testid="overview-side">
      <div className="shrink-0 flex items-center px-3 py-2 border-b border-b3">
        <div className="flex" role="group">
          <SegButton active={tab === 'latest'} onClick={() => setTab('latest')}>{t('ov.latest')}</SegButton>
          {demo && <SegButton active={tab === 'situation'} onClick={() => setTab('situation')}>Situation</SegButton>}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        {tab === 'situation' && demo ? <RightPanel activeView={activeView} mobileVisible embedded /> : !seeded ? <div className="flex-1"><Skeleton rows={5} /></div>
          : latest.length === 0 ? <div className="flex-1"><EmptyState title={t(demo ? 'feed.empty' : 'feed.empty.real')}>{t(demo ? 'feed.empty.hint' : 'feed.empty.real.hint')}</EmptyState></div>
          : <div className="flex-1 min-w-0"><IntelFeed events={latest} selectedId={selectedId} onSelect={select} compact /></div>}
      </div>
    </aside>
  );
}

export default function MonitorPage() {
  const router     = useRouter();
  const { t, lang } = useT();
  const session    = useAuthStore((s) => s.session);
  const isExpired  = useAuthStore((s) => s.isExpired);
  const firmKey    = useAuthStore((s) => s.firmKey);
  const acledKey   = useAuthStore((s) => s.acledKey);
  const acledEmail = useAuthStore((s) => s.acledEmail);

  const setStatus = useApiStore((s) => s.setStatus);
  const setEvents = useFeedStore((s) => s.setEvents);
  const addEvents = useFeedStore((s) => s.addEvents);
  const push      = useToastStore((s) => s.push);
  const { auto, tick, reset, register } = useRefreshStore();
  const layers      = useMapStore((s) => s.layers);
  const setLayer    = useMapStore((s) => s.setLayer);
  const selectFeature = useMapStore((s) => s.selectFeature);
  const selectedFeature = useMapStore((s) => s.selectedFeature);

  const feedCount      = useFeedStore((s) => s.events.length);
  const seedFusion     = useFusionStore((s) => s.seed);
  const fusionSeeded   = useFusionStore((s) => s.seeded);
  const stopFusion     = useFusionStore((s) => s.stop);
  const fusionEvents   = useFusionStore((s) => s.events);
  const fusionClusters = useFusionStore((s) => s.clusters);
  const selectedId     = useFusionStore((s) => s.selectedId);
  const selectFusion   = useFusionStore((s) => s.select);

  const scale         = useSettingsStore((s) => s.scale);
  const sidePanelOpen = useSettingsStore((s) => s.sidePanelOpen);
  const toggleSide    = useSettingsStore((s) => s.toggleSidePanel);
  const demo          = useSettingsStore((s) => s.dataMode) === 'demo';

  const fetchedRef  = useRef(false);
  const seededRef   = useRef(false);
  const mainRef     = useRef<HTMLElement>(null);
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTab,  setMobileTab]  = useState<MobileTab>('map');
  const [helpOpen,   setHelpOpen]   = useState(false);

  /* Document language and text size follow the settings, so assistive
     technology pronounces the interface in the language it is shown in. */
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    if (scale === 'md') delete document.documentElement.dataset.scale;
    else document.documentElement.dataset.scale = scale;
  }, [scale]);

  useEffect(() => { useStrategicStore.getState().hydrate(); void preloadMGRS(); }, []);

  /* Layers drawn from illustrative datasets cannot be on outside
     demonstration mode, whatever the defaults or an earlier session set. */
  useEffect(() => {
    if (demo) return;
    for (const l of LAYERS) if (l.demoOnly) useMapStore.getState().setLayer(l.key, false);
  }, [demo]);

  /* On phones, surface the situation panel when a map marker is tapped */
  useEffect(() => {
    if (selectedFeature && window.innerWidth < 768) setMobileTab('intel');
  }, [selectedFeature]);

  /* Auth guard */
  useEffect(() => {
    if (!session || isExpired()) router.replace('/');
  }, [session, isExpired, router]);

  const doRefresh = useCallback(async () => {
    if (!session) return;
    reset();

    const droneEvents: IntelEvent[] = DRONE_ISR.map((r) => ({
      src: 'drone' as const,
      type: r.type, date: '', time: r.time,
      lat: r.lat, lon: r.lon,
      platform: r.platform, status: r.status,
      classification: r.classification, desc: r.desc, id: r.id,
    }));

    /* The bundled ACLED set and the airborne-sensor records are
       illustrative. They load in demonstration mode only; in real mode
       the feed store starts empty and holds what the APIs return. */
    setEvents(demo ? [...ACLED_FALLBACK, ...droneEvents] : []);
    setStatus('drone', demo ? 'ok' : 'idle');

    setStatus('acled', 'loading');
    const acledData = await fetchACLED(acledKey, acledEmail);
    if (acledData && acledData.length > 0) {
      addEvents(acledData);
      setStatus('acled', 'ok');
      push(`${acledData.length} événements ACLED chargés`, 'success');
    } else {
      setStatus('acled', acledKey ? 'error' : 'idle');
      if (acledKey) push(demo ? 'ACLED indisponible — données de secours actives' : 'ACLED indisponible', 'warn');
    }

    setStatus('firms', 'loading');
    const firmsData = await fetchFIRMS(firmKey);
    if (firmsData.length > 0) {
      addEvents(firmsData);
      setStatus('firms', 'ok');
      push(`${firmsData.length} anomalies thermiques FIRMS`, 'info');
    } else {
      setStatus('firms', firmKey ? 'error' : 'idle');
    }

    setStatus('copernicus', 'loading');
    const copData = await fetchCopernicus();
    if (copData.length > 0) {
      addEvents(copData);
      setStatus('copernicus', 'ok');
    } else {
      setStatus('copernicus', 'error');
    }
  }, [session, firmKey, acledKey, acledEmail, setEvents, addEvents, setStatus, reset, push, demo]);

  /* Initial fetch */
  useEffect(() => {
    if (session && !fetchedRef.current) {
      fetchedRef.current = true;
      doRefresh();
    }
  }, [session, doRefresh]);

  /* Seed the fusion pipeline once, after the first collection pass.
     Guarded by a ref as well as the store flag: the effect can fire
     twice under React strict mode. */
  useEffect(() => {
    /* Demonstration waits for the bundled datasets so they are fused
       with the simulated history. Real mode has nothing to wait for. */
    if (!session || fusionSeeded || seededRef.current || (demo && !feedCount)) return;
    seededRef.current = true;
    seedFusion(useFeedStore.getState().events, session.user.toUpperCase(), demo);
    void useLiveStore.getState().refreshAll();
    useLiveStore.getState().startAuto();
    void useOpenDataStore.getState().refreshAll();
    useOpenDataStore.getState().startAuto();
  }, [session, fusionSeeded, seedFusion, feedCount, demo]);

  useEffect(() => () => {
    stopFusion();
    useLiveStore.getState().stopAuto();
    useOpenDataStore.getState().stopAuto();
  }, [stopFusion]);

  /* Auto-refresh timer */
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => { if (tick()) doRefresh(); }, 1000);
    return () => clearInterval(id);
  }, [auto, tick, doRefresh]);

  useEffect(() => { register(doRefresh); }, [register, doRefresh]);

  /* Changing view turns on the layers that view is about. It only ever
     adds: a layer the operator switched on stays on. */
  const handleViewChange = useCallback((view: ViewKey, keepSelection = false) => {
    setActiveView(view);
    setDrawerOpen(false);
    /* Arriving on a map view should not reopen whatever record was last
       browsed in a workspace — unless the operator asked to see that
       record on the map. */
    if (!keepSelection && !WORKSPACE_VIEWS.includes(view)) selectFusion(null);
    const need: Partial<Record<ViewKey, (keyof typeof layers)[]>> = {
      incidents: ['acled', 'fusion'], entities: ['mil'], effects: ['acled'],
      logistics: ['routes', 'air'], planning: ['zone'],
    };
    for (const k of need[view] ?? []) if (!layers[k]) setLayer(k, true);
    // Move focus to the new content so keyboard and screen-reader users
    // land in it rather than back at the top of the navigation.
    requestAnimationFrame(() => mainRef.current?.focus());
  }, [layers, setLayer, selectFusion]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

      if (e.key === 'Escape') {
        setHelpOpen(false); selectFeature(null); setDrawerOpen(false);
        useMapStore.getState().setMapFeature(null);
        if (!typing) selectFusion(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') { e.preventDefault();
        (document.querySelector('[data-testid="global-search"]') as HTMLInputElement | null)?.focus();
      } else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); doRefresh();
      } else if (e.key === '?') { setHelpOpen((v) => !v);
      } else if (e.key >= '1' && e.key <= '9') {
        const item = ALL_ITEMS[Number(e.key) - 1];
        if (item) handleViewChange(item.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doRefresh, handleViewChange, selectFeature, selectFusion]);

  const isWorkspace = WORKSPACE_VIEWS.includes(activeView);
  const mapOnly = activeView === 'map';

  const triageCount = useMemo(() => fusionEvents.filter(needsTriage).length, [fusionEvents]);
  const significant = fusionClusters.filter((c) => c.significant).length;
  const badges = { triage: triageCount, anomalies: significant };
  const selected = !isWorkspace ? fusionEvents.find((e) => e.event_id === selectedId && e.status !== 'merged') ?? null : null;
  const drawnCount = useMemo(
    () => Math.min(500, fusionEvents.filter((e) => e.location && e.status !== 'rejected' && e.status !== 'merged').length),
    [fusionEvents],
  );

  if (!session) return null;

  return (
    <div className="flex flex-col w-screen h-screen h-dvh overflow-hidden bg-b0">
      <a href="#main" className="sr-only-focusable fixed top-1 left-1 z-[300] bg-b2 border border-blu rounded px-3 py-1.5 text-xs text-t1">
        {t('app.skip')}
      </a>

      {/* Environment notice — always visible, on every screen. */}
      <div className="classify h-5 flex items-center justify-center shrink-0 truncate px-2" role="note" data-testid="demo-stripe" data-mode={demo ? 'demo' : 'real'}>
        <span className="sm:hidden">NKOYI — {t(demo ? 'app.demo.short' : 'app.real.short')}</span>
        <span className="hidden sm:inline">NKOYI — {t(demo ? 'app.demo' : 'app.real')}</span>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="hidden md:flex shrink-0">
          <NavRail activeView={activeView} onViewChange={handleViewChange} badges={badges} />
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-[200] md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.main')}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex animate-fade-in">
              <NavRail drawer activeView={activeView} badges={badges}
                onViewChange={(v) => { handleViewChange(v); setMobileTab('map'); }} />
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <AppBar onNavigate={handleViewChange} onOpenDrawer={() => setDrawerOpen(true)} />

          <main id="main" ref={mainRef} tabIndex={-1} className="flex flex-col flex-1 overflow-hidden min-h-0 outline-none">
            {isWorkspace && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <WorkspaceBoundary key={activeView} name={activeView.toUpperCase()}>
                  {activeView === 'live'         && <LivePanel onNavigate={handleViewChange} />}
                  {activeView === 'regional'     && <RegionalPanel />}
                  {activeView === 'humanitarian' && <HumanitarianPanel onNavigate={handleViewChange} />}
                  {activeView === 'settings'     && <SettingsPanel />}
                  {activeView === 'triage'       && <TriageQueue />}
                  {activeView === 'fusion'       && <FusionConsole />}
                  {activeView === 'anomalies'    && <AnomalyPanel />}
                  {activeView === 'reports'      && <SitrepPanel />}
                  {activeView === 'data'         && <DataPanel />}
                  {activeView === 'dossiers'     && <LibraryPanel />}
                  {activeView === 'entites'      && <EntitiesPanel />}
                  {activeView === 'signaux'      && <SignalsPanel />}
                  {activeView === 'atelier'      && <WorkbenchPanel onOpenReports={() => handleViewChange('rapports')} onNavigate={handleViewChange} />}
                  {activeView === 'rapports'     && <ReportsPanel onOpenWorkbench={() => handleViewChange('atelier')} />}
                  {activeView === 'journal'      && <AuditPanel />}
                </WorkspaceBoundary>
              </div>
            )}

            {/* The map stays mounted behind workspaces: remounting it would
                reload every tile and lose the camera. */}
            {!isWorkspace && activeView === 'overview' && (
              <div className={`${mobileTab === 'map' ? 'block' : 'hidden'} md:block`}>
                <SituationStrip onNavigate={handleViewChange} />
              </div>
            )}

            {!isWorkspace && (
              <div className={`${mobileTab === 'map' ? 'block' : 'hidden'} md:block shrink-0`}>
                <FilterBar />
              </div>
            )}

            <div className={`${isWorkspace ? 'hidden' : 'flex'} flex-1 overflow-hidden min-h-0 relative`}>
              <div className={`${mobileTab === 'map' ? 'block' : 'hidden'} md:block flex-1 relative isolate overflow-hidden min-w-0`}>
                <GlobeMap />
                <p className="sr-only" data-testid="map-alt">{t('ov.mapAlt', { n: drawnCount })}</p>
                <div className="map-vignette" />
                <CoordHUD />
                <LoadingOverlay />
                <BasemapControl />
                <MapTools onHelp={() => setHelpOpen(true)} />
                <MapLegend />

                {!mapOnly && (
                  <button
                    type="button" onClick={toggleSide} aria-expanded={sidePanelOpen} aria-label={t('ov.sidePanel')}
                    title={t('ov.sidePanel')} data-testid="side-toggle"
                    className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-0 z-hud h-12 w-4 items-center justify-center bg-b1 border border-r-0 border-b3 rounded-l text-t3 hover:text-t1 hover:bg-b2"
                  >
                    <Icon name={sidePanelOpen ? 'chevR' : 'chevL'} size={11} />
                  </button>
                )}
              </div>

              {/* Mobile feed tab */}
              {mobileTab === 'feed' && (
                <div className="md:hidden flex-1 min-w-0 bg-b1">
                  <IntelFeed events={filterFeed(fusionEvents, { range: useFeedStore.getState().timeRange }).slice(0, 300)}
                    selectedId={selectedId} onSelect={selectFusion} compact />
                </div>
              )}

              {!mapOnly && (sidePanelOpen || mobileTab === 'intel') && (
                <div className={`${sidePanelOpen ? 'md:flex' : 'md:hidden'} ${mobileTab === 'intel' ? 'flex' : 'hidden'} min-h-0 w-full md:w-auto`}>
                  <OverviewSide activeView={activeView} mobileVisible={mobileTab === 'intel'} />
                </div>
              )}

              {/* Event record, over the side column */}
              {selected && (
                <div className="absolute inset-y-0 right-0 z-panel w-full md:w-[30rem] md:border-l border-b3 shadow-float animate-fade-in" data-testid="detail-drawer">
                  <IntelDetail event={selected} onClose={() => selectFusion(null)} onNavigate={handleViewChange} />
                </div>
              )}
            </div>

            {/* The lower panels (timeline, raw activity, audio demonstration)
                are built on the illustrative datasets. */}
            {!isWorkspace && !mapOnly && demo && (
              <BottomPanels
                mobileSection={mobileTab === 'activity' ? 'activity' : mobileTab === 'comms' ? 'comms' : null}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile tab bar — map views only */}
      {!isWorkspace && (
        <nav className="flex md:hidden bg-b1 border-t border-b3 shrink-0 pb-[env(safe-area-inset-bottom)]" aria-label="Sections">
          {MOBILE_TABS.filter((m) => demo || (m.key !== 'activity' && m.key !== 'comms' && m.key !== 'intel')).map(({ key, fr, en, icon }) => (
            <button key={key} type="button" onClick={() => setMobileTab(key)} aria-current={mobileTab === key ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-1.5 border-t-2 transition-colors ${
                mobileTab === key ? 'text-t1 border-amb' : 'text-t3 border-transparent'
              }`}>
              <Icon name={icon} />
              <span className="text-3xs font-medium">{lang === 'fr' ? fr : en}</span>
            </button>
          ))}
        </nav>
      )}

      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      <ToastContainer />
    </div>
  );
}
