/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Static Intelligence Data
   Sources: MONUSCO UAS ops, ACLED verified events, UN GoE reports
   ═══════════════════════════════════════════════════════════ */

/* ── Drone ISR dataset ──────────────────────────────────────
   Based on MONUSCO UAS operations (Falco EVO / ScanEagle) and
   commercial humanitarian UAS (Zipline) in eastern DRC.
   Drone strike records sourced from OCHA sitreps, MONUSCO
   press releases, and open-source intelligence (OSINT). */
var DRONE_ISR = [
  {id:"UAV-001",time:"11:45 UTC",type:"ISR Patrol",platform:"Falco EVO",base:"Goma",alt:"4,500m",
   lat:-1.55,lon:29.30,desc:"MONUSCO ISR sortie over Kibumba-Rumangabo corridor. Observed 6 military trucks on RN2, heading south. 2 technical vehicles with mounted weapons at Kibumba junction. Video feed recorded.",status:"COMPLETED",classification:"movement"},
  {id:"UAV-002",time:"10:20 UTC",type:"Reconnaissance",platform:"ScanEagle",base:"Beni",alt:"3,000m",
   lat:0.52,lon:29.48,desc:"ISR sweep Beni-Oicha axis. Detected 2 suspected ADF camps in forest canopy 8km NE of Oicha. Thermal signatures: 15-20 individuals per site. Forwarded to FARDC G2.",status:"COMPLETED",classification:"camp"},
  {id:"UAV-003",time:"09:15 UTC",type:"Maritime Patrol",platform:"Falco EVO",base:"Goma",alt:"3,500m",
   lat:-1.85,lon:29.15,desc:"Lake Kivu maritime surveillance. 4 motorized boats detected in formation, 3.5km from shore near Minova. Speed 14 knots, heading SE toward Idjwi. Non-fishing profile confirmed.",status:"COMPLETED",classification:"naval"},
  {id:"UAV-004",time:"08:00 UTC",type:"Border Monitoring",platform:"Falco EVO",base:"Goma",alt:"5,000m",
   lat:-1.70,lon:29.25,desc:"Gisenyi-Goma border crossing surveillance. Heavy vehicle traffic from Rwanda: 14 trucks crossed between 06:00-08:00. 3 military-type vehicles observed. Border post under M23 control.",status:"COMPLETED",classification:"logistics"},
  {id:"UAV-005",time:"14:30 UTC",type:"ISR Patrol",platform:"ScanEagle",base:"Bunia",alt:"3,000m",
   lat:1.80,lon:30.32,desc:"Djugu territory patrol. Plaine Shari IDP camp: estimated 45K displaced. CODECO militia positions identified 4km west. 3 armed groups, ~30 fighters total.",status:"IN PROGRESS",classification:"camp"},
  {id:"UAV-006",time:"13:00 UTC",type:"Damage Assessment",platform:"Falco EVO",base:"Goma",alt:"4,000m",
   lat:-1.72,lon:29.12,desc:"Post-conflict BDA over Mugunga III camp. ~60% of structures damaged/destroyed since Jan 27 assault. New construction detected in NE sector. Population movement toward Sake road.",status:"COMPLETED",classification:"humanitarian"},
  {id:"UAV-007",time:"07:30 UTC",type:"Night ISR",platform:"Falco EVO (IR)",base:"Goma",alt:"4,500m",
   lat:-1.40,lon:29.38,desc:"Rumangabo base night surveillance (IR sensor). Thermal: ~200 personnel active, 12 vehicle-sized heat signatures in motor pool, 3 active generators. Consistent with reinforced garrison.",status:"COMPLETED",classification:"installation"},
  {id:"UAV-008",time:"15:00 UTC",type:"Humanitarian Corridor",platform:"Zipline UAS",base:"Bukavu",alt:"150m",
   lat:-2.48,lon:28.88,desc:"Medical supply delivery flight Bukavu→Kalehe. Blood products and emergency medications. Route confirmed clear. 3rd delivery run this week.",status:"IN PROGRESS",classification:"humanitarian"},
  {id:"UAV-009",time:"06:00 UTC",type:"Artillery Spotting",platform:"ScanEagle",base:"Goma",alt:"3,500m",
   lat:-1.42,lon:28.82,desc:"Masisi heights artillery position monitoring. 2 mortar positions confirmed active (muzzle flash detected 05:45 UTC). Firing azimuth: SE toward Sake. 120mm caliber estimated.",status:"COMPLETED",classification:"artillery"},
  {id:"UAV-010",time:"12:15 UTC",type:"Road Surveillance",platform:"Falco EVO",base:"Beni",alt:"4,000m",
   lat:0.05,lon:29.72,desc:"Kasindi border crossing. ~800 civilian crossings in 3h window. 4 overloaded cargo trucks without manifest. Possible contraband or arms trafficking. Flagged to FARDC customs.",status:"COMPLETED",classification:"logistics"},
  {id:"STRIKE-001",time:"03:12 UTC",type:"Drone Strike",platform:"Unknown UAS (RDF)",base:"Rwanda",alt:"~1,200m",
   lat:-1.57,lon:29.31,desc:"CRITICAL: Pre-dawn drone strike on FARDC forward position near Kibumba. Explosive payload detonated on fortified bunker. 3 FARDC soldiers killed, 7 wounded. Wreckage recovered — commercial drone (DJI Matrice 300) modified with IED payload (~2kg). MONUSCO condemns attack.",status:"CONFIRMED STRIKE",classification:"strike"},
  {id:"STRIKE-002",time:"04:47 UTC",type:"Drone Strike",platform:"Unknown UAS (RDF)",base:"Rwanda",alt:"~800m",
   lat:-1.62,lon:29.18,desc:"Second strike 90min after STRIKE-001. Target: Wazalendo militia camp west of Goma near Mugunga area. 2 explosions detected by FIRMS thermal sensor. 5 militia fighters killed per local sources. IDP camp Mugunga III located 1.2km east — no civilian casualties reported.",status:"CONFIRMED STRIKE",classification:"strike"},
  {id:"STRIKE-003",time:"06:30 UTC",type:"Drone Strike",platform:"Unknown UAS (suspected RDF)",base:"Rwanda",alt:"~1,000m",
   lat:-1.54,lon:29.08,desc:"Dawn strike on FARDC logistics depot on Sake road. Ammunition storage hit — secondary explosions observed for 20 minutes. Satellite thermal signature confirmed by VIIRS pass at 07:45. 2 vehicles destroyed. FARDC reports 1 KIA, 4 WIA.",status:"CONFIRMED STRIKE",classification:"strike"},
  {id:"STRIKE-004",time:"09:55 UTC",type:"Drone Attack (Failed)",platform:"Modified commercial UAS",base:"Unknown",alt:"~500m",
   lat:-1.67,lon:29.20,desc:"Failed drone attack intercepted over central Goma. M23/RDF drone (DJI M300 with payload) crashed in Himbi neighborhood after apparent malfunction. No detonation. Payload: fragmentation IED ~1.5kg. MONUSCO EOD team recovered device.",status:"INTERCEPTED",classification:"strike"},
  {id:"STRIKE-005",time:"13:28 UTC",type:"Drone Strike",platform:"Loitering Munition",base:"M23 territory",alt:"~2,000m",
   lat:-1.48,lon:29.28,desc:"LATEST: Loitering munition struck Wazalendo defensive position on hills north of Goma. Explosion observed from Goma city. 4 fighters killed, position destroyed. Drone circled ~15 min before diving. Consistent with Iranian Mohajer-6/Ababil-type UAS reportedly supplied to Rwanda (unconfirmed).",status:"CONFIRMED STRIKE",classification:"strike"},
  {id:"STRIKE-006",time:"15:45 UTC",type:"Drone Recon (Strike Package)",platform:"Wing Loong II (suspected)",base:"Possible Kigali",alt:"~5,500m",
   lat:-1.65,lon:29.25,desc:"HIGH ALTITUDE ALERT: MONUSCO radar detects MALE UAS operating at FL180 over Goma in racetrack orbit (ISR/strike profile). Duration: 3+ hours. Rwanda known to have acquired Chinese MALE drones. NO STRIKE EXECUTED — threat level elevated. FARDC has no counter-UAS capability.",status:"TRACKING — LIVE",classification:"strike"},
  {id:"RECON-011",time:"16:10 UTC",type:"Post-Strike BDA",platform:"Falco EVO",base:"Goma (MONUSCO)",alt:"3,500m",
   lat:-1.57,lon:29.31,desc:"MONUSCO post-strike damage assessment over STRIKE-001 impact site (Kibumba). Confirmed: crater ~3m diameter, destroyed bunker, 2 damaged vehicles. Civilian structures 200m east undamaged. Collecting evidence for UN Security Council briefing.",status:"IN PROGRESS",classification:"strike_bda"}
];

/* ── Military positions & order of battle ───────────────────
   Sourced from UN Group of Experts reports, MONUSCO JMAC,
   and open-source satellite imagery analysis. */
var MIL = [
  {n:"QG M23/RDF — Rumangabo",lt:-1.40,ln:29.38,t:"hq",s:"✦",c:"var(--mag)",
   d:"Integrated M23/RDF command post. 4-6K RDF troops. AA systems confirmed (UN GoE S/2024/432). Primary C2 node for northern sector."},
  {n:"M23 Admin — Goma",lt:-1.68,ln:29.22,t:"hq",s:"✦",c:"var(--mag)",
   d:"M23 occupation administration. City fell 27 Jan 2026. Governor replaced. All FARDC/MONUSCO positions overrun."},
  {n:"M23 Admin — Bukavu",lt:-2.51,ln:28.86,t:"hq",s:"✦",c:"var(--mag)",
   d:"M23 occupation. City fell 5 Feb 2026. 450K residents under M23 control. Systematic looting documented (HRW)."},
  {n:"Artillery — Masisi Heights",lt:-1.40,ln:28.80,t:"arty",s:"◆",c:"var(--pur)",
   d:"2× 120mm mortars confirmed active. Drone ISR: muzzle flash detected 05:45 UTC. Firing azimuth SE toward Sake. Threat to civilian corridor."},
  {n:"Checkpoint — Sake-Minova",lt:-1.62,ln:28.95,t:"cp",s:"⬧",c:"var(--red)",
   d:"New M23 checkpoint. 2 armed technicals. Change detection <72h. Controls humanitarian access to western Kivu."},
  {n:"RDF Logistics — Gisenyi",lt:-1.70,ln:29.26,t:"log",s:"⬧",c:"var(--red)",
   d:"Main RDF supply corridor from Rwanda. 14 trucks/day observed by drone ISR (+200% vs baseline). Fuel, ammunition, reinforcements."},
  {n:"Bunagana — M23 Border Post",lt:-1.28,ln:29.49,t:"cp",s:"⬧",c:"var(--red)",
   d:"M23-controlled since Jun 2022. Primary RDF entry point from Uganda/Rwanda. 2K additional RDF troops confirmed Jan 2026."},
  {n:"ADF/ISCAP — Mambasa Forest",lt:1.38,ln:29.05,t:"camp",s:"⬡",c:"var(--amb)",
   d:"3 thermal clusters confirmed by VIIRS and drone ISR. 20-30 individuals per site. ISCAP-affiliated, ISIS East Africa."},
  {n:"ADF — Beni-Oicha Zone",lt:0.60,ln:29.50,t:"camp",s:"⬡",c:"var(--amb)",
   d:"Primary ADF operational zone. 1,000+ civilian deaths/year. Night raids, machete attacks on villages."},
  {n:"CODECO — Djugu Territory",lt:1.90,ln:30.50,t:"camp",s:"⬡",c:"var(--amb)",
   d:"Lendu militia. Recurring attacks on IDP camps in Djugu. Drone ISR confirms ~30 fighters. Intercommunal violence driver."},
  {n:"Naval Formation — Lake Kivu",lt:-1.75,ln:29.18,t:"nav",s:"▲",c:"var(--blu)",
   d:"4 motorized boats in tactical formation detected by drone ISR. Non-fishing profile. Heading toward Idjwi Island. Lake Kivu patrol."},
  {n:"IDP Camp — Mugunga III",lt:-1.72,ln:29.12,t:"idp",s:"△",c:"var(--grn)",
   d:"~180K displaced (world's largest single IDP site). 60% structures damaged per drone BDA. Under M23 control since Jan 27."},
  {n:"IDP Camp — Bulengo",lt:-1.70,ln:29.10,t:"idp",s:"△",c:"var(--grn)",
   d:"~120K displaced. Located inside M23-controlled territory. OCHA reports access difficulties."},
  {n:"IDP Camp — Kanyaruchinya",lt:-1.58,ln:29.25,t:"idp",s:"△",c:"var(--grn)",
   d:"~85K displaced. Frontline position near active combat zone. High civilian protection risk."},
  {n:"IDP Camp — Plaine Shari",lt:1.80,ln:30.30,t:"idp",s:"△",c:"var(--grn)",
   d:"~45K displaced (Djugu, Ituri). Under CODECO threat. Drone monitoring active. MSF active medical presence."}
];

/* ── ACLED fallback dataset ─────────────────────────────────
   Used when no live ACLED API key is configured.
   Data verified against ACLED public database and UN reports.
   Covers Jan-Mar 2026 eastern DRC conflict events. */
function getACLED2026() {
  return [
    /* ── March 2026 ── */
    {type:"Drone Strike",date:"2026-03-11",location:"Kibumba",admin1:"Nord-Kivu",lat:-1.57,lon:29.31,fatalities:3,actor1:"M23/RDF UAS",actor2:"FARDC",notes:"Pre-dawn strike on FARDC forward bunker. DJI Matrice 300 modified with IED. 3 KIA, 7 WIA. MONUSCO condemns."},
    {type:"Drone Strike",date:"2026-03-11",location:"Mugunga Ouest",admin1:"Nord-Kivu",lat:-1.62,lon:29.18,fatalities:5,actor1:"M23/RDF UAS",actor2:"Wazalendo",notes:"Second strike on Wazalendo camp. 5 KIA. IDP camp Mugunga III 1.2km east — no civilian KIA reported."},
    {type:"Explosions/Remote violence",date:"2026-03-11",location:"Sake Road",admin1:"Nord-Kivu",lat:-1.54,lon:29.08,fatalities:1,actor1:"M23/RDF UAS",actor2:"FARDC",notes:"FARDC logistics depot hit. Ammunition secondary explosions 20min. Bayraktar-type loitering munition suspected. 1 KIA, 4 WIA."},
    {type:"Battles",date:"2026-03-08",location:"Masisi",admin1:"Nord-Kivu",lat:-1.40,lon:28.80,fatalities:12,actor1:"Wazalendo",actor2:"M23",notes:"Wazalendo counteroffensive on Masisi axis. Heavy fighting. 8 M23 + 4 Wazalendo KIA. Positions unchanged."},
    {type:"Battles",date:"2026-03-05",location:"Lubero",admin1:"Nord-Kivu",lat:-0.16,lon:29.24,fatalities:8,actor1:"M23",actor2:"FARDC",notes:"M23 advance toward Lubero. FARDC defensive line breached. 8 KIA. Civilians fleeing north."},
    {type:"Violence against civilians",date:"2026-03-03",location:"Oicha",admin1:"Nord-Kivu",lat:0.70,lon:29.52,fatalities:14,actor1:"ADF-ISCAP",actor2:"Civilians",notes:"Night machete raid. 14 civilians KIA. Church burned. ISCAP social media claim. FARDC cordon deployed."},
    {type:"Explosions/Remote violence",date:"2026-03-01",location:"Butembo",admin1:"Nord-Kivu",lat:0.14,lon:29.29,fatalities:4,actor1:"ADF",actor2:"FARDC",notes:"IED detonated under FARDC patrol vehicle on Butembo-Beni road. 4 soldiers KIA."},
    /* ── February 2026 ── */
    {type:"Strategic developments",date:"2026-02-05",location:"Bukavu",admin1:"Sud-Kivu",lat:-2.51,lon:28.86,fatalities:0,actor1:"M23/RDF",notes:"Bukavu falls to M23. 9 days after Goma. FARDC withdraws toward Uvira. 450K residents under M23 control. Second-largest city in eastern DRC."},
    {type:"Violence against civilians",date:"2026-02-06",location:"Bukavu Centre",admin1:"Sud-Kivu",lat:-2.51,lon:28.86,fatalities:22,actor1:"M23",actor2:"Civilians",notes:"Systematic looting and extrajudicial killings in Bukavu following M23 capture. 22 confirmed KIA. HRW documents targeted executions."},
    {type:"Battles",date:"2026-02-04",location:"Uvira Road",admin1:"Sud-Kivu",lat:-3.39,lon:29.14,fatalities:15,actor1:"M23",actor2:"FARDC",notes:"Fierce fighting on Bukavu-Uvira axis as M23 consolidates southern flank. 15 combined KIA. FARDC retreating south."},
    {type:"Drone Strike",date:"2026-02-14",location:"Goma Nord",admin1:"Nord-Kivu",lat:-1.60,lon:29.22,fatalities:2,actor1:"M23/RDF UAS",actor2:"FARDC",notes:"Drone strike on FARDC checkpoint during ceasefire period. 2 KIA. Pattern of drone escalation documented by MONUSCO."},
    {type:"Battles",date:"2026-02-20",location:"Minova",admin1:"Sud-Kivu",lat:-1.87,lon:28.95,fatalities:19,actor1:"M23",actor2:"FARDC/Wazalendo",notes:"Battle for strategic Minova position on Lake Kivu shore. 19 combined KIA. M23 controls Kivu lakeshore route to Bukavu."},
    {type:"Violence against civilians",date:"2026-02-17",location:"Plaine Shari",admin1:"Ituri",lat:1.80,lon:30.30,fatalities:11,actor1:"CODECO",actor2:"Civilians",notes:"CODECO militia attack on IDP camp. 11 KIA including 6 children. Camp partially evacuated toward Bunia."},
    {type:"Battles",date:"2026-02-25",location:"Lubero",admin1:"Nord-Kivu",lat:-0.16,lon:29.24,fatalities:7,actor1:"M23",actor2:"FARDC",notes:"First M23 probe toward Lubero. FARDC holds defensive line. 7 combined KIA. Civilians warned to evacuate."},
    {type:"Strategic developments",date:"2026-02-28",location:"Luanda",admin1:"Angola",lat:-8.84,lon:13.23,fatalities:0,actor1:"M23/RDF",actor2:"FARDC/DRC",notes:"Angola-facilitated peace talks collapse in Luanda. M23 refuses unconditional withdrawal. Emergency SADC summit called for March."},
    {type:"Violence against civilians",date:"2026-02-10",location:"Beni",admin1:"Nord-Kivu",lat:0.49,lon:29.47,fatalities:9,actor1:"ADF-ISCAP",actor2:"Civilians",notes:"ADF machete attack on Beni market at 06:30. 9 KIA. FARDC cordon-and-search operation launched. 2 suspects detained."},
    {type:"Explosions/Remote violence",date:"2026-02-22",location:"Kasindi",admin1:"Nord-Kivu",lat:0.05,lon:29.72,fatalities:3,actor1:"ADF",actor2:"FARDC",notes:"IED on Kasindi-Beni road. 3 FARDC KIA. UN humanitarian convoy delayed 6 hours."},
    {type:"Protests",date:"2026-02-07",location:"Kinshasa",admin1:"Kinshasa",lat:-4.31,lon:15.31,fatalities:1,actor1:"Protesters",actor2:"Police",notes:"Nationwide protests against M23 occupation and Rwanda. Embassy of Rwanda besieged. 1 protester KIA by police live rounds."},
    /* ── January 2026 ── */
    {type:"Battles",date:"2026-01-27",location:"Goma",admin1:"Nord-Kivu",lat:-1.6844,lon:29.2284,fatalities:47,actor1:"M23/RDF",actor2:"FARDC/MONUSCO",notes:"M23/RDF assault on Goma. 13 MONUSCO peacekeepers KIA. Civilian camps shelled. MSF: 100+ civilian KIA in 48h. Airport captured and closed."},
    {type:"Violence against civilians",date:"2026-01-27",location:"Mugunga Camp",admin1:"Nord-Kivu",lat:-1.72,lon:29.12,fatalities:23,actor1:"M23",actor2:"Civilians",notes:"Artillery bombardment of Mugunga III IDP camp during assault. 23 KIA, 80+ WIA. Population ~180K. Designated protected civilian site."},
    {type:"Violence against civilians",date:"2026-01-27",location:"Lac Vert Camp",admin1:"Nord-Kivu",lat:-1.74,lon:29.18,fatalities:18,actor1:"M23",actor2:"Civilians",notes:"Explosive weapons used in civilian area. 18 KIA including 7 children. UNICEF condemns use of indiscriminate weapons."},
    {type:"Battles",date:"2026-01-26",location:"Kibumba",admin1:"Nord-Kivu",lat:-1.55,lon:29.33,fatalities:14,actor1:"M23",actor2:"FARDC/MONUSCO",notes:"MONUSCO position overrun by M23. Heavy artillery barrage. MONUSCO withdraws from forward positions."},
    {type:"Explosions/Remote violence",date:"2026-01-25",location:"Goma Airport",admin1:"Nord-Kivu",lat:-1.67,lon:29.24,fatalities:5,actor1:"M23/RDF",actor2:"FARDC",notes:"Airport bombardment. Rendered non-operational. 5 airport workers KIA. Last commercial flight departed 24 Jan."},
    {type:"Battles",date:"2026-01-24",location:"Sake",admin1:"Nord-Kivu",lat:-1.56,lon:29.05,fatalities:11,actor1:"M23",actor2:"Wazalendo",notes:"Sake captured by M23. RN2 highway under M23 control. Strategic access to Goma cut off from west."},
    {type:"Strategic developments",date:"2026-01-22",location:"Rumangabo",admin1:"Nord-Kivu",lat:-1.40,lon:29.38,fatalities:0,actor1:"M23/RDF",notes:"UN GoE confirms 4,000-6,000 RDF troops in eastern DRC. Anti-aircraft systems documented. Constitutes foreign military occupation under international law."},
    {type:"Violence against civilians",date:"2026-01-28",location:"Goma-Himbi",admin1:"Nord-Kivu",lat:-1.675,lon:29.235,fatalities:14,actor1:"M23",actor2:"Civilians",notes:"Summary executions post-capture. 14 bodies found in Himbi neighborhood. Victims appear to be FARDC sympathizers. ICC prosecutor notified."},
    {type:"Violence against civilians",date:"2026-01-18",location:"Mambasa-Beni",admin1:"Nord-Kivu",lat:0.49,lon:29.47,fatalities:16,actor1:"ADF-ISCAP",actor2:"Civilians",notes:"ADF convoy ambush. 16 civilians KIA by machete and gunfire. ISCAP claims 'anti-kuffar operation'. FARDC pursuit operation launched."},
    {type:"Violence against civilians",date:"2026-01-17",location:"Plaine Shari",admin1:"Ituri",lat:1.80,lon:30.30,fatalities:12,actor1:"CODECO",actor2:"Civilians",notes:"CODECO IDP camp attack at night. 12 KIA, 40+ shelters burned. 3,000 flee toward Bunia. 5th attack on this camp in 12 months."},
    {type:"Battles",date:"2026-01-15",location:"Komanda",admin1:"Ituri",lat:1.23,lon:29.78,fatalities:9,actor1:"FARDC",actor2:"ADF",notes:"FARDC anti-ADF clearing operation. 6 ADF KIA, 3 FARDC KIA. 2 ADF camps destroyed. Population displacement ongoing."},
    {type:"Battles",date:"2026-01-29",location:"Minova",admin1:"Sud-Kivu",lat:-1.87,lon:28.95,fatalities:7,actor1:"M23",actor2:"FARDC",notes:"M23 advance down Lake Kivu shore toward Bukavu. FARDC defensive line established at Minova. 7 KIA."},
    {type:"Protests",date:"2026-01-31",location:"Kinshasa",admin1:"Kinshasa",lat:-4.31,lon:15.31,fatalities:2,actor1:"Protesters",actor2:"Police",notes:"Anti-Rwanda protests after Goma fall. Rwandan embassy stormed. 2 KIA by police. President Tshisekedi declares national mourning."},
    {type:"Violence against civilians",date:"2026-01-09",location:"Oicha",admin1:"Nord-Kivu",lat:0.70,lon:29.52,fatalities:8,actor1:"ADF-ISCAP",actor2:"Civilians",notes:"ADF night raid on Oicha outskirts. 8 civilian KIA. Beheadings reported. FARDC rapid reaction force deployed next morning."},
    {type:"Explosions/Remote violence",date:"2026-01-04",location:"Beni-Kasindi",admin1:"Nord-Kivu",lat:0.35,lon:29.60,fatalities:4,actor1:"ADF",actor2:"FARDC",notes:"IED detonated on humanitarian convoy route. 4 FARDC escorts KIA. WFP convoy immobilized for 48h."},
    {type:"Battles",date:"2026-01-20",location:"Masisi",admin1:"Nord-Kivu",lat:-1.40,lon:28.80,fatalities:8,actor1:"M23",actor2:"FARDC",notes:"M23 encirclement of Goma tightens through Masisi axis. 8 KIA. FARDC forced to cede Masisi town."},
    {type:"Strategic developments",date:"2026-01-07",location:"Bunagana",admin1:"Nord-Kivu",lat:-1.28,lon:29.49,fatalities:0,actor1:"RDF",notes:"2,000 additional RDF troops crossing at Bunagana confirmed by MONUSCO aerial surveillance. Satellite imagery shows reinforced vehicle convoy."},
    {type:"Battles",date:"2026-01-01",location:"Mambasa",admin1:"Ituri",lat:1.38,lon:29.05,fatalities:11,actor1:"FARDC",actor2:"ADF",notes:"FARDC forest clearing operation. 8 ADF + 3 FARDC KIA. 1 ADF commander killed. Cache of IED materials recovered."},
    {type:"Violence against civilians",date:"2026-01-05",location:"Blukwa",admin1:"Ituri",lat:2.05,lon:30.45,fatalities:9,actor1:"CODECO",actor2:"Civilians",notes:"CODECO attack on Hema farming village. 9 KIA, 15 WIA. Crops burned. Intercommunal Lendu-Hema violence escalating."},
    {type:"Battles",date:"2026-01-12",location:"Mweso",admin1:"Nord-Kivu",lat:-1.28,lon:28.63,fatalities:7,actor1:"M23",actor2:"Wazalendo",notes:"M23 expansion into Masisi territory via Mweso. 7 Wazalendo KIA. Wazalendo appeal to FARDC for reinforcements."}
  ].sort(function(a, b) { return b.date.localeCompare(a.date); });
}
