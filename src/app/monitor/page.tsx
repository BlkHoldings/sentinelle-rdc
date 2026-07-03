'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useApiStore } from '@/store/useApiStore';
import { useFeedStore } from '@/store/useFeedStore';
import { useRefreshStore } from '@/store/useRefreshStore';
import { useToastStore } from '@/store/useToastStore';
import { fetchFIRMS, fetchCopernicus, fetchACLED } from '@/lib/api';
import { ACLED_FALLBACK } from '@/data/acled-fallback';
import { DRONE_ISR } from '@/data/drones';
import GlobeMap from '@/components/globe/GlobeMap';
import TopBar from '@/components/hud/TopBar';
import CoordHUD from '@/components/hud/CoordHUD';
import IntelAssessmentPanel from '@/components/hud/IntelAssessmentPanel';
import LayerToggles from '@/components/hud/LayerToggles';
import TacticalFeedPanel from '@/components/feed/TacticalFeedPanel';
import ToastContainer from '@/components/ui/Toast';
import SessionBar from '@/components/ui/SessionBar';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
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

  const fetchedRef = useRef(false);
  const [showIntsum, setShowIntsum] = useState(false);

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

  useEffect(() => {
    if (session && !fetchedRef.current) {
      fetchedRef.current = true;
      doRefresh();
    }
  }, [session, doRefresh]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      if (tick()) doRefresh();
    }, 1000);
    return () => clearInterval(id);
  }, [auto, tick, doRefresh]);

  if (!session) return null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-b0">

      {/* Globe viewport */}
      <div className="absolute inset-0 z-globe">
        <GlobeMap />
      </div>

      {/* Header */}
      <TopBar
        onRefresh={doRefresh}
        onToggleIntsum={() => setShowIntsum((v) => !v)}
        intsumOpen={showIntsum}
      />

      {/* Layer chips (horizontal, below header on left) */}
      <LayerToggles />

      {/* Coordinate HUD (bottom-left) */}
      <CoordHUD />

      {/* Intelligence Assessment panel (toggleable) */}
      {showIntsum && (
        <IntelAssessmentPanel onClose={() => setShowIntsum(false)} />
      )}

      {/* Tactical feed panel (right) */}
      <TacticalFeedPanel />

      {/* Session bar */}
      <SessionBar />

      {/* Loading overlay */}
      <LoadingOverlay />

      {/* Toasts */}
      <ToastContainer />
    </div>
  );
}
