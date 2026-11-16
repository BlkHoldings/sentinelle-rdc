# NKOYI

Espace d'analyse stratégique fondé sur les preuves — RDC et Grands Lacs.

**En ligne :** https://blkholdings.github.io/sentinelle-rdc/
(l'adresse garde l'ancien nom du dépôt ; elle changera si le dépôt est renommé, voir plus bas)

> **Par défaut, seules des sources réelles sont affichées.** Un signalement de presse
> n'est pas un fait établi : il reste « non vérifié » tant qu'une autre famille de
> sources ne le recoupe pas ou qu'un analyste ne le confirme pas. Un mode démonstration
> (flux simulé, jeux de données illustratifs, tous étiquetés) s'active dans
> *Gestion des sources* ou *Paramètres*.

## Collecte 24h/24 (côté serveur)

Le site est statique : seul, il ne collecte que lorsqu'un navigateur est ouvert, et
il se heurte aux limites CORS (presse congolaise illisible) et au quota par IP de GDELT.

Un **collecteur serveur** (`.github/workflows/collect.yml`, toutes les 30 min) lève ces
deux limites. Il lit des sources **ouvertes et publiques** — rien n'est intercepté — les
normalise (`scripts/collect.mjs`) et écrit un instantané sur la branche `data` :

| Fichier | Contenu |
|---|---|
| `wire.json` | Rapports collectés (presse + GDELT), les plus récents d'abord |
| `manifest.json` | État par sous-source + horodatage de collecte |

Le site lit cette branche via `raw.githubusercontent.com` (CORS ouvert, cache court) :
**données présentes en permanence, sans reconstruction ni serveur dédié.** Si cet hôte
est bloqué sur un réseau, l'application retombe sur les collectes navigateur.

Sources du collecteur : Radio Okapi, Actualité.cd, ReliefWeb (RDC), UN News, GDELT.

### Activer X (Twitter) — optionnel, clé requise

X s'intègre au collecteur comme famille **« social », gradée bas** (un compte vérifié = C,
un compte ordinaire = E) : une vague de reposts est décotée, pas comptée. Le navigateur ne
peut pas appeler l'API X (CORS), et la recherche récente est payante — donc tout passe par
le collecteur, protégé par un secret.

Pour l'activer :

1. Obtenir un **bearer token** X avec accès à `tweets/search/recent` (offre payante X API).
2. Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret** :
   nom `X_BEARER_TOKEN`, valeur = le jeton. (Facultatif : `X_MAX_RESULTS`, défaut 25.)
3. À la collecte suivante, les posts RDC entrent dans le fil, étiquetés « non vérifié ».

Le jeton **n'est jamais** dans le dépôt ni dans le navigateur — uniquement dans les secrets
Actions. Tant qu'il est absent, X apparaît « à configurer », sans erreur.

> **Quota.** L'offre de base X plafonne le volume mensuel ; à 30 min × 25 posts, vous
> dépasseriez vite. Réduisez `X_MAX_RESULTS` ou espacez le cron (`collect.yml`) selon votre
> abonnement. Toutes alimentent le moteur de fusion comme rapports de presse, gradés bas tant
qu'ils ne sont pas recoupés.

> **Pas d'interception.** Toute collecte porte sur des flux publics qu'on peut ouvrir
> dans un navigateur. NKOYI ne capte aucune communication privée (radio, téléphone,
> messages) : ce serait illégal et hors de portée d'une application web. Le traitement
> « complexe » est l'analyse OSINT déjà en place : fusion bayésienne, code de l'Amirauté,
> balayage spatio-temporel sur des signaux ouverts.

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

**Réseau et imagerie (sans clé, navigateur) :**

| Source | Apport |
|---|---|
| **IODA** (Georgia Tech / CAIDA) | Détection de coupures internet en RDC (BGP, sondage actif, télescope) — un arrêt est en soi un signal. Remplace la télémétrie simulée. |
| **Sentinel-2** (Earth Search, sans clé) | Dernière scène optique sur la zone est : date, couverture nuageuse, vignette. Pas besoin de compte Copernicus. |
| **OpenSky (ADS-B)** | Aéronefs au-dessus de la zone (aviation publique), **collectée côté serveur** (CORS restreint au domaine OpenSky). Données de sécurité aérienne — jamais de personnes. |

Sources écartées, et pourquoi : **N2YO** (passage satellite) et **Azure Maps** (trafic) demandent une clé pour un intérêt faible ou nul en RDC ; **Cloudflare Radar** demande un jeton (IODA couvre le même besoin gratuitement) ; **Copernicus OData** demande une authentification — le catalogue Sentinel-2 passe par Earth Search à la place.

Carte : MapLibre GL 5 (projection plane ou **globe**). Fond par défaut en **tuiles
vectorielles** OpenFreeMap (OpenStreetMap, sans clé) — nettes à tout zoom ; le style est
vérifié avant d'être donné à la carte, avec repli automatique sur un fond raster. Imagerie :
**Sentinel-2 sans nuages 2024 à 10 m** (EOX, licence CC BY-NC-SA — *usage non commercial*),
ESRI World Imagery, NASA GIBS. Autres fonds : ESRI ArcGIS Online (sans clé). Limites administratives : geoBoundaries / OpenStreetMap (ODbL).

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
