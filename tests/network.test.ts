import { describe, it, expect } from 'vitest';
import { parseConnectivity, datasourceLabel } from '@/lib/live/connectivity';
import { parseScenes } from '@/lib/live/imagery';
import ioda from './fixtures/ioda_alerts.json';
import earth from './fixtures/earthsearch.json';

const NOW = 1794630900 * 1000 + 30 * 60_000; // just after the fixture's latest alert

describe('connectivity (IODA)', () => {
  it('parses the real alert feed and reports a status', () => {
    const c = parseConnectivity(ioda as never, NOW);
    expect(['up', 'degraded', 'outage', 'unknown']).toContain(c.status);
    expect(c.alerts.length).toBeGreaterThan(0);
    expect(c.alerts[0].at >= c.alerts[c.alerts.length - 1].at).toBe(true); // newest first
  });
  it('reads up when the latest alert per source is normal', () => {
    const c = parseConnectivity({ data: [{ datasource: 'bgp', level: 'normal', value: 462, historyValue: 464, time: NOW / 1000 - 600, entity: { type: 'country' } }] }, NOW);
    expect(c.status).toBe('up');
  });
  it('flags an outage when two sources are recently critical', () => {
    const t = NOW / 1000 - 600;
    const c = parseConnectivity({ data: [
      { datasource: 'bgp', level: 'critical', value: 300, historyValue: 460, time: t, entity: { type: 'country' } },
      { datasource: 'ping-slash24', level: 'critical', value: 100, historyValue: 500, time: t, entity: { type: 'country' } },
    ] }, NOW);
    expect(c.status).toBe('outage');
  });
  it('reports unknown (not outage, not up) for an old unresolved alert', () => {
    const old = NOW / 1000 - 6 * 3600;
    const c = parseConnectivity({ data: [{ datasource: 'bgp', level: 'critical', value: 300, historyValue: 460, time: old, entity: { type: 'country' } }] }, NOW);
    expect(c.status).toBe('unknown');
  });
  it('labels datasources in French', () => {
    expect(datasourceLabel('bgp')).toBe('Routage BGP');
    expect(datasourceLabel('ping-slash24')).toBe('Sondage actif');
  });
});

describe('imagery (Sentinel-2)', () => {
  it('parses scenes newest first with cloud cover and thumbnail', () => {
    const scenes = parseScenes(earth as never);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes[0].datetime >= scenes[scenes.length - 1].datetime).toBe(true);
    for (const s of scenes) {
      expect(s.id).toBeTruthy();
      expect(typeof s.datetime).toBe('string');
    }
  });
  it('keeps cloud cover as a number or null, never guessed', () => {
    const scenes = parseScenes({ features: [{ id: 'x', properties: { datetime: '2026-11-10T00:00:00Z' } }] });
    expect(scenes[0].cloudCover).toBeNull();
  });
});
