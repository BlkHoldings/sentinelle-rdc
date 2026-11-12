import type { FusedEvent } from '@/lib/fusion/schema';

/**
 * What actually needs a human decision now — not everything the pipeline
 * has ever retained.
 *
 * An earlier revision routed every single-source event here, which put
 * the entire historical baseline (single-source by construction) into the
 * queue: 1 200 items, none of them actionable, burying the dozen that
 * were. A triage queue an analyst cannot clear is one they stop opening.
 *
 * Exported because the sidebar badge must count exactly what the queue
 * shows — two copies of this rule would drift apart within a week.
 */
export function needsTriage(e: FusedEvent): boolean {
  /* A note is not a decision: an annotated event still needs adjudicating. */
  if (e.adjudications.some((a) => a.action !== 'edit') || e.status === 'merged') return false;
  if (e.status === 'disputed') return true;
  const ageH = (Date.now() - new Date(e.timestamp).getTime()) / 3_600_000;
  if (ageH > 96) return false;
  if (e.priority >= 45) return true;
  return e.independent_sources === 1 &&
    ((e.casualties.fatalities ?? 0) >= 3 || e.priority >= 30);
}
