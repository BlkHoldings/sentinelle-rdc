'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DRONE_ISR } from '@/data/drones';

/**
 * SIGINT intercept player. Playback is a real Web Audio radio bed
 * (band-passed noise + squelch bursts) with the transcription read by
 * SpeechSynthesis in French, timed against a length-derived duration.
 */

interface Props {
  /** On phones, section fills the content area when its tab is active */
  mobileActive?: boolean;
}

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* Waveform with live playhead */
function Waveform({ progress }: { progress: number }) {
  const bars = 54;
  return (
    <svg width="100%" height="40" viewBox={`0 0 ${bars * 4} 40`} preserveAspectRatio="none">
      {Array.from({ length: bars }, (_, i) => {
        const t = i / bars;
        const h = (Math.abs(Math.sin(t * 18.4) * Math.cos(t * 7.3) * 0.75 +
                            Math.sin(t * 31.1) * 0.25) * 32 + 4);
        const y = (40 - h) / 2;
        const played = t <= progress;
        return (
          <rect
            key={i}
            x={i * 4 + 0.5} y={y} width={3} height={h}
            fill={played ? '#18c8e0' : '#445870'}
            fillOpacity={played ? 0.95 : 0.55}
          />
        );
      })}
      {progress > 0 && progress < 1 && (
        <line
          x1={progress * bars * 4} x2={progress * bars * 4} y1={0} y2={40}
          stroke="#c8d8e8" strokeWidth={1}
        />
      )}
    </svg>
  );
}

type PlayState = 'idle' | 'playing' | 'paused';

export default function CommsIntercept({ mobileActive = false }: Props) {
  const intercepts = useMemo(() => DRONE_ISR.filter((r) => r.desc), []);
  const [idx, setIdx]         = useState(0);
  const [playState, setPlay]  = useState<PlayState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [modal, setModal]     = useState(false);

  const rec = intercepts[idx];

  /* Deterministic per-intercept RF metadata */
  const meta = useMemo(() => {
    const h = hashOf(rec.id);
    return {
      freq: `${(146 + (h % 130) / 10).toFixed(1)} MHz`,
      conf: `${62 + (h % 33)}%`,
    };
  }, [rec.id]);

  /* Duration scales with transcription length (~reading speed) */
  const duration = useMemo(
    () => Math.min(150, Math.max(8, Math.round((rec.desc?.length ?? 0) * 0.075))),
    [rec.desc],
  );

  const audioRef  = useRef<{ ctx: AudioContext; stopBed: () => void } | null>(null);
  const clockRef  = useRef<{ base: number; t0: number }>({ base: 0, t0: 0 });
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.stopBed();
      audioRef.current.ctx.close().catch(() => {});
      audioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    clockRef.current = { base: 0, t0: 0 };
    setElapsed(0);
    setPlay('idle');
  }, [teardown]);

  /* Radio bed: looped band-passed noise + squelch burst at start */
  const buildBed = useCallback((ctx: AudioContext) => {
    const len    = ctx.sampleRate * 2;
    const buf    = ctx.createBuffer(1, len, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    src.loop     = true;

    const band   = ctx.createBiquadFilter();
    band.type    = 'bandpass';
    band.frequency.value = 1500;
    band.Q.value = 0.7;

    const gain   = ctx.createGain();
    gain.gain.value = 0.035;

    src.connect(band).connect(gain).connect(ctx.destination);
    src.start();

    /* Squelch open: brief loud burst decaying fast */
    const sq     = ctx.createBufferSource();
    sq.buffer    = buf;
    const sqGain = ctx.createGain();
    sqGain.gain.setValueAtTime(0.28, ctx.currentTime);
    sqGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    sq.connect(band);
    sq.connect(sqGain).connect(ctx.destination);
    sq.start();
    sq.stop(ctx.currentTime + 0.25);

    return () => { try { src.stop(); } catch { /* already stopped */ } };
  }, []);

  const startTicker = useCallback(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      const { base, t0 } = clockRef.current;
      const el = base + (Date.now() - t0) / 1000;
      if (el >= duration) {
        stop();
      } else {
        setElapsed(el);
      }
    }, 150);
  }, [duration, stop]);

  const play = useCallback(() => {
    if (playState === 'playing') return;

    if (playState === 'paused' && audioRef.current) {
      audioRef.current.ctx.resume();
      if ('speechSynthesis' in window) window.speechSynthesis.resume();
      clockRef.current.t0 = Date.now();
      startTicker();
      setPlay('playing');
      return;
    }

    const ctx = new AudioContext();
    audioRef.current = { ctx, stopBed: buildBed(ctx) };

    if ('speechSynthesis' in window && rec.desc) {
      const utter  = new SpeechSynthesisUtterance(rec.desc);
      utter.lang   = 'fr-FR';
      utter.rate   = 1.02;
      utter.pitch  = 0.8;
      utter.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }

    clockRef.current = { base: 0, t0: Date.now() };
    setElapsed(0);
    startTicker();
    setPlay('playing');
  }, [playState, rec.desc, buildBed, startTicker]);

  const pause = useCallback(() => {
    if (playState !== 'playing' || !audioRef.current) return;
    audioRef.current.ctx.suspend();
    if ('speechSynthesis' in window) window.speechSynthesis.pause();
    clockRef.current.base += (Date.now() - clockRef.current.t0) / 1000;
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    setPlay('paused');
  }, [playState]);

  /* Stop playback when switching intercept or unmounting */
  useEffect(() => stop, [idx, stop]);

  /* ESC closes the modal */
  useEffect(() => {
    if (!modal) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modal]);

  const progress = duration ? Math.min(1, elapsed / duration) : 0;

  const cycle = (dir: 1 | -1) =>
    setIdx((i) => (i + dir + intercepts.length) % intercepts.length);

  return (
    <div className={`${mobileActive ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[240px] shrink-0`}>
      <div className="panel-header px-3 py-1.5 flex items-center justify-between shrink-0">
        <span className="mvn-label">COMMUNICATIONS INTERCEPT</span>
        <div className="flex items-center gap-1">
          <button onClick={() => cycle(-1)} className="text-t3 hover:text-t1 text-2xs font-mono px-1 transition-colors">‹</button>
          <span className="text-t3 text-2xs font-mono">{idx + 1}/{intercepts.length}</span>
          <button onClick={() => cycle(1)} className="text-t3 hover:text-t1 text-2xs font-mono px-1 transition-colors">›</button>
        </div>
      </div>
      <div className="panel-header px-3 py-1 shrink-0 flex items-center justify-between">
        <span className="text-t3 text-2xs font-mono">{rec.id} · {rec.time}</span>
        {playState !== 'idle' && (
          <span className="text-cyn text-2xs font-mono font-bold animate-pulse-slow">
            {playState === 'playing' ? '● REC' : '❚❚'}
          </span>
        )}
      </div>

      {/* Player */}
      <div className="px-3 py-1 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={playState === 'playing' ? pause : play}
            title={playState === 'playing' ? 'Pause' : 'Lecture'}
            className="w-5 h-5 border border-t3/50 flex items-center justify-center text-t2 hover:border-cyn hover:text-cyn transition-colors shrink-0"
          >
            <span className="text-xs leading-none">{playState === 'playing' ? '❚❚' : '▶'}</span>
          </button>
          <button
            onClick={stop}
            title="Stop"
            className="w-5 h-5 border border-t3/50 flex items-center justify-center text-t2 hover:border-alert hover:text-alert transition-colors shrink-0"
          >
            <span className="text-xs leading-none">■</span>
          </button>
          <Waveform progress={progress} />
        </div>
        <div className="flex justify-between text-t3 text-2xs font-mono">
          <span className={playState !== 'idle' ? 'text-cyn' : ''}>{fmt(elapsed)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-3 py-1.5 border-t border-b3 shrink-0">
        {[
          { label: 'SOURCE',    val: rec.platform },
          { label: 'TYPE',      val: rec.type     },
          { label: 'FRÉQ',      val: meta.freq    },
          { label: 'CONFIANCE', val: meta.conf    },
        ].map(({ label, val }) => (
          <div key={label}>
            <div className="mvn-label">{label}</div>
            <div className="text-t2 text-2xs font-mono truncate">{val}</div>
          </div>
        ))}
      </div>

      {/* Transcription */}
      <div className="flex-1 px-3 py-1.5 border-t border-b3 overflow-y-auto min-h-0">
        <div className="mvn-label mb-1">TRANSCRIPTION (TRADUIT)</div>
        <p className="text-t2 text-2xs font-mono leading-relaxed">
          &quot;…{rec.desc}…&quot;
        </p>
      </div>

      <div className="panel-header px-3 py-1 shrink-0">
        <button
          onClick={() => setModal(true)}
          className="text-t3 text-2xs font-mono hover:text-blu transition-colors"
        >
          VIEW FULL INTERCEPT
        </button>
      </div>

      {/* ── Full intercept modal ── */}
      {modal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModal(false)} />
          <div className="relative panel shadow-float w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="panel-header px-3 py-2 flex items-center justify-between shrink-0">
              <span className="mvn-label">INTERCEPT {rec.id} — RAPPORT COMPLET</span>
              <button onClick={() => setModal(false)} className="text-t3 hover:text-t1 text-sm transition-colors">✕</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 px-3 py-2 border-b border-b3 shrink-0">
              {[
                { label: 'ID',         val: rec.id },
                { label: 'PLATEFORME', val: rec.platform },
                { label: 'BASE',       val: rec.base },
                { label: 'ALTITUDE',   val: rec.alt },
                { label: 'HEURE',      val: rec.time },
                { label: 'STATUT',     val: rec.status },
                { label: 'FRÉQ',       val: meta.freq },
                { label: 'CONFIANCE',  val: meta.conf },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="mvn-label">{label}</div>
                  <div className="text-t2 text-2xs font-mono">{val}</div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-b border-b3 shrink-0">
              <div className="mvn-label mb-0.5">POSITION</div>
              <div className="text-cyn text-2xs font-mono">
                {rec.lat.toFixed(4)}°, {rec.lon.toFixed(4)}°
              </div>
            </div>
            <div className="px-3 py-2 overflow-y-auto">
              <div className="mvn-label mb-1">TRANSCRIPTION COMPLÈTE (TRADUIT DU SWAHILI/FR)</div>
              <p className="text-t1 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                {rec.desc}
              </p>
            </div>
            <div className="panel-header px-3 py-1.5 shrink-0 flex items-center justify-between">
              <span className="classify px-1.5 py-0.5 text-2xs">SECRET // SIGINT</span>
              <button
                onClick={() => { setModal(false); playState === 'playing' ? pause() : play(); }}
                className="text-blu text-2xs font-mono hover:text-t1 transition-colors"
              >
                {playState === 'playing' ? '❚❚ PAUSE AUDIO' : '▶ LECTURE AUDIO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
