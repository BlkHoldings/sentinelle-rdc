'use client';

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '/',     label: 'Rechercher' },
  { keys: 'R',     label: 'Rafraîchir les données' },
  { keys: '1–9',   label: 'Changer de vue (Overview → Pipeline)' },
  { keys: '0',     label: 'Anomalies' },
  { keys: 'S',     label: 'Rapport de situation (SITREP)' },
  { keys: 'ESC',   label: 'Fermer / désélectionner' },
  { keys: '?',     label: 'Afficher / masquer cette aide' },
];

/* Triage is a repetitive, high-volume task; it is driven entirely from
   the keyboard so an analyst never has to leave the home row. */
const TRIAGE_HELP: { keys: string; label: string }[] = [
  { keys: 'J / K', label: 'Événement suivant / précédent' },
  { keys: 'C',     label: 'Confirmer — relève la fiabilité des sources contributrices' },
  { keys: 'X',     label: 'Rejeter — abaisse la fiabilité des sources contributrices' },
  { keys: 'E',     label: 'Escalader vers le commandement' },
  { keys: 'D',     label: 'Différer — laisser en file' },
];

const MAP_HELP: { keys: string; label: string }[] = [
  { keys: '↖', label: 'Sélectionner — clic sur un marqueur pour le détail' },
  { keys: '⬜', label: 'Rectangle — 2 clics (coins opposés)' },
  { keys: '○', label: 'Cercle — centre puis rayon' },
  { keys: '△', label: 'Polygone — clics, double-clic pour fermer' },
  { keys: '✎', label: 'Annoter — clic + saisie du texte' },
];

export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative panel shadow-float w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="panel-header px-3 py-2 flex items-center justify-between sticky top-0">
          <span className="mvn-label">RACCOURCIS — SENTINELLE-RDC</span>
          <button onClick={onClose} className="text-t3 hover:text-t1 text-sm transition-colors">✕</button>
        </div>

        <div className="px-3 py-2">
          <div className="mvn-label mb-1.5">CLAVIER</div>
          <div className="space-y-1">
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={keys} className="flex items-center gap-3">
                <kbd className="min-w-[3rem] text-center px-1.5 py-0.5 bg-b2 border border-b3 text-cyn text-2xs font-mono">{keys}</kbd>
                <span className="text-t2 text-2xs font-mono">{label}</span>
              </div>
            ))}
          </div>

          <div className="mvn-label mt-3 mb-1.5 text-cyn">FILE DE TRIAGE</div>
          <div className="space-y-1">
            {TRIAGE_HELP.map(({ keys, label }) => (
              <div key={keys} className="flex items-center gap-3">
                <kbd className="min-w-[3rem] text-center px-1.5 py-0.5 bg-b2 border border-b3 text-amb text-2xs font-mono">{keys}</kbd>
                <span className="text-t2 text-2xs font-mono">{label}</span>
              </div>
            ))}
          </div>

          <div className="mvn-label mt-3 mb-1.5">OUTILS CARTE</div>
          <div className="space-y-1">
            {MAP_HELP.map(({ keys, label }) => (
              <div key={label} className="flex items-center gap-3">
                <kbd className="min-w-[3rem] text-center px-1.5 py-0.5 bg-b2 border border-b3 text-t1 text-2xs font-mono">{keys}</kbd>
                <span className="text-t2 text-2xs font-mono">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-header px-3 py-1.5 flex items-center justify-between sticky bottom-0">
          <span className="text-t3 text-2xs font-mono">Données live : ACLED · FIRMS · Copernicus</span>
          <span className="classify px-1.5 py-0.5 text-2xs">SECRET</span>
        </div>
      </div>
    </div>
  );
}
