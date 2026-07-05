'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useToastStore } from '@/store/useToastStore';
import { useMapStore } from '@/store/useMapStore';
import { useDrawStore, type DrawTool } from '@/store/useDrawStore';
import { fetchFIRMS, fetchCopernicus, fetchACLED } from '@/lib/api';
import { ACLED_FALLBACK } from '@/data/acled-fallback';
import { DRONE_ISR } from '@/data/drones';
import GlobeMap from '@/components/globe/GlobeMap';
import CoordHUD from '@/components/hud/CoordHUD';
import Sidebar, { type ViewKey } from '@/components/layout/Sidebar';
import FilterBar from '@/components/layout/FilterBar';
import RightPanel from '@/components/panels/RightPanel';
import BottomPanels from '@/components/panels/BottomPanels';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ToastContainer from '@/components/ui/Toast';
import type { IntelEvent } from '@/types/intel';

type MobileTab = 'map' | 'activity' | 'intel' | 'comms';

const MOBILE_TABS: { key: MobileTab; label: string; sym: string }[] = [
  { key: 'map',      label: 'CARTE',    sym: '⊕' },
  { key: 'activity', label: 'ACTIVITÉ', sym: '≡' },
  { key: 'intel',    label: 'INTEL',    sym: '◈' },
  { key: 'comms',    label: 'COMMS',    sym: '◉' },
];

const DRAW_TOOLS: { key: DrawTool; sym: string; title: string }[] = [
  { key: 'select', sym: '↖', title: 'Sélectionner' },
  { key: 'rect',   sym: '⬜', title: 'Rectangle — 2 clics' },
  { key: 'circle', sym: '○', title: 'Cercle — centre puis rayon' },
  { key: 'poly',   sym: '△', title: 'Polygone — clics, double-clic pour fermer' },
  { key: 'note',   sym: '✎', title: 'Annoter — clic sur la carte' },
];

function MapTools() {
  const { tool, setTool, shapes, notes, clearAll } = useDrawStore();
  const hasDrawings = shapes.length > 0 || notes.length > 0;
  return (
    <div className="absolute top-4 left-3 z-hud hidden md:flex flex-col gap-0.5">
      {DRAW_TOOLS.map(({ key, sym, title }) => (
        <button
          key={key}
          title={title}
          onClick={() => setTool(key)}
          className={`w-7 h-7 border text-xs flex items-center justify-center transition-colors ${
            tool === key
              ? 'bg-blu/20 border-blu text-t1'
              : 'bg-b2/90 border-b3 text-t3 hover:text-t1 hover:border-t3'
          }`}
        >
          {sym}
        </button>
      ))}
      {hasDrawings && (
        <button
          title="Effacer les dessins"
          onClick={clearAll}
          className="w-7 h-7 bg-b2/90 border border-alert/40 text-alert/70 hover:text-alert hover:border-alert text-xs flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function MonitorPage() {
  const router     = useRouter();
  const session    = useAuthStore((s) => s.session);
  const isExpired  = useAuthStore((s) => s.isExpired);
  const firmKey    = useAuthStore((s) => s.firmKey);
  const acledKey   = useAuthStore((s) => s.acledKey);
  const acledEmail = useAuthStore((s) => s.acledEmail);

  const setStatus = useApiStore((s) => s.setStatus);
  const setEvents = useFeedStore((s) => s.setEvents);
  const addEvents = useFeedStore((s) => s.addEvents);
  const push      = useToastStore((s) => s.push);
  const { auto, tick, reset } = useRefreshStore();
  const layers     = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  const fetchedRef  = useRef(false);
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTab,  setMobileTab]  = useState<MobileTab>('map');
  const selectedFeature = useMapStore((s) => s.selectedFeature);

  /* On phones, surface the intel panel when a map feature is tapped */
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

    setEvents([...ACLED_FALLBACK, ...droneEvents]);
    setStatus('drone', 'ok');

    setStatus('acled', 'loading');
    const acledData = await fetchACLED(acledKey, acledEmail);
    if (acledData && acledData.length > 0) {
      addEvents(acledData);
      setStatus('acled', 'ok');
      push(`${acledData.length} événements ACLED chargés`, 'success');
    } else {
      setStatus('acled', acledKey ? 'error' : 'idle');
      if (acledKey) push('ACLED indisponible — données de secours actives', 'warn');
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
  }, [session, firmKey, acledKey, acledEmail, setEvents, addEvents, setStatus, reset, push]);

  /* Initial fetch */
  useEffect(() => {
    if (session && !fetchedRef.current) {
      fetchedRef.current = true;
      doRefresh();
    }
  }, [session, doRefresh]);

  /* Auto-refresh timer */
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => { if (tick()) doRefresh(); }, 1000);
    return () => clearInterval(id);
  }, [auto, tick, doRefresh]);

  /* Adjust map layers when nav view changes */
  const handleViewChange = useCallback((view: ViewKey) => {
    setActiveView(view);
    if (view === 'incidents'    && !layers.acled)  toggleLayer('acled');
    if (view === 'entities'     && !layers.mil)    toggleLayer('mil');
    if (view === 'entities'     && !layers.drone)  toggleLayer('drone');
    if (view === 'effects'      && !layers.acled)  toggleLayer('acled');
    if (view === 'logistics'    && !layers.mil)    toggleLayer('mil');
    if (view === 'planning'     && !layers.zone)   toggleLayer('zone');
  }, [layers, toggleLayer]);

  if (!session) return null;

  return (
    <div className="flex flex-col w-screen h-screen h-dvh overflow-hidden bg-b0">

      {/* Classification stripe — full width */}
      <div className="classify h-5 flex items-center justify-center shrink-0 truncate px-2">
        SECRET // REL TO USA, COD, UNMISS // SENTINELLE-RDC C2 INTEL
      </div>

      {/* ── Mobile top bar ── */}
      <div className="flex md:hidden items-center gap-2 px-2 h-10 bg-b1 border-b border-b3 shrink-0">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu"
          className="w-8 h-8 flex items-center justify-center border border-b3 text-t2 text-base"
        >
          ☰
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 border border-alert flex items-center justify-center shrink-0">
            <div className="w-2 h-2 bg-alert" />
          </div>
          <span className="text-t1 font-mono font-bold text-xs tracking-widest truncate">SENTINELLE-RDC</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-grn animate-pulse-slow" />
          <span className="text-grn text-2xs font-mono font-bold">LIVE</span>
        </div>
      </div>

      {/* Main area below classify stripe */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left Sidebar — desktop ── */}
        <div className="hidden md:flex shrink-0">
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            onRefresh={doRefresh}
          />
        </div>

        {/* ── Sidebar drawer — mobile ── */}
        {drawerOpen && (
          <div className="fixed inset-0 z-[200] md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex animate-slide-up">
              <Sidebar
                activeView={activeView}
                onViewChange={(v) => { handleViewChange(v); setDrawerOpen(false); setMobileTab('map'); }}
                onRefresh={() => { doRefresh(); setDrawerOpen(false); }}
              />
            </div>
          </div>
        )}

        {/* ── Center column ── */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Filter bar — on mobile only with the map tab */}
          <div className={`${mobileTab === 'map' ? 'block' : 'hidden'} md:block shrink-0`}>
            <FilterBar />
          </div>

          {/* Map + right panel row */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* Globe map container */}
            <div className={`${mobileTab === 'map' ? 'block' : 'hidden'} md:block flex-1 relative overflow-hidden min-w-0`}>
              <GlobeMap />
              <CoordHUD />
              <LoadingOverlay />

              {/* AOR label overlay */}
              <div className="absolute top-6 right-6 z-hud pointer-events-none text-right">
                <div className="text-t3 text-2xs font-mono tracking-widest uppercase">ZONE D&apos;OPÉRATIONS</div>
                <div className="text-t1 text-xs font-mono font-bold tracking-widest uppercase">SENTINELLE-RDC EST</div>
              </div>

              {/* Map tools panel — desktop only */}
              <MapTools />
            </div>

            {/* Right panel */}
            <RightPanel activeView={activeView} mobileVisible={mobileTab === 'intel'} />
          </div>

          {/* Bottom panels */}
          <BottomPanels
            mobileSection={
              mobileTab === 'activity' ? 'activity' :
              mobileTab === 'comms'    ? 'comms'    : null
            }
          />
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <div className="flex md:hidden bg-b1 border-t border-b3 shrink-0 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_TABS.map(({ key, label, sym }) => (
          <button
            key={key}
            onClick={() => setMobileTab(key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
              mobileTab === key
                ? 'text-t1 border-t-2 border-blu bg-blu/[0.07]'
                : 'text-t3 border-t-2 border-transparent'
            }`}
          >
            <span className="text-sm leading-none">{sym}</span>
            <span className="text-2xs font-mono tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      {/* Toasts — floating */}
      <ToastContainer />
    </div>
  );
}
