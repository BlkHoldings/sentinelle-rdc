import { describe, it, expect } from 'vitest';
import { classifyEvent } from '@/lib/fusion/classify';
import { extract } from '@/lib/fusion/extract';

const cls = (t: string) => classifyEvent(t, extract(t, '2026-11-14T00:00:00Z'));

/* Headline-only press classification: live feeds send a lot of sport and
   culture, which must not be dressed up as security incidents. */
describe('off-topic headlines', () => {
  it('does not classify a football result as a clash', () => {
    const c = classifyEvent('Ligue 1 : Lupopo fait tomber Don Bosco au stade Mazembe');
    expect(c.type).toBe('unknown');
  });
  it('does not classify a concert as violence', () => {
    expect(classifyEvent('Musique : concert de rumba à Kinshasa, un festival réussi').type).toBe('unknown');
  });
  it('still classifies real violence that mentions a stadium', () => {
    const c = classifyEvent('Attaque armée près du stade de Beni : des combats entre FARDC et ADF font plusieurs morts');
    expect(c.type).not.toBe('unknown');
  });
  it('still classifies a plain conflict headline', () => {
    const c = classifyEvent('Nord-Kivu : affrontements entre FARDC et M23 à Sake');
    expect(['armed_clash']).toContain(c.type);
  });
});

/* Entity collisions the live press creates: sports-club and parish-team
   names match armed groups ("TP Mazembe" vs "Mai-Mai Mazembe"). */
describe('name collisions', () => {
  it('does not inherit a clash from a club name that matches a militia', () => {
    expect(cls('Ligue 1 : Lupopo fait tomber Don Bosco au stade Mazembe').type).toBe('unknown');
    expect(cls('TP Mazembe remporte la coupe du Congo').type).toBe('unknown');
  });
  it('keeps the militia classification when the text is actually about violence', () => {
    expect(cls('Nord-Kivu : affrontements entre FARDC et Mai-Mai Mazembe à Pinga, 5 morts').type).not.toBe('unknown');
  });
});
