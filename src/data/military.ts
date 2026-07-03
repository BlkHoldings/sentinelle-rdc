import type { MilPosition } from '@/types/intel';

/**
 * Ordre de bataille — Est-DRC, etat au 02 Jul 2026.
 * Sources: UN GoE S/2024/432, MONUSCO JMAC, OSINT SAR Sentinel-1.
 */
export const MIL_POSITIONS: MilPosition[] = [
  /* ── QG / Centres de commandement ────────────────── */
  {
    n: 'QG M23/RDF — Rumangabo', lt: -1.40, ln: 29.38, t: 'hq', s: '✦',
    c: 'var(--color-mag)',
    d: "PC integre M23/RDF. 4-6K combattants RDF (GoE S/2024/432). Systemes AA confirmes. ISR nocturne : ~200 pers. actifs, 12 signatures thermiques vehicules.",
  },
  {
    n: 'Admin M23 — Goma', lt: -1.68, ln: 29.22, t: 'hq', s: '✦',
    c: 'var(--color-mag)',
    d: "QG d'occupation M23. Ville tombee 27 jan 2026. Aeroport capture. Controle aerien et maritime (Lac Kivu) exerce.",
  },
  {
    n: 'Admin M23 — Bukavu', lt: -2.51, ln: 28.86, t: 'hq', s: '✦',
    c: 'var(--color-mag)',
    d: "Occupation M23. Tombee 5 fev 2026. 450K residents. Pillages documentes HRW. Acces humanitaire restreint.",
  },
  {
    n: "PC avance M23 — Walikale", lt: -1.42, ln: 28.04, t: 'hq', s: '✦',
    c: 'var(--color-mag)',
    d: "Nouveau PC apres prise de Walikale (28 mai 2026). Controle axes miniers coltan/cassiterite. Extension vers l'ouest en cours.",
  },
  /* ── Artillerie ───────────────────────────────────── */
  {
    n: 'Artillerie — Hauteurs Masisi', lt: -1.40, ln: 28.80, t: 'arty', s: '◆',
    c: 'var(--color-pur)',
    d: "2x mortiers 120mm actifs. Flash de bouche 05:45 UTC (ISR drone). Azimut SE vers Sake. Activite persistante sur RN2.",
  },
  {
    n: 'Artillerie RDF — Gisenyi', lt: -1.71, ln: 29.25, t: 'arty', s: '◆',
    c: 'var(--color-pur)',
    d: "Systemes 122mm RDF en couverture frontiere Rwanda. Portee nord de Goma confirmee lors de la chute de la ville (jan 2026).",
  },
  /* ── Checkpoints ──────────────────────────────────── */
  {
    n: 'Checkpoint — Sake-Minova', lt: -1.62, ln: 28.95, t: 'cp', s: '⬧',
    c: 'var(--color-alert)',
    d: "Checkpoint M23. 2 pick-up armes. Changement detection <72h. Controle acces humanitaire vers le Sud-Kivu.",
  },
  {
    n: 'Frontiere — Bunagana', lt: -1.28, ln: 29.49, t: 'cp', s: '⬧',
    c: 'var(--color-alert)',
    d: "Sous controle M23 depuis juin 2022. Point d'entree RDF principal. 2K renforts confirmes jan 2026. Trafic militaire documente.",
  },
  {
    n: 'Checkpoint — Axe Kavumu', lt: -2.38, ln: 28.80, t: 'cp', s: '⬧',
    c: 'var(--color-alert)',
    d: "Checkpoint M23 sur axe Bukavu-Kavumu. Blocages de convois medicaux MSF signales. Passage sous autorisation M23.",
  },
  /* ── Logistique ───────────────────────────────────── */
  {
    n: 'Logistique RDF — Gisenyi', lt: -1.70, ln: 29.26, t: 'log', s: '⬧',
    c: 'var(--color-alert)',
    d: "Corridor logistique principal RDF depuis le Rwanda. 14+ camions/jour (+200% baseline). Carburant, munitions, renforts. Suivi UAV MONUSCO.",
  },
  /* ── Groupes armes non-etatiques ──────────────────── */
  {
    n: 'ADF/ISCAP — Foret Mambasa', lt: 1.38, ln: 29.05, t: 'camp', s: '⬡',
    c: 'var(--color-amb)',
    d: "3 clusters thermiques VIIRS + ISR. 20-30 individus/site. Affiliation ISCAP. Bases mobiles foret equatoriale. Coordination reseau Beni.",
  },
  {
    n: 'ADF — Zone Beni-Oicha', lt: 0.60, ln: 29.50, t: 'camp', s: '⬡',
    c: 'var(--color-amb)',
    d: "Zone operationnelle principale ADF. 1 000+ civils/an. Raids nocturnes, machettes. Operations conjointes FARDC-UPDF actives.",
  },
  {
    n: 'CODECO — Territoire Djugu', lt: 1.90, ln: 30.50, t: 'camp', s: '⬡',
    c: 'var(--color-amb)',
    d: "Milice Lendu. Attaques IDP recurrentes. ~30 combattants (ISR drone). Fragmentation en 3 factions (mai 2026). Axes miniers disputes.",
  },
  /* ── Naval ────────────────────────────────────────── */
  {
    n: 'Formation navale — Lac Kivu', lt: -1.75, ln: 29.18, t: 'nav', s: '▲',
    c: 'var(--color-blu)',
    d: "4 bateaux motorises formation tactique. Profil non-peche confirme. Cap Idjwi, 14 noeuds. Suivi UAV-003 (Falco EVO).",
  },
  /* ── Camps de deplaces ────────────────────────────── */
  {
    n: 'Camp IDP — Mugunga III', lt: -1.72, ln: 29.12, t: 'idp', s: '△',
    c: 'var(--color-grn)',
    d: "~180K deplaces. 60% structures endommagees (BDA). Controle M23 depuis 27 jan. Incident 30 jan : 3 KIA dans le camp.",
  },
  {
    n: 'Camp IDP — Bulengo', lt: -1.70, ln: 29.10, t: 'idp', s: '△',
    c: 'var(--color-grn)',
    d: "~120K deplaces. Territoire M23. Acces difficile. Stocks alimentaires critiques (PAM, juin 2026).",
  },
  {
    n: 'Camp IDP — Kanyaruchinya', lt: -1.58, ln: 29.25, t: 'idp', s: '△',
    c: 'var(--color-grn)',
    d: "~85K deplaces. Position de premiere ligne. Tirs documentes a 1,2 km. Risque civil critique.",
  },
  {
    n: 'Camp IDP — Plaine Shari', lt: 1.80, ln: 30.30, t: 'idp', s: '△',
    c: 'var(--color-grn)',
    d: "~45K deplaces (Djugu, Ituri). Menace CODECO. MSF present. Attaque 22 avr 2026 : 11 KIA dans le camp.",
  },
  {
    n: 'Camp IDP — Uvira', lt: -3.39, ln: 29.13, t: 'idp', s: '△',
    c: 'var(--color-grn)',
    d: "~30K deplaces (avancee M23 vers Uvira, juin 2026). UNHCR operationnel depuis 25 juin. Acces limite par combats sur RN5.",
  },
];
