'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useToastStore } from '@/store/useToastStore';
import { useMapStore } from '@/store/useMapStore';
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
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-b0">

      {/* Classification stripe — full width */}
      <div className="classify h-5 flex items-center justify-center shrink-0">
        SECRET // REL TO USA, COD, UNMISS // SENTINELLE-RDC C2 INTEL
      </div>

      {/* Main area below classify stripe */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left Sidebar ── */}
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          onRefresh={doRefresh}
        />

        {/* ── Center column ── */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Filter bar */}
          <FilterBar />

          {/* Map + right panel row */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* Globe map container */}
            <div className="flex-1 relative overflow-hidden min-w-0">
              <GlobeMap />
              <CoordHUD />
              <LoadingOverlay />
            </div>

            {/* Right panel */}
            <RightPanel activeView={activeView} />
          </div>

          {/* Bottom panels */}
          <BottomPanels />
        </div>
      </div>

      {/* Toasts — floating */}
      <ToastContainer />
    </div>
  );
}
