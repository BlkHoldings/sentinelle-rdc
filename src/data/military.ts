import type { MilPosition } from '@/types/intel';

/**
 * Military order of battle — Eastern DRC.
 * Sourced from UN Group of Experts reports, MONUSCO JMAC, and OSINT.
 */
export const MIL_POSITIONS: MilPosition[] = [
  {
    n: 'QG M23/RDF — Rumangabo',   lt: -1.40, ln: 29.38, t: 'hq',   s: '✦',
    c: 'var(--color-mag)',
    d: 'Integrated M23/RDF command post. 4-6K RDF troops (UN GoE S/2024/432). AA systems confirmed. Primary C2 node.',
  },
  {
    n: 'M23 Admin — Goma',         lt: -1.68, ln: 29.22, t: 'hq',   s: '✦',
    c: 'var(--color-mag)',
    d: 'M23 occupation HQ. City fell 27 Jan 2026. Airport captured. FARDC/MONUSCO positions overrun.',
  },
  {
    n: 'M23 Admin — Bukavu',       lt: -2.51, ln: 28.86, t: 'hq',   s: '✦',
    c: 'var(--color-mag)',
    d: 'M23 occupation. City fell 5 Feb 2026. 450K residents under M23 control. Systematic looting documented (HRW).',
  },
  {
    n: 'Artillery — Masisi Heights', lt: -1.40, ln: 28.80, t: 'arty', s: '◆',
    c: 'var(--color-pur)',
    d: '2× 120mm mortars active. Drone ISR: muzzle flash 05:45 UTC. Firing azimuth SE toward Sake.',
  },
  {
    n: 'Checkpoint — Sake-Minova', lt: -1.62, ln: 28.95, t: 'cp',   s: '⬧',
    c: 'var(--color-alert)',
    d: 'New M23 checkpoint. 2 armed technicals. Change detection <72h. Controls humanitarian access.',
  },
  {
    n: 'RDF Logistics — Gisenyi',  lt: -1.70, ln: 29.26, t: 'log',  s: '⬧',
    c: 'var(--color-alert)',
    d: 'Main RDF supply corridor from Rwanda. 14 trucks/day (+200% vs baseline). Fuel, ammunition, reinforcements.',
  },
  {
    n: 'Bunagana — M23 Border Post', lt: -1.28, ln: 29.49, t: 'cp',  s: '⬧',
    c: 'var(--color-alert)',
    d: 'M23-controlled since Jun 2022. Primary RDF entry point. 2K additional RDF confirmed Jan 2026.',
  },
  {
    n: 'ADF/ISCAP — Mambasa Forest', lt: 1.38,  ln: 29.05, t: 'camp', s: '⬡',
    c: 'var(--color-amb)',
    d: '3 thermal clusters confirmed by VIIRS and drone ISR. 20-30 individuals/site. ISCAP-affiliated.',
  },
  {
    n: 'ADF — Beni-Oicha Zone',    lt: 0.60,  ln: 29.50, t: 'camp', s: '⬡',
    c: 'var(--color-amb)',
    d: 'Primary ADF operational zone. 1,000+ civilian deaths/year. Night raids, machete attacks.',
  },
  {
    n: 'CODECO — Djugu Territory', lt: 1.90,  ln: 30.50, t: 'camp', s: '⬡',
    c: 'var(--color-amb)',
    d: 'Lendu militia. Recurring attacks on IDP camps. Drone ISR confirms ~30 fighters.',
  },
  {
    n: 'Naval Formation — Lake Kivu', lt: -1.75, ln: 29.18, t: 'nav', s: '▲',
    c: 'var(--color-blu)',
    d: '4 motorized boats in tactical formation. Non-fishing profile. Heading toward Idjwi Island.',
  },
  {
    n: 'IDP Camp — Mugunga III',   lt: -1.72, ln: 29.12, t: 'idp',  s: '△',
    c: 'var(--color-grn)',
    d: '~180K displaced. 60% structures damaged (drone BDA). Under M23 control since Jan 27.',
  },
  {
    n: 'IDP Camp — Bulengo',       lt: -1.70, ln: 29.10, t: 'idp',  s: '△',
    c: 'var(--color-grn)',
    d: '~120K displaced. Located inside M23-controlled territory. OCHA reports access difficulties.',
  },
  {
    n: 'IDP Camp — Kanyaruchinya', lt: -1.58, ln: 29.25, t: 'idp',  s: '△',
    c: 'var(--color-grn)',
    d: '~85K displaced. Frontline position near active combat zone. High civilian protection risk.',
  },
  {
    n: 'IDP Camp — Plaine Shari',  lt: 1.80,  ln: 30.30, t: 'idp',  s: '△',
    c: 'var(--color-grn)',
    d: '~45K displaced (Djugu, Ituri). Under CODECO threat. MSF active medical presence.',
  },
];
