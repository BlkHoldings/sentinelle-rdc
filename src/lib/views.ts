/* Every destination in the application, and how the navigation groups
   them. The nav, the page router and the keyboard shortcuts all read
   this one list. */

import type { IconName } from '@/components/ui/Icon';
import type { MsgKey } from '@/lib/i18n';

export type ViewKey =
  /* Primary */
  | 'overview' | 'live' | 'incidents' | 'map' | 'regional' | 'humanitarian'
  | 'reports' | 'anomalies' | 'data' | 'settings'
  /* Analysis */
  | 'triage' | 'fusion' | 'intelligence' | 'entities' | 'effects' | 'logistics' | 'planning'
  /* Strategic records */
  | 'dossiers' | 'entites' | 'signaux' | 'atelier' | 'rapports' | 'journal';

export interface NavItem {
  key: ViewKey; label: MsgKey; icon: IconName;
  /** Built on the illustrative datasets; hidden unless demonstration mode is on. */
  demoOnly?: boolean;
}
export interface NavGroup { id: string; label: MsgKey | null; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    id: 'primary', label: null,
    items: [
      { key: 'overview',     label: 'nav.overview',     icon: 'grid' },
      { key: 'live',         label: 'nav.live',         icon: 'pulse' },
      { key: 'incidents',    label: 'nav.incidents',    icon: 'target' },
      { key: 'map',          label: 'nav.map',          icon: 'map' },
      { key: 'regional',     label: 'nav.regional',     icon: 'bars' },
      { key: 'humanitarian', label: 'nav.humanitarian', icon: 'people' },
      { key: 'reports',      label: 'nav.reports',      icon: 'doc' },
      { key: 'anomalies',    label: 'nav.anomalies',    icon: 'alert' },
      { key: 'data',         label: 'nav.data',         icon: 'database' },
    ],
  },
  {
    id: 'analysis', label: 'nav.group.analysis',
    items: [
      { key: 'triage',       label: 'nav.triage',       icon: 'scale' },
      { key: 'fusion',       label: 'nav.fusion',       icon: 'flow' },
      { key: 'intelligence', label: 'nav.intelligence', icon: 'layers', demoOnly: true },
      { key: 'entities',     label: 'nav.entities',     icon: 'nodes', demoOnly: true },
      { key: 'effects',      label: 'nav.effects',      icon: 'spark', demoOnly: true },
      { key: 'logistics',    label: 'nav.logistics',    icon: 'route', demoOnly: true },
      { key: 'planning',     label: 'nav.planning',     icon: 'compass', demoOnly: true },
    ],
  },
  {
    id: 'strategic', label: 'nav.group.strategic',
    items: [
      { key: 'dossiers', label: 'nav.dossiers', icon: 'folder' },
      { key: 'entites',  label: 'nav.entites',  icon: 'hex' },
      { key: 'signaux',  label: 'nav.signaux',  icon: 'signal' },
      { key: 'atelier',  label: 'nav.atelier',  icon: 'chat' },
      { key: 'rapports', label: 'nav.rapports', icon: 'check' },
      { key: 'journal',  label: 'nav.journal',  icon: 'list' },
    ],
  },
  {
    id: 'system', label: null,
    items: [{ key: 'settings', label: 'nav.settings', icon: 'gear' }],
  },
];

/** Views that replace the map area with a full working surface. */
export const WORKSPACE_VIEWS: ViewKey[] = [
  'live', 'regional', 'humanitarian', 'reports', 'anomalies', 'data', 'settings',
  'triage', 'fusion', 'dossiers', 'entites', 'signaux', 'atelier', 'rapports', 'journal',
];

export const ALL_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
