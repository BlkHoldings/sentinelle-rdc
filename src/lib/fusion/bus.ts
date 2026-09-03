/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — Stream Bus
   ═══════════════════════════════════════════════════════════════════════

   The reference architecture specified Kafka topics, a Kafka Streams
   topology and Kafka Connect. That is the right shape for a server
   deployment — and the wrong shape for *this* deployment, which is a
   static bundle served from a CDN to an analyst's laptop, frequently on a
   metered mobile link, frequently offline.

   So the topology is kept and the transport is changed: this is an
   append-only, offset-addressed, topic-partitioned log that runs inside
   the browser tab. It preserves the semantics that actually matter —

     • append-only ordered log per topic, addressed by offset
     • independent consumer groups with their own committed offsets
     • consumer lag as a first-class, observable metric
     • bounded retention with explicit eviction
     • replay from any retained offset

   — which means the pipeline code is written against a real streaming
   contract and would port to Kafka by swapping this module alone. It also
   means the fusion console can show genuine throughput and lag numbers
   rather than decorative ones.

   Topic names are kept identical to the specification so the two
   deployments stay wire-compatible.
   ═══════════════════════════════════════════════════════════════════════ */

export const TOPICS = {
  RAW_SOCIAL:  'raw.drc.social_media',
  RAW_NEWS:    'raw.drc.news',
  RAW_FIELD:   'raw.drc.field_reports',
  RAW_SENSORS: 'raw.drc.sensors',
  NORMALIZED:  'normalized.drc.events',
  ENRICHED:    'enriched.drc.events',
  ALERTS:      'alerts.drc',
  /** Not in the reference spec — pairs the deduper could not resolve
   *  automatically, awaiting analyst adjudication. Making this a topic
   *  rather than a side-table is what lets the triage queue replay and
   *  audit its own backlog. */
  TRIAGE:      'triage.drc.pending',
  /** Analyst decisions, fed back to the reliability model. */
  FEEDBACK:    'feedback.drc.adjudications',
} as const;

export type TopicName = typeof TOPICS[keyof typeof TOPICS];

export const ALL_TOPICS: TopicName[] = Object.values(TOPICS);

export interface Message<T = unknown> {
  offset: number;
  key: string;
  value: T;
  timestamp: number;
  /** Producing component, for the topology graph. */
  producer: string;
}

interface TopicState {
  name: TopicName;
  log: Message[];
  nextOffset: number;
  /** Offset of log[0] — rises as retention evicts. */
  baseOffset: number;
  retention: number;
  /** Rolling throughput ring: one bucket per second, 60 buckets. Each
   *  bucket stores the second it belongs to alongside its count, so a
   *  stale bucket from 3 minutes ago is never counted as current. */
  produced: Uint32Array;
  bucketSec: Float64Array;
  totalProduced: number;
}

type Handler<T> = (msg: Message<T>) => void | Promise<void>;

interface Consumer {
  group: string;
  topic: TopicName;
  offset: number;
  handler: Handler<unknown>;
  /** Messages processed, for the console. */
  processed: number;
  errors: number;
}

export interface TopicStats {
  name: TopicName;
  depth: number;
  totalProduced: number;
  /** Messages per second over the trailing 60 s. */
  rate: number;
  consumers: { group: string; lag: number; processed: number; errors: number }[];
  maxLag: number;
}

const RETENTION_DEFAULT = 2000;

export class StreamBus {
  private topics = new Map<TopicName, TopicState>();
  private consumers: Consumer[] = [];
  private draining = false;
  private listeners = new Set<() => void>();

  constructor(retention: Partial<Record<TopicName, number>> = {}) {
    for (const name of ALL_TOPICS) {
      this.topics.set(name, {
        name,
        log: [],
        nextOffset: 0,
        baseOffset: 0,
        retention: retention[name] ?? RETENTION_DEFAULT,
        produced: new Uint32Array(60),
        bucketSec: new Float64Array(60).fill(-1),
        totalProduced: 0,
      });
    }
  }

  /* ── Producer ─────────────────────────────────────────────────── */

  produce<T>(topic: TopicName, key: string, value: T, producer = 'unknown'): number {
    const t = this.topics.get(topic);
    if (!t) throw new Error(`unknown topic: ${topic}`);

    const msg: Message<T> = {
      offset: t.nextOffset++,
      key, value,
      timestamp: Date.now(),
      producer,
    };
    t.log.push(msg as Message);
    t.totalProduced++;
    this.tickRate(t);

    // Retention: evict from the head, advancing baseOffset. Consumers
    // that have fallen behind the base are fast-forwarded on next drain
    // rather than silently re-reading wrong data.
    if (t.log.length > t.retention) {
      const drop = t.log.length - t.retention;
      t.log.splice(0, drop);
      t.baseOffset += drop;
    }

    this.scheduleDrain();
    return msg.offset;
  }

  produceBatch<T>(topic: TopicName, items: { key: string; value: T }[], producer = 'unknown'): void {
    for (const it of items) this.produce(topic, it.key, it.value, producer);
  }

  private tickRate(t: TopicState): void {
    const nowSec = Math.floor(Date.now() / 1000);
    const i = nowSec % 60;
    // A bucket carrying a different second is a full lap stale — reset it
    // rather than adding to a count from a minute ago.
    if (t.bucketSec[i] !== nowSec) { t.bucketSec[i] = nowSec; t.produced[i] = 0; }
    t.produced[i]++;
  }

  /* ── Consumer ─────────────────────────────────────────────────── */

  /** Subscribe a consumer group to a topic. `fromBeginning` replays the
   *  retained log; otherwise the consumer starts at the head. */
  subscribe<T>(
    group: string,
    topic: TopicName,
    handler: Handler<T>,
    fromBeginning = false,
  ): () => void {
    const t = this.topics.get(topic);
    if (!t) throw new Error(`unknown topic: ${topic}`);

    const consumer: Consumer = {
      group, topic,
      offset: fromBeginning ? t.baseOffset : t.nextOffset,
      handler: handler as Handler<unknown>,
      processed: 0,
      errors: 0,
    };
    this.consumers.push(consumer);
    if (fromBeginning) this.scheduleDrain();

    return () => {
      const i = this.consumers.indexOf(consumer);
      if (i >= 0) this.consumers.splice(i, 1);
    };
  }

  /** Reset a group's offset — the replay control in the fusion console. */
  seek(group: string, topic: TopicName, offset: number | 'earliest' | 'latest'): void {
    const t = this.topics.get(topic);
    if (!t) return;
    for (const c of this.consumers) {
      if (c.group !== group || c.topic !== topic) continue;
      c.offset =
        offset === 'earliest' ? t.baseOffset :
        offset === 'latest'   ? t.nextOffset :
        Math.max(t.baseOffset, Math.min(offset, t.nextOffset));
    }
    this.scheduleDrain();
  }

  /* ── Delivery ─────────────────────────────────────────────────── */

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => { void this.drain(); });
  }

  private async drain(): Promise<void> {
    try {
      // Loop until quiescent: handlers commonly produce onto downstream
      // topics, so one pass is not enough to settle the topology.
      let moved = true;
      let guard = 0;
      while (moved && guard++ < 64) {
        moved = false;
        for (const c of [...this.consumers]) {
          const t = this.topics.get(c.topic);
          if (!t) continue;
          // A consumer that fell behind retention cannot read what was
          // evicted; fast-forward it and surface that as an error count.
          if (c.offset < t.baseOffset) {
            c.errors += t.baseOffset - c.offset;
            c.offset = t.baseOffset;
          }
          while (c.offset < t.nextOffset) {
            const msg = t.log[c.offset - t.baseOffset];
            c.offset++;
            if (!msg) continue;
            moved = true;
            try {
              await c.handler(msg);
              c.processed++;
            } catch {
              c.errors++;
            }
          }
        }
      }
    } finally {
      this.draining = false;
      this.emit();
    }
  }

  /* ── Introspection ────────────────────────────────────────────── */

  read<T>(topic: TopicName, fromOffset = 0, limit = 100): Message<T>[] {
    const t = this.topics.get(topic);
    if (!t) return [];
    const start = Math.max(0, fromOffset - t.baseOffset);
    return t.log.slice(start, start + limit) as Message<T>[];
  }

  /** Most recent `n` messages on a topic. */
  tail<T>(topic: TopicName, n = 20): Message<T>[] {
    const t = this.topics.get(topic);
    if (!t) return [];
    return t.log.slice(Math.max(0, t.log.length - n)) as Message<T>[];
  }

  stats(): TopicStats[] {
    const nowSec = Math.floor(Date.now() / 1000);
    return ALL_TOPICS.map((name) => {
      const t = this.topics.get(name)!;
      let sum = 0;
      for (let i = 0; i < 60; i++) {
        if (nowSec - t.bucketSec[i] < 60) sum += t.produced[i];
      }
      const cons = this.consumers
        .filter((c) => c.topic === name)
        .map((c) => ({
          group: c.group,
          lag: Math.max(0, t.nextOffset - c.offset),
          processed: c.processed,
          errors: c.errors,
        }));
      return {
        name,
        depth: t.log.length,
        totalProduced: t.totalProduced,
        rate: +(sum / 60).toFixed(2),
        consumers: cons,
        maxLag: cons.reduce((m, c) => Math.max(m, c.lag), 0),
      };
    });
  }

  /** Subscribe to bus activity — drives the console's live redraw. */
  onActivity(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* a broken listener must not stall the bus */ }
    }
  }

  reset(): void {
    for (const name of ALL_TOPICS) {
      const t = this.topics.get(name)!;
      t.log = []; t.nextOffset = 0; t.baseOffset = 0;
      t.totalProduced = 0; t.produced.fill(0); t.bucketSec.fill(-1);
    }
    for (const c of this.consumers) { c.offset = 0; c.processed = 0; c.errors = 0; }
    this.emit();
  }
}

/** Process-wide bus. One per tab; the pipeline attaches its consumers on
 *  first use. */
let singleton: StreamBus | null = null;

export function getBus(): StreamBus {
  if (!singleton) singleton = new StreamBus();
  return singleton;
}
