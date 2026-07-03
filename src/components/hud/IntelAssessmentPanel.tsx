'use client';

import { useFeedStore } from '@/store/useFeedStore';
import { DRONE_ISR } from '@/data/drones';

interface Props { onClose: () => void; }

const SECTIONS = [
  {
    key: 'critique',
    label: 'CRITIQUE — OCCUPATION M23/RDF',
    color: 'text-alert',
    dot:   'bg-alert',
    text:  "Goma (27 Jan 2026) + Bukavu (5 Fév 2026) sous contrôle M23/RDF. ~8 000 troupes RDF documentées (GoE S/2024/432). Walikale pris le 28 mai 2026. Drone ISR confirme 14 camions/jour via Gisenyi depuis Rwanda. Axe Uvira sous pression depuis juin 2026.",
  },
  {
    key: 'drone',
    label: 'DRONE ISR — SORTIES DU JOUR',
    color: 'text-cyn',
    dot:   'bg-cyn',
    text:  "17 missions UAV actives, 4 frappes confirmées. Plateformes: Falco EVO / ScanEagle (MONUSCO), UAS RDF/M23 non identifiés. Loitering munitions (Mohajer-6 / Shaheed-136) confirmées nord de Goma (Wazalendo). Wing Loong II suspecté en orbite ISR FL180. FARDC sans capacité anti-drone documentée.",
  },
  {
    key: 'firms',
    label: 'FIRMS — THERMIQUE',
    color: 'text-fire',
    dot:   'bg-fire',
    text:  "Anomalies nocturnes en zones forestières (Virunga, Mambasa) = camps armés actifs (ADF/ISCAP). Signatures diurnes sur RN2 / RN5 = convois et checkpoints M23. Corrélation croisée avec sorties ISR drone recommandée.",
  },
  {
    key: 'copernicus',
    label: 'COPERNICUS — SENTINEL',
    color: 'text-grn',
    dot:   'bg-grn',
    text:  "S1 SAR tout-temps (~revisit 6h). S2 optique 10m. Détection de changement: nouvelles structures Rumangabo (camp renforcé), concentrations de véhicules Gisenyi, déplacements de population NW Goma. 60+ scènes disponibles.",
  },
  {
    key: 'humanitaire',
    label: 'HUMANITAIRE',
    color: 'text-grn',
    dot:   'bg-grn',
    text:  "7,2 M PDI (record mondial). Mugunga III: ~180K déplacés, 60% structures détruites (BDA drone). Bulengo: 120K, stocks alimentaires critiques (PAM). Camp IDP Uvira: 30K depuis juin 2026. CODECO continue d'attaquer les sites IDP à Djugu (Ituri).",
  },
];

export default function IntelAssessmentPanel({ onClose }: Props) {
  const events   = useFeedStore((s) => s.events);
  const totalKIA = events.reduce((a, e) => a + (e.fatalities ?? 0), 0);
  const acledN   = events.filter((e) => e.src === 'acled').length;
  const strikes  = DRONE_ISR.filter((r) => r.classification === 'strike').length;

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).toUpperCase();

  return (
    <div className="absolute top-20 left-3 z-panel w-80 animate-slide-up shadow-float">
      <div className="panel">

        {/* Header */}
        <div className="panel-header px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-alert text-xs font-bold">✦</span>
            <span className="mvn-label text-t2">INTELLIGENCE ASSESSMENT — {today}</span>
          </div>
          <button
            onClick={onClose}
            className="text-t3 hover:text-t1 text-xs font-mono transition-colors ml-2 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 border-b border-b3">
          <div className="flex flex-col items-center py-1.5 border-r border-b3">
            <span className="text-alert font-mono font-bold text-sm">{acledN}</span>
            <span className="mvn-label">EVENTS</span>
          </div>
          <div className="flex flex-col items-center py-1.5 border-r border-b3">
            <span className="text-mag font-mono font-bold text-sm">{strikes}</span>
            <span className="mvn-label">STRIKES</span>
          </div>
          <div className="flex flex-col items-center py-1.5">
            <span className="text-alert font-mono font-bold text-sm">{totalKIA}</span>
            <span className="mvn-label">KIA</span>
          </div>
        </div>

        {/* Briefing sections */}
        <div className="divide-y divide-b3 max-h-[55vh] overflow-y-auto">
          {SECTIONS.map(({ key, label, color, dot, text }) => (
            <div key={key} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-1 h-1 shrink-0 ${dot}`} />
                <span className={`mvn-label ${color}`}>{label}</span>
              </div>
              <p className="text-t2 text-2xs font-mono leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="panel-header px-3 py-1 flex items-center justify-between">
          <span className="mvn-label text-t3">SOURCES: ACLED · MONUSCO · GoE · OSINT SAR</span>
          <span className="text-t3 text-2xs font-mono">SENTINELLE-RDC</span>
        </div>
      </div>
    </div>
  );
}
