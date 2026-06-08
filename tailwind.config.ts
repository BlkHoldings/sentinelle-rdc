import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      /* ── Military dark-mode colour palette ──────────────── */
      colors: {
        // Background layers
        b0: '#04080e',
        b1: '#0a0f18',
        b2: '#0e1520',
        b3: '#141d2b',
        // Borders
        bd: '#1a2842',
        // Text
        t1: '#dce4f0',
        t2: '#7e96b4',
        t3: '#45586e',
        // Status / event colours
        alert:  { DEFAULT: '#ff3b4a', muted: 'rgba(255,59,74,0.08)' },
        amb:    { DEFAULT: '#ffa726', muted: 'rgba(255,167,38,0.08)' },
        grn:    { DEFAULT: '#26d97f', muted: 'rgba(38,217,127,0.08)' },
        blu:    { DEFAULT: '#2196f3', muted: 'rgba(33,150,243,0.08)' },
        cyn:    { DEFAULT: '#00bcd4', muted: 'rgba(0,188,212,0.08)' },
        pur:    { DEFAULT: '#9c5cf5', muted: 'rgba(156,92,245,0.08)' },
        fire:   { DEFAULT: '#ff5722', muted: 'rgba(255,87,34,0.08)' },
        mag:    { DEFAULT: '#e91e63', muted: 'rgba(233,30,99,0.08)' },
        drone:  { DEFAULT: '#00e5ff', muted: 'rgba(0,229,255,0.08)' },
      },

      /* ── Typography ──────────────────────────────────────── */
      fontFamily: {
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
        sans: ['Outfit', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        '2xs': ['0.5rem',  { lineHeight: '1' }],  // 8px
        '3xs': ['0.4375rem',{ lineHeight: '1' }], // 7px
      },

      /* ── Z-index layer map ───────────────────────────────── */
      zIndex: {
        globe:    '0',   // full-screen 3D map background
        overlay:  '10',  // map overlay controls (layer toggles, legend)
        panel:    '20',  // side panels
        hud:      '30',  // HUD elements (coord display, status)
        header:   '40',  // top bar
        session:  '50',  // session status bar (bottom)
        toast:    '60',  // toast notifications
        modal:    '70',  // modals / dialogs
      },

      /* ── Animations ──────────────────────────────────────── */
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.2' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        blastRing: {
          '0%':   { transform: 'translate(-50%,-50%) scale(0.5)', opacity: '0.4' },
          '100%': { transform: 'translate(-50%,-50%) scale(1.5)', opacity: '0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-slow':   'pulse 1.5s ease-in-out infinite',
        'pulse-fast':   'pulse 0.8s ease-in-out infinite',
        'slide-up':     'slideUp 0.2s ease-out',
        'fade-in':      'fadeIn 0.4s ease-out',
        'blast-ring':   'blastRing 2s ease-out infinite',
        'spin-slow':    'spin 0.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
