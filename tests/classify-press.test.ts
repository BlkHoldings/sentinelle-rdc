import { describe, it, expect } from 'vitest';
import { classifyEvent } from '@/lib/fusion/classify';

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
