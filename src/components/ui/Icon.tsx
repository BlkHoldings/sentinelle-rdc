/* Line icons, drawn on a 16-unit grid at one stroke weight so they sit
   together as a set. Inline SVG: no icon font, no extra request, and
   they inherit the text colour. Always decorative — the accessible name
   belongs to the control that contains the icon. */

const P: Record<string, string> = {
  grid:     'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  pulse:    'M1.5 8h3l1.5-4 3 8 1.5-4h4',
  target:   'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 1v2M8 13v2M1 8h2M13 8h2',
  map:      'M1.5 4l4-1.5 5 1.5 4-1.5v9.5l-4 1.5-5-1.5-4 1.5zM5.5 2.5v9.5M10.5 4v9.5',
  bars:     'M2.5 13.5v-5M6.2 13.5v-9M9.8 13.5v-6.5M13.5 13.5V3',
  people:   'M5.5 7a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM1.5 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4M10.8 7a1.9 1.9 0 1 0 0-3.8M11.5 9.6c1.8.3 3 1.8 3 3.9',
  doc:      'M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3M6 8h4.5M6 10.5h4.5',
  alert:    'M8 2L14.5 13.5h-13zM8 6.5v3.5M8 11.6v.4',
  database: 'M2.5 4c0-1.2 2.5-2.2 5.5-2.2s5.5 1 5.5 2.2-2.5 2.2-5.5 2.2S2.5 5.200 2.5 4zM2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2',
  scale:    'M8 2v12M3.500 14h9M2 9l2-5 2 5a2 2 0 0 1-4 0zM10 9l2-5 2 5a2 2 0 0 1-4 0zM4 4h8',
  flow:     'M2 4h4l4 8h4M2 12h4l1.200-2.400M10 4h4M8.800 6.400L10 4',
  layers:   'M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3',
  nodes:    'M4 4.5a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3zM12 8.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3zM5 14.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3zM5.300 3.700l5.300 2.600M10.700 7.900l-4.500 3.900',
  spark:    'M8 1.500v4M8 10.500v4M1.500 8h4M10.500 8h4M3.500 3.500l2.300 2.300M10.200 10.200l2.300 2.300M12.500 3.500l-2.300 2.300M5.800 10.200l-2.300 2.300',
  route:    'M3.500 5.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12.500 14.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3.500 5.500v3a3 3 0 0 0 3 3h4',
  compass:  'M8 1.500a6.500 6.500 0 1 0 0 13 6.500 6.500 0 0 0 0-13zM10.500 5.500l-1.500 3.500-3.500 1.500 1.500-3.500z',
  folder:   'M1.500 3.500h4.500l1.500 2h7v7.500h-13z',
  hex:      'M8 1.500l5.500 3.200v6.600L8 14.500l-5.500-3.200V4.700z',
  signal:   'M2.500 13.500v-2M6.200 13.500v-5M9.800 13.500v-8M13.500 13.500v-11',
  chat:     'M2 3h12v8H7l-3.500 3v-3H2z',
  check:    'M3 2h10v12H3zM5.500 8l2 2 3.500-4',
  list:     'M5.500 4h8.500M5.500 8h8.500M5.500 12h8.500M2 4h.500M2 8h.500M2 12h.500',
  gear:     'M8 5.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5zM8 1.500v2M8 12.500v2M1.500 8h2M12.500 8h2M3.400 3.400l1.400 1.400M11.200 11.200l1.400 1.400M12.600 3.400l-1.400 1.400M4.800 11.200l-1.400 1.400',
  search:   'M7 2.500a4.500 4.500 0 1 0 0 9 4.500 4.500 0 0 0 0-9zM10.300 10.300l3.200 3.200',
  bell:     'M4 11V7.500a4 4 0 0 1 8 0V11l1.500 1.500h-11zM6.500 14h3',
  user:     'M8 7.500a2.800 2.800 0 1 0 0-5.600 2.800 2.800 0 0 0 0 5.600zM2.500 14c0-2.800 2.500-4.500 5.500-4.500s5.500 1.700 5.500 4.500',
  sync:     'M2.500 8a5.500 5.500 0 0 1 9.700-3.500M13.500 8a5.500 5.500 0 0 1-9.700 3.500M12.500 1.500v3h-3M3.500 14.500v-3h3',
  chevL:    'M10 3L5 8l5 5',
  chevR:    'M6 3l5 5-5 5',
  chevD:    'M3 6l5 5 5-5',
  close:    'M3.500 3.500l9 9M12.500 3.500l-9 9',
  menu:     'M2 4h12M2 8h12M2 12h12',
  external: 'M9 2.500h4.500V7M13.500 2.500L7.500 8.500M11.500 9.500v4h-9v-9h4',
  pin:      'M8 14.500s4.500-4.300 4.500-7.800a4.500 4.500 0 0 0-9 0c0 3.500 4.500 7.800 4.500 7.800zM8 5a1.700 1.700 0 1 0 0 3.400A1.700 1.700 0 0 0 8 5z',
  clock:    'M8 1.500a6.500 6.500 0 1 0 0 13 6.500 6.500 0 0 0 0-13zM8 4.500V8l2.500 1.500',
  panel:    'M1.500 2.500h13v11h-13zM10 2.500v11',
  globe:    'M8 1.500a6.500 6.500 0 1 0 0 13 6.500 6.500 0 0 0 0-13zM1.500 8h13M8 1.500c2 2 2 11 0 13M8 1.500c-2 2-2 11 0 13',
};

export type IconName =
  | 'grid' | 'pulse' | 'target' | 'map' | 'bars' | 'people' | 'doc' | 'alert' | 'database'
  | 'scale' | 'flow' | 'layers' | 'nodes' | 'spark' | 'route' | 'compass' | 'folder' | 'hex'
  | 'signal' | 'chat' | 'check' | 'list' | 'gear' | 'search' | 'bell' | 'user' | 'sync'
  | 'chevL' | 'chevR' | 'chevD' | 'close' | 'menu' | 'external' | 'pin' | 'clock' | 'panel' | 'globe';

export default function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"
      stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path d={P[name]} />
    </svg>
  );
}
