/* Seed records. Every one is ILLUSTRATIVE: invented to show the shape of
   the workspace, carrying no sources, and labelled as such wherever it
   is displayed. They exist so a first-time user does not open onto an
   empty table — not to be read as findings. */

import type { StrategicRecord } from './model';

const AT = '2026-11-11T09:00:00.000Z';
const base = {
  confidence: 'low' as const, status: 'draft' as const, sources: [],
  illustrative: true, createdAt: AT, updatedAt: AT, createdBy: 'JEU DE DÉMONSTRATION',
};

export const SEED_RECORDS: StrategicRecord[] = [
  {
    ...base, id: 'seed-energy-kongo-central',
    title: 'Corridor de développement solaire du Kongo Central',
    sector: 'Énergie', country: 'RD Congo', region: 'Kongo Central',
    summary: 'Exemple illustratif : évaluation de l’accès au réseau, de la demande industrielle et du potentiel de production solaire autour du corridor industriel.',
    entities: ['Corridor énergétique Kongo Central', 'Réseau électrique national'],
    lat: -5.82, lon: 13.46,
  },
  {
    ...base, id: 'seed-mining-lualaba',
    title: 'Capacité logistique cuivre-cobalt du Lualaba',
    sector: 'Mines', country: 'RD Congo', region: 'Lualaba',
    summary: 'Exemple illustratif : contraintes routières, ferroviaires et frontalières pesant sur les chaînes d’approvisionnement minérales.',
    entities: ['Chaîne d’approvisionnement du cuivre', 'Corridors de transport régionaux'],
    lat: -10.71, lon: 25.47,
  },
  {
    ...base, id: 'seed-infra-interconnexion',
    title: 'Perspectives d’interconnexion électrique régionale',
    sector: 'Infrastructure', country: 'RD Congo', region: 'Kinshasa',
    summary: 'Exemple illustratif : revue par scénarios de la capacité de transport, de l’interconnexion régionale et de la demande industrielle en électricité.',
    entities: ['Réseau électrique national', 'Corridor énergétique Kongo Central'],
    lat: -4.33, lon: 15.31,
  },
  {
    ...base, id: 'seed-trade-grands-lacs',
    title: 'Indicateurs de facilitation du commerce des Grands Lacs',
    sector: 'Commerce', country: 'Grands Lacs', region: 'Régional',
    summary: 'Exemple illustratif : procédures douanières, délais de transit et facilitation des échanges transfrontaliers.',
    entities: ['Réseau commercial des Grands Lacs', 'Corridors de transport régionaux'],
    lat: -1.68, lon: 29.23,
  },
];
