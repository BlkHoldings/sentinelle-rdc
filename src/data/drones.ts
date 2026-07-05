import type { DroneRecord } from '@/types/intel';

/**
 * MONUSCO UAV ops (Falco EVO / ScanEagle) + frappes de drones.
 * Sources: MONUSCO UAS ops reports, OCHA/UN sitreps, OSINT.
 * Mis a jour au 02 Jul 2026.
 */
export const DRONE_ISR: DroneRecord[] = [
  /* ── Sorties ISR MONUSCO ────────────────────────── */
  {
    id: 'UAV-001', time: '11:45 UTC', type: 'ISR Patrol',
    platform: 'Falco EVO', base: 'Goma', alt: '4 500m',
    lat: -1.55, lon: 29.30,
    desc: "Sortie ISR corridor Kibumba-Rumangabo. 6 camions militaires sur RN2 cap sud. 2 pick-up armes au carrefour Kibumba.",
    status: 'COMPLETED', classification: 'movement',
  },
  {
    id: 'UAV-002', time: '10:20 UTC', type: 'Reconnaissance',
    platform: 'ScanEagle', base: 'Beni', alt: '3 000m',
    lat: 0.52, lon: 29.48,
    desc: "Balayage ISR axe Beni-Oicha. 2 camps ADF en foret 8 km NE d'Oicha. Signatures thermiques 15-20 individus/site. Transmis G2 FARDC.",
    status: 'COMPLETED', classification: 'camp',
  },
  {
    id: 'UAV-003', time: '09:15 UTC', type: 'Maritime Patrol',
    platform: 'Falco EVO', base: 'Goma', alt: '3 500m',
    lat: -1.85, lon: 29.15,
    desc: "Surveillance maritime Lac Kivu. 4 bateaux motorises formation tactique, 3,5 km du rivage. Vitesse 14 noeuds cap SE vers Idjwi. Profil non-peche confirme.",
    status: 'COMPLETED', classification: 'naval',
  },
  {
    id: 'UAV-004', time: '08:00 UTC', type: 'Border Monitoring',
    platform: 'Falco EVO', base: 'Goma', alt: '5 000m',
    lat: -1.70, lon: 29.25,
    desc: "Frontiere Gisenyi-Goma. 14 camions entre 06:00 et 08:00. 3 vehicules type militaire. Poste frontiere sous controle M23.",
    status: 'COMPLETED', classification: 'logistics',
  },
  {
    id: 'UAV-005', time: '14:30 UTC', type: 'ISR Patrol',
    platform: 'ScanEagle', base: 'Bunia', alt: '3 000m',
    lat: 1.80, lon: 30.32,
    desc: "Patrouille territoire Djugu. Camp IDP Plaine Shari : ~45K deplaces. Positions CODECO identifiees a 4 km ouest. ~30 combattants.",
    status: 'IN PROGRESS', classification: 'camp',
  },
  {
    id: 'UAV-006', time: '13:00 UTC', type: 'Damage Assessment',
    platform: 'Falco EVO', base: 'Goma', alt: '4 000m',
    lat: -1.72, lon: 29.12,
    desc: "BDA post-conflit camp Mugunga III. ~60% structures endommagees depuis l'assaut du 27 jan. Nouvelle construction detectable secteur NE.",
    status: 'COMPLETED', classification: 'humanitarian',
  },
  {
    id: 'UAV-007', time: '07:30 UTC', type: 'Night ISR',
    platform: 'Falco EVO (IR)', base: 'Goma', alt: '4 500m',
    lat: -1.40, lon: 29.38,
    desc: "Surveillance nocturne base Rumangabo (capteur IR). ~200 personnels actifs, 12 signatures thermiques vehicules, 3 generateurs. Garnison renforcee confirmee.",
    status: 'COMPLETED', classification: 'installation',
  },
  {
    id: 'UAV-008', time: '15:00 UTC', type: 'Humanitarian Corridor',
    platform: 'Zipline UAS', base: 'Bukavu', alt: '150m',
    lat: -2.48, lon: 28.88,
    desc: "Livraison medicale Bukavu-Kalehe. Produits sanguins et medicaments urgence. Route degagee confirmee. 3e livraison cette semaine.",
    status: 'IN PROGRESS', classification: 'humanitarian',
  },
  {
    id: 'UAV-009', time: '06:00 UTC', type: 'Artillery Spotting',
    platform: 'ScanEagle', base: 'Goma', alt: '3 500m',
    lat: -1.42, lon: 28.82,
    desc: "Surveillance positions artillerie Masisi. 2 mortiers 120mm actifs (flash 05:45 UTC). Azimut SE vers Sake.",
    status: 'COMPLETED', classification: 'artillery',
  },
  {
    id: 'UAV-010', time: '12:15 UTC', type: 'Road Surveillance',
    platform: 'Falco EVO', base: 'Beni', alt: '4 000m',
    lat: 0.05, lon: 29.72,
    desc: "Frontiere Kasindi. ~800 traversees civiles en 3h. 4 camions cargo surcharges sans manifeste. Signales douanes FARDC.",
    status: 'COMPLETED', classification: 'logistics',
  },
  {
    id: 'UAV-011', time: '09:40 UTC', type: 'ISR Patrol',
    platform: 'Falco EVO', base: 'Goma', alt: '4 800m',
    lat: -1.42, lon: 28.05,
    desc: "ISR axe Walikale post-occupation M23 (28 mai). Convois M23 vers l'est confirmes. 3 vehicules blindes legers. Patrouille MONUSCO annulee faute d'escorte.",
    status: 'COMPLETED', classification: 'movement',
  },
  {
    id: 'UAV-012', time: '16:30 UTC', type: 'ISR Patrol',
    platform: 'ScanEagle', base: 'Goma', alt: '3 500m',
    lat: -3.42, lon: 29.15,
    desc: "Surveillance axe Uvira (offensive M23, juin 2026). Colonnes M23 approchant depuis Bukavu. FARDC en retraite visible. Camp IDP Uvira a 2 km.",
    status: 'COMPLETED', classification: 'movement',
  },
  /* ── Frappes de drones ──────────────────────────── */
  {
    id: 'STRIKE-001', time: '03:12 UTC', type: 'Drone Strike',
    platform: 'UAS inconnu (RDF)', base: 'Rwanda', alt: '~1 200m',
    lat: -1.57, lon: 29.31,
    desc: "CRITIQUE : Frappe avant l'aube sur bunker avance FARDC pres de Kibumba. DJI Matrice 300 modifie (~2 kg IED). 3 FARDC KIA, 7 blesses.",
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-002', time: '04:47 UTC', type: 'Drone Strike',
    platform: 'UAS inconnu (RDF)', base: 'Rwanda', alt: '~800m',
    lat: -1.62, lon: 29.18,
    desc: "2e frappe sur camp Wazalendo ouest de Goma. 2 explosions confirmees FIRMS. 5 miliciens KIA. Camp IDP Mugunga III a 1,2 km — aucune victime civile signalée.",
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-003', time: '06:30 UTC', type: 'Drone Strike',
    platform: 'UAS inconnu (RDF suspecte)', base: 'Rwanda', alt: '~1 000m',
    lat: -1.54, lon: 29.08,
    desc: "Depot logistique FARDC frappe, route de Sake. Explosions secondaires 20 min. VIIRS 07:45 confirme signature thermique. 1 KIA, 4 blesses.",
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-004', time: '09:55 UTC', type: 'Drone Attack (Failed)',
    platform: 'UAS commercial modifie', base: 'Inconnu', alt: '~500m',
    lat: -1.67, lon: 29.20,
    desc: "Attaque drone interceptee au-dessus de Goma centre. DJI M300 IED fragmentation (~1,5 kg) s'est ecrase a Himbi. Pas de detonation. EOD MONUSCO recupere l'engin.",
    status: 'INTERCEPTED', classification: 'strike',
  },
  {
    id: 'STRIKE-005', time: '13:28 UTC', type: 'Drone Strike',
    platform: 'Loitering Munition', base: 'Territoire M23', alt: '~2 000m',
    lat: -1.48, lon: 29.28,
    desc: "DERNIERE : Drone kamikaze frappe position defensive Wazalendo nord de Goma. 4 combattants KIA. Orbite ~15 min avant plongee. Type Mohajer-6/Ababil (non confirme).",
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-006', time: '15:45 UTC', type: 'Drone Recon (Strike Package)',
    platform: 'Wing Loong II (suspecte)', base: 'Kigali probable', alt: '~5 500m',
    lat: -1.65, lon: 29.25,
    desc: "HAUTE ALTITUDE : Radar MONUSCO detecte MALE UAS FL180 au-dessus de Goma en orbite racetrack (profil ISR/frappe). Duree 3h+. Rwanda connu pour acquisition MALE chinois. AUCUNE FRAPPE — menace elevee.",
    status: 'TRACKING — LIVE', classification: 'strike',
  },
  {
    id: 'STRIKE-007', time: '22:15 UTC', type: 'Drone Strike',
    platform: 'Loitering Munition', base: 'Territoire M23', alt: '~1 500m',
    lat: -1.62, lon: 29.18,
    desc: "NOUVELLE FRAPPE : Munition rodeuse frappe depot munitions Wazalendo ouest de Goma. Explosion secondaire massive (FIRMS). 2 combattants KIA. Residus type Shaheed-136 recuperes.",
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-008', time: '06:50 UTC', type: 'Drone Strike',
    platform: 'UAS inconnu (RDF)', base: 'Rwanda', alt: '~900m',
    lat: -1.57, lon: 28.97,
    desc: "Frappe sur colonne Wazalendo axe Sake-Minova. Pick-up arme detruit. 3 KIA. 5e frappe letale sur ce vecteur en 30 jours.",
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'RECON-011', time: '16:10 UTC', type: 'Post-Strike BDA',
    platform: 'Falco EVO', base: 'Goma (MONUSCO)', alt: '3 500m',
    lat: -1.57, lon: 29.31,
    desc: "BDA post-frappe site STRIKE-001 (Kibumba). Cratere ~3m diametre, bunker detruit, 2 vehicules endommages. Elements de preuve pour briefing CSNU.",
    status: 'IN PROGRESS', classification: 'strike_bda',
  },

  /* ── Fronts sud : Fizi / Minembwe / Uvira ────────── */
  {
    id: 'UAV-012', time: '08:40 UTC', type: 'ISR Patrol',
    platform: 'ScanEagle', base: 'Uvira', alt: '3 200m',
    lat: -4.30, lon: 28.94,
    desc: "Sortie ISR territoire de Fizi. Concentrations Mai-Mai Yakutumba au sud de Fizi-centre, ~40 combattants, 4 pick-up. Trafic fluvial suspect sur le littoral Tanganyika vers Baraka.",
    status: 'COMPLETED', classification: 'movement',
  },
  {
    id: 'UAV-013', time: '11:20 UTC', type: 'Reconnaissance',
    platform: 'Falco EVO', base: 'Uvira', alt: '4 800m',
    lat: -3.63, lon: 28.66,
    desc: "Reconnaissance Hauts-Plateaux de Minembwe. Positions Twirwaneho/Gumino sur les cretes, tranchees visibles. Coalition Mai-Mai au nord. Aeroport de Minembwe sous garde FARDC.",
    status: 'IN PROGRESS', classification: 'installation',
  },
  {
    id: 'UAV-014', time: '05:50 UTC', type: 'Night ISR',
    platform: 'Falco EVO (IR)', base: 'Uvira', alt: '4 200m',
    lat: -4.10, lon: 29.10,
    desc: "Surveillance nocturne port de Baraka (capteur IR). Debarquements nocturnes, ~15 signatures thermiques, caisses transferees vers vehicules. Profil trafic d'armes/or presume.",
    status: 'COMPLETED', classification: 'logistics',
  },
  /* ── Front ouest : Walikale / axe RN3 ────────────── */
  {
    id: 'UAV-015', time: '09:30 UTC', type: 'ISR Patrol',
    platform: 'ScanEagle', base: 'Goma', alt: '3 400m',
    lat: -1.42, lon: 28.06,
    desc: "Patrouille ISR axe Masisi-Walikale (RN3). Colonne M23/RDF en progression ouest, ~8 vehicules. Site minier de Bisie (cassiterite) sous surveillance. Wazalendo en repli vers Walikale-centre.",
    status: 'IN PROGRESS', classification: 'movement',
  },
  /* ── Surveillance transfrontalière : Rwanda ──────── */
  {
    id: 'RECON-016', time: '02:15 UTC', type: 'Border Surveillance',
    platform: 'Falco EVO (IR)', base: 'Goma (MONUSCO)', alt: '5 000m',
    lat: -1.72, lon: 29.28,
    desc: "SURVEILLANCE TRANSFRONTALIERE (limite territoriale RDC). Mouvements logistiques nocturnes cote rwandais pres de Rubavu/Gisenyi. ~6 camions vers postes-frontieres Goma. Observation depuis espace aerien RDC, conforme mandat MONUSCO. Transmis GoE ONU.",
    status: 'COMPLETED', classification: 'logistics',
  },
  {
    id: 'RECON-017', time: '03:40 UTC', type: 'Border Surveillance',
    platform: 'ScanEagle', base: 'Bukavu', alt: '3 600m',
    lat: -2.52, lon: 28.88,
    desc: "Surveillance secteur frontalier Rusizi/Cyangugu (face Bukavu). Activite aux points de passage, trafic vehicules accru avant l'aube. Observation depuis limite territoriale RDC. Correlé avec signalements OSINT.",
    status: 'COMPLETED', classification: 'movement',
  },
];
