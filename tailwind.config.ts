import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      /* ── Apple system dark-mode color palette ─────────────── */
      colors: {
        b0: '#000000',
        b1: '#1c1c1e',
        b2: '#2c2c2e',
        b3: '#3a3a3c',
        bd: '#38383a',
        t1: '#ffffff',
        t2: '#98989e',
        t3: '#6c6c70',
        alert: { DEFAULT: '#ff453a', muted: 'rgba(255,69,58,0.14)' },
        amb:   { DEFAULT: '#ff9f0a', muted: 'rgba(255,159,10,0.14)' },
        grn:   { DEFAULT: '#30d158', muted: 'rgba(48,209,88,0.14)' },
        blu:   { DEFAULT: '#0a84ff', muted: 'rgba(10,132,255,0.14)' },
        cyn:   { DEFAULT: '#40c8e0', muted: 'rgba(64,200,224,0.14)' },
        pur:   { DEFAULT: '#bf5af2', muted: 'rgba(191,90,242,0.14)' },
        fire:  { DEFAULT: '#ff6b00', muted: 'rgba(255,107,0,0.14)' },
        mag:   { DEFAULT: '#ff375f', muted: 'rgba(255,55,95,0.14)' },
        drone: { DEFAULT: '#64d2ff', muted: 'rgba(100,210,255,0.14)' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'IBM Plex Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '1.2' }],
        '3xs': ['0.5625rem', { lineHeight: '1' }],
      },
      zIndex: {
        globe:   '0',
        overlay: '10',
        panel:   '20',
        hud:     '30',
        header:  '40',
        session: '50',
        toast:   '60',
        modal:   '70',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.2' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        blastRing: {
          '0%':   { transform: 'translate(-50%,-50%) scale(0.5)', opacity: '0.5' },
          '100%': { transform: 'translate(-50%,-50%) scale(2)', opacity: '0' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'pulse-slow':  'pulse 2s ease-in-out infinite',
        'pulse-fast':  'pulse 0.7s ease-in-out infinite',
        'slide-up':    'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
        'fade-in':     'fadeIn 0.3s ease-out',
        'blast-ring':  'blastRing 2.5s ease-out infinite',
        'spin-slow':   'spin 0.65s linear infinite',
      },
      boxShadow: {
        panel: '0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)',
        float: '0 20px 60px rgba(0,0,0,0.85)',
      },
    },
  },
  plugins: [],
};

export default config;
