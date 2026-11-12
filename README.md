# NKOYI

Espace d'analyse stratégique fondé sur les preuves — RDC et Grands Lacs.

**En ligne :** https://blkholdings.github.io/sentinelle-rdc/
(l'adresse garde l'ancien nom du dépôt ; elle changera si le dépôt est renommé, voir plus bas)

> **Par défaut, seules des sources réelles sont affichées.** Un signalement de presse
> n'est pas un fait établi : il reste « non vérifié » tant qu'une autre famille de
> sources ne le recoupe pas ou qu'un analyste ne le confirme pas. Un mode démonstration
> (flux simulé, jeux de données illustratifs, tous étiquetés) s'active dans
> *Gestion des sources* ou *Paramètres*.

## Sources de données

Vérifiées dans un navigateur réel le 12 novembre 2026. Aucune ne demande de clé, sauf mention.

| Source | Contenu | Cadence | État |
|---|---|---|---|
| **GDELT** | Titres de presse sur l'est de la RDC → moteur de fusion | 15 min | Connectée ; limitée à 1 requête / 5 s par adresse |
| **OMS — Disease Outbreak News** | Bulletins officiels d'épidémie | à la publication | Connectée |
| **UNHCR + IDMC** | Réfugiés, déplacés internes, séries annuelles | annuelle | Connectée |
| **NASA EONET** | Feux, volcans, inondations (filtrés sur le territoire) | quotidienne | Connectée |
| **NASA GIBS** | Imagerie : couleurs réelles de la veille, précipitations, lumières nocturnes | quotidienne | Connectée |
| **GloFAS (Open-Meteo)** | Débit modélisé de six points du bassin | quotidienne | Connectée |
| **USGS** | Sismicité | 5 min | Connectée |
| **GDACS** | Alertes catastrophes | 15 min | Connectée |
| **Open-Meteo** | Météo, faisabilité d'observation | 10 min | Connectée |
| **OpenStreetMap (Overpass)** | Infrastructure, à la demande | — | Connectée |
| **ReliefWeb v2** | Rapports humanitaires → moteur de fusion | continu | **À configurer** : `appname` gratuit à demander à ReliefWeb, à saisir dans *Gestion des sources* |
| **ACLED**, **NASA FIRMS** | Conflits géocodés ; points chauds | — | Clé à saisir à la connexion |
| **OCHA FTS** | Financement humanitaire | — | **Non connectable depuis un navigateur** : l'API renvoie des en-têtes CORS invalides. Analyseur prêt et testé, en attente d'un relais serveur |
| **UCDP**, **OIM-DTM**, **HDX HAPI** | Violence organisée ; déplacements par zone ; besoins | — | Demandent un jeton ou un identifiant |
| **Radio Okapi, Actualité.cd (RSS)** | Presse congolaise | — | Demandent un relais serveur (lecture inter-domaines refusée) |

Fonds de carte : ESRI ArcGIS Online (sans clé). Limites administratives : geoBoundaries / OpenStreetMap (ODbL).

Les analyseurs sont testés contre des réponses réelles enregistrées (`tests/fixtures`) :
si un fournisseur change de format, un test échoue au lieu de vider un panneau en silence.

## Ce que fait l'application

| Espace | Contenu |
|---|---|
| **Vue d'ensemble** | Indicateurs de la période, carte, derniers développements, fiche d'événement en tiroir |
| **Renseignement en direct** | Flux chronologique des événements fusionnés, filtrable ; fiche complète : sources, chronologie, contradictions, historique, notes, calcul de confiance |
| **Carte interactive** | Fonds sombre / satellite / topo, relief 3D, frontière et 26 provinces, 18 calques avec compteurs, opacité et isolement |
| **Analyse régionale** | Tendances jour / semaine, provinces, types, statuts, familles de sources, fiabilité — chaque graphique a son tableau |
| **Situation humanitaire** | Faits humanitaires, déplacés rapportés, publications ReliefWeb, alertes GDACS |
| **Alerte précoce · Triage · Chaîne de fusion · SITREP** | Détection d'anomalies, file de décision, pipeline, rapport de situation |
| **Gestion des sources** | État de chaque flux temps réel, avec export |
| **Dossiers stratégiques** | Bibliothèque, entités, signaux, assistant d'analyse, rapports approuvés, journal d'audit |
| **Paramètres** | Langue (français / anglais), taille du texte |

Référence de conception : [`docs/DESIGN.md`](docs/DESIGN.md).

## Ce qu'elle ne fait pas

Ces limites sont affichées dans l'interface ; elles sont répétées ici pour qu'aucune
ne soit découverte par surprise.

- **Pas de serveur.** Dossiers, rapports et journal vivent dans le `localStorage` du
  navigateur : rien n'est partagé entre utilisateurs, et vider les données du site efface tout.
- **Pas de contrôle d'accès.** Les identifiants de démonstration et les rôles sont
  vérifiés côté client. Ils rendent le flux de relecture cohérent ; ils ne protègent rien.
- **GDELT ne fournit que des titres.** L'extraction du lieu et du type se fait sur une
  ligne ; beaucoup d'articles restent « non classés » ou localisés à la province.
- **En mode démonstration**, chaque événement et chaque source simulés portent l'étiquette
  « Simulé » ; les noms de médias qui y figurent sont fictifs dans ce contexte.
- **Pas de modèle d'IA.** L'atelier fait une recherche par mots-clés et assemble le
  brief par règles. Il le dit dans chaque brief.
- **Pas d'interception.** Le panneau « communications » est une démonstration sonore
  synthétique sur des textes du jeu de données.
- **Le journal n'est pas une preuve d'intégrité** : il est stocké au même endroit que
  ce qu'il décrit.

## Périmètre

Aide à la décision civile et licite : infrastructure, énergie, mines, commerce,
investissement, politique publique, suivi humanitaire à partir de sources ouvertes.
Les entités sont des organisations, des projets et des systèmes — jamais des personnes
privées. Hors périmètre : surveillance clandestine, pistage d'individus, reconnaissance
faciale, profilage, ciblage, recommandations opérationnelles automatisées.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # tests unitaires (Vitest)
npm run type-check
npm run build        # export statique dans out/
```

Comptes de démonstration : `analyst` / `analyst2026` · `operator` / `op3rator!` ·
`commander` / `cmd@rdc2026`. Un analyste ne peut ni vérifier un dossier ni approuver
un rapport ; il faut un second compte pour approuver le rapport d'un autre.

Les clés NASA FIRMS et ACLED sont facultatives et se saisissent à la connexion.

## Architecture

```
src/
├── app/                    pages (connexion, console)
├── components/
│   ├── layout/ ui/         coque (navigation, barre), kit d'interface, graphiques, icônes
│   ├── intel/              flux, fiche d'événement, analyses, paramètres
│   ├── globe/ hud/         carte, calques, légende, fiche d'entité
│   ├── fusion/             triage, pipeline, anomalies, données, SITREP
│   └── strategic/          dossiers, entités, signaux, atelier, rapports, journal
├── lib/
│   ├── fusion/             moteur de fusion (pur, sans React)
│   ├── live/               connecteurs : GDELT, OMS, UNHCR/IDMC, NASA, GloFAS, USGS, GDACS, météo, OSM
│   ├── strategic/          modèle de dossier, validation, filtrage, brief (pur)
│   ├── intel/              dérivations sur les événements fusionnés (pur)
│   ├── i18n/               dictionnaires français / anglais
│   ├── layers.ts           registre unique des calques
│   └── cluster.ts          regroupement en espace écran
├── store/                  états Zustand ; useStrategicStore = couche d'accès aux données
tests/                      Vitest
```

`lib/strategic` ne dépend ni de React ni du stockage. `useStrategicStore` est le seul
endroit qui touche au `localStorage` : passer à une base serveur ne modifie que ce fichier.

### Modèle de dossier

Un dossier porte deux champs volontairement distincts : la **confiance** (jugement de
l'analyste sur la preuve) et le **statut** (brouillon, en revue, vérifié, contesté,
archivé). Chaque source conserve titre, éditeur, URL ou référence, date de publication,
date de consultation, base d'accès et notes. Règles appliquées à l'enregistrement :
pas de mise en revue sans source, pas de confiance élevée avec moins de deux sources,
seules les URL `http(s)` sont acceptées comme liens.

## Feuille de route

Fait : fondation applicative (validation, états vides et d'erreur, couche d'accès
typée, tests), modèle fondé sur les preuves, carte MapLibre avec calques, flux de
relecture et journal en démonstration.

Reste, dans l'ordre, et chacun demande un serveur :

1. **Identité et rôles** — authentification réelle, autorisation côté serveur, sécurité au niveau des lignes.
2. **Base de données** — PostgreSQL/PostGIS, migrations, journal d'audit côté serveur.
3. **Ingestion** — tâches planifiées avec provenance, fraîcheur, licence et erreurs enregistrées.
4. **Analyse assistée** — orchestration côté serveur, récupération limitée aux dossiers autorisés, citations exactes ; aucune clé de modèle dans le navigateur.
5. **Exploitation** — exports PDF contrôlés, sauvegardes, observabilité, limites de débit.

## Déploiement

Un push sur `main` lance le contrôle de types, les tests, la compilation et la
publication sur GitHub Pages (`.github/workflows/deploy.yml`).

**Renommer le dépôt** en `nkoyi` change l'adresse publique : il faut alors remplacer
`/sentinelle-rdc` par `/nkoyi` dans `basePath` (`next.config.ts`).
