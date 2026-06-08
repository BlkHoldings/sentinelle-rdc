import type { DroneRecord } from '@/types/intel';

/**
 * MONUSCO UAV (Falco EVO / ScanEagle) operational records + drone strike intelligence.
 * Based on MONUSCO UAS operations reports and OCHA/UN sitreps for eastern DRC.
 */
export const DRONE_ISR: DroneRecord[] = [
  {
    id: 'UAV-001', time: '11:45 UTC', type: 'ISR Patrol',
    platform: 'Falco EVO', base: 'Goma', alt: '4,500m',
    lat: -1.55, lon: 29.30,
    desc: 'MONUSCO ISR sortie over Kibumba-Rumangabo corridor. Observed 6 military trucks on RN2, heading south. 2 technical vehicles with mounted weapons at Kibumba junction.',
    status: 'COMPLETED', classification: 'movement',
  },
  {
    id: 'UAV-002', time: '10:20 UTC', type: 'Reconnaissance',
    platform: 'ScanEagle', base: 'Beni', alt: '3,000m',
    lat: 0.52, lon: 29.48,
    desc: 'ISR sweep Beni-Oicha axis. Detected 2 suspected ADF camps in forest canopy 8km NE of Oicha. Thermal signatures: 15-20 individuals per site. Forwarded to FARDC G2.',
    status: 'COMPLETED', classification: 'camp',
  },
  {
    id: 'UAV-003', time: '09:15 UTC', type: 'Maritime Patrol',
    platform: 'Falco EVO', base: 'Goma', alt: '3,500m',
    lat: -1.85, lon: 29.15,
    desc: 'Lake Kivu maritime surveillance. 4 motorized boats in tactical formation, 3.5km from shore near Minova. Speed 14 knots heading SE toward Idjwi. Non-fishing profile confirmed.',
    status: 'COMPLETED', classification: 'naval',
  },
  {
    id: 'UAV-004', time: '08:00 UTC', type: 'Border Monitoring',
    platform: 'Falco EVO', base: 'Goma', alt: '5,000m',
    lat: -1.70, lon: 29.25,
    desc: 'Gisenyi-Goma border crossing. Heavy vehicle traffic from Rwanda: 14 trucks crossed 06:00-08:00. 3 military-type vehicles observed. Border post under M23 control.',
    status: 'COMPLETED', classification: 'logistics',
  },
  {
    id: 'UAV-005', time: '14:30 UTC', type: 'ISR Patrol',
    platform: 'ScanEagle', base: 'Bunia', alt: '3,000m',
    lat: 1.80, lon: 30.32,
    desc: 'Djugu territory patrol. Plaine Shari IDP camp: ~45K displaced. CODECO militia positions identified 4km west. 3 armed groups, ~30 fighters total.',
    status: 'IN PROGRESS', classification: 'camp',
  },
  {
    id: 'UAV-006', time: '13:00 UTC', type: 'Damage Assessment',
    platform: 'Falco EVO', base: 'Goma', alt: '4,000m',
    lat: -1.72, lon: 29.12,
    desc: 'Post-conflict BDA over Mugunga III camp. ~60% structures damaged/destroyed since Jan 27 assault. New construction detected NE sector.',
    status: 'COMPLETED', classification: 'humanitarian',
  },
  {
    id: 'UAV-007', time: '07:30 UTC', type: 'Night ISR',
    platform: 'Falco EVO (IR)', base: 'Goma', alt: '4,500m',
    lat: -1.40, lon: 29.38,
    desc: 'Rumangabo base night surveillance (IR sensor). ~200 personnel active, 12 vehicle heat signatures, 3 active generators. Consistent with reinforced garrison.',
    status: 'COMPLETED', classification: 'installation',
  },
  {
    id: 'UAV-008', time: '15:00 UTC', type: 'Humanitarian Corridor',
    platform: 'Zipline UAS', base: 'Bukavu', alt: '150m',
    lat: -2.48, lon: 28.88,
    desc: 'Medical supply delivery Bukavu→Kalehe. Blood products and emergency medications. Route confirmed clear. 3rd delivery run this week.',
    status: 'IN PROGRESS', classification: 'humanitarian',
  },
  {
    id: 'UAV-009', time: '06:00 UTC', type: 'Artillery Spotting',
    platform: 'ScanEagle', base: 'Goma', alt: '3,500m',
    lat: -1.42, lon: 28.82,
    desc: 'Masisi heights artillery position monitoring. 2 mortar positions confirmed active (muzzle flash 05:45 UTC). Firing azimuth: SE toward Sake. 120mm caliber estimated.',
    status: 'COMPLETED', classification: 'artillery',
  },
  {
    id: 'UAV-010', time: '12:15 UTC', type: 'Road Surveillance',
    platform: 'Falco EVO', base: 'Beni', alt: '4,000m',
    lat: 0.05, lon: 29.72,
    desc: 'Kasindi border crossing. ~800 civilian crossings in 3h window. 4 overloaded cargo trucks without manifest. Flagged to FARDC customs.',
    status: 'COMPLETED', classification: 'logistics',
  },
  {
    id: 'STRIKE-001', time: '03:12 UTC', type: 'Drone Strike',
    platform: 'Unknown UAS (RDF)', base: 'Rwanda', alt: '~1,200m',
    lat: -1.57, lon: 29.31,
    desc: 'CRITICAL: Pre-dawn strike on FARDC forward bunker near Kibumba. DJI Matrice 300 modified with ~2kg IED. 3 FARDC KIA, 7 WIA. First confirmed lethal drone strike in sector since Feb 2026.',
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-002', time: '04:47 UTC', type: 'Drone Strike',
    platform: 'Unknown UAS (RDF)', base: 'Rwanda', alt: '~800m',
    lat: -1.62, lon: 29.18,
    desc: 'Second strike on Wazalendo camp west of Goma. 2 explosions confirmed by FIRMS thermal. 5 militia KIA. IDP camp Mugunga III 1.2km east — no civilian casualties reported.',
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-003', time: '06:30 UTC', type: 'Drone Strike',
    platform: 'Unknown UAS (suspected RDF)', base: 'Rwanda', alt: '~1,000m',
    lat: -1.54, lon: 29.08,
    desc: 'FARDC logistics depot hit on Sake road. Secondary explosions 20min. VIIRS pass at 07:45 confirms thermal signature. 1 KIA, 4 WIA. Bayraktar-type loitering munition suspected.',
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-004', time: '09:55 UTC', type: 'Drone Attack (Failed)',
    platform: 'Modified commercial UAS', base: 'Unknown', alt: '~500m',
    lat: -1.67, lon: 29.20,
    desc: 'Failed drone attack intercepted over central Goma. DJI M300 with fragmentation IED (~1.5kg) crashed in Himbi neighborhood after malfunction. No detonation. MONUSCO EOD recovered device.',
    status: 'INTERCEPTED', classification: 'strike',
  },
  {
    id: 'STRIKE-005', time: '13:28 UTC', type: 'Drone Strike',
    platform: 'Loitering Munition', base: 'M23 territory', alt: '~2,000m',
    lat: -1.48, lon: 29.28,
    desc: 'LATEST: Kamikaze drone struck Wazalendo defensive position north of Goma. 4 fighters KIA, position destroyed. Circled ~15 min before diving. Consistent with Mohajer-6/Ababil-type UAS (unconfirmed).',
    status: 'CONFIRMED STRIKE', classification: 'strike',
  },
  {
    id: 'STRIKE-006', time: '15:45 UTC', type: 'Drone Recon (Strike Package)',
    platform: 'Wing Loong II (suspected)', base: 'Possible Kigali', alt: '~5,500m',
    lat: -1.65, lon: 29.25,
    desc: 'HIGH ALTITUDE: MONUSCO radar detects MALE UAS at FL180 over Goma in racetrack orbit (ISR/strike profile). Duration 3+ hours. Rwanda known to have acquired Chinese MALE drones. NO STRIKE EXECUTED — threat elevated.',
    status: 'TRACKING — LIVE', classification: 'strike',
  },
  {
    id: 'RECON-011', time: '16:10 UTC', type: 'Post-Strike BDA',
    platform: 'Falco EVO', base: 'Goma (MONUSCO)', alt: '3,500m',
    lat: -1.57, lon: 29.31,
    desc: 'MONUSCO post-strike BDA over STRIKE-001 site (Kibumba). Crater ~3m diameter, destroyed bunker, 2 damaged vehicles. Civilian structures 200m east undamaged. Evidence for UN Security Council briefing.',
    status: 'IN PROGRESS', classification: 'strike_bda',
  },
];
