'use client';

import { useMemo } from 'react';
import { useFeedStore, applyFilters } from '@/store/useFeedStore';
import { useFusionStore } from '@/store/useFusionStore';
import { useLiveStore } from '@/store/useLiveStore';
import { useStrategicStore } from '@/store/useStrategicStore';
import { useOpenDataStore } from '@/store/useOpenDataStore';
import { PLACES } from '@/lib/fusion/gazetteer';
import { AXES, AIRSTRIPS, BORDER_CROSSINGS } from '@/lib/fusion/infrastructure';
import { MIL_POSITIONS } from '@/data/military';
import { DRONE_ISR } from '@/data/drones';
import { M23_ZONES_GEOJSON } from '@/data/zones';
import { useMapStore } from '@/store/useMapStore';
import type { LayerKey } from '@/types/intel';

/**
 * How many features each layer holds under the current filters.
 *
 * `null` means "not loaded", which is a different statement from zero: a
 * live feed that has not answered yet has no count, whereas a feed that
 * answered with nothing genuinely has none. The layer manager shows them
 * differently, because an operator who reads "0 séismes" will conclude
 * the ground is quiet.
 */
export function useLayerCounts(): Record<LayerKey, number | null> {
  const events      = useFeedStore((s) => s.events);
  const timeRange   = useFeedStore((s) => s.timeRange);
  const searchQuery = useFeedStore((s) => s.searchQuery);
  const classFilter = useFeedStore((s) => s.classFilter);
  const fusion      = useFusionStore((s) => s.events);
  const seeded      = useFusionStore((s) => s.seeded);
  const clusters    = useFusionStore((s) => s.clusters);
  const seismic     = useLiveStore((s) => s.seismic);
  const weather     = useLiveStore((s) => s.weather);
  const osm         = useLiveStore((s) => s.osm);
  const strategic   = useStrategicStore((s) => s.records);
  const boundsLoaded = useMapStore((s) => s.boundsLoaded);
  const eonet = useOpenDataStore((s) => s.eonet);
  const hydro = useOpenDataStore((s) => s.hydro);

  return useMemo(() => {
    const visible = applyFilters(events, { query: searchQuery, timeRange, classFilter });
    const acled = visible.filter((e) => e.src === 'acled' && (e.lat !== 0 || e.lon !== 0)).length;
    const firms = visible.filter((e) => e.src === 'firms' && e.lat !== 0).length;
    const fused = Math.min(500, fusion.filter(
      (e) => e.location && e.status !== 'rejected' && e.status !== 'merged',
    ).length);
    const secret = classFilter === 'TOUS' || classFilter === 'SECRET';
    const live = <T,>(r: { data: T[] | null; health: string }) =>
      r.data ? r.data.length : null;

    return {
      bounds: boundsLoaded != null && boundsLoaded > 0 ? boundsLoaded : null,
      dossiers: strategic.filter((r) => r.lat != null && r.lon != null && r.status !== 'archived').length,
      fusion: seeded ? fused : null,
      halo:   seeded ? Math.min(400, fused) : null,
      scan:   seeded ? clusters.filter((c) => c.significant).length : null,
      acled, firms, heat: firms,
      drone:  secret ? DRONE_ISR.length : 0,
      mil:    secret ? MIL_POSITIONS.length : 0,
      zone:   M23_ZONES_GEOJSON.features.length,
      ref:    PLACES.filter((p) => !['province', 'territory', 'feature'].includes(p.kind)).length,
      routes: AXES.length,
      air:    AIRSTRIPS.length,
      border: BORDER_CROSSINGS.length,
      seismic: live(seismic),
      weather: live(weather),
      osm:     live(osm),
      eonet:   live(eonet),
      rivers:  live(hydro),
      // Imagery has no feature count.
      sat_true: null, sat_rain: null, sat_night: null,
    };
  }, [events, searchQuery, timeRange, classFilter, fusion, seeded, clusters, seismic, weather, osm, strategic, boundsLoaded, eonet, hydro]);
}
