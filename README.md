# NKOYI

Espace d'analyse stratégique fondé sur les preuves — RDC et Grands Lacs.

**En ligne :** https://blkholdings.github.io/sentinelle-rdc/
(l'adresse garde l'ancien nom du dépôt ; elle changera si le dépôt est renommé, voir plus bas)

> **Environnement de démonstration.** Les dossiers de départ, les positions, les relevés
> et le flux d'événements synthétique sont illustratifs. Rien de ce qui est affiché ne
> doit être lu comme un constat vérifié.

## Ce que fait l'application

| Espace | Contenu |
|---|---|
| **Carte** | Fonds haute résolution, relief 3D, 17 calques avec compteurs, opacité et isolement ; chaque symbole est cliquable |
| **Fusion** | Corrélation de rapports multi-sources, confiance bayésienne, file de triage, détection d'anomalies, SITREP |
| **Données** | État de chaque source temps réel (météo, sismicité, ReliefWeb, GDACS, OSM) avec export |
| **Dossiers** | Bibliothèque de dossiers stratégiques — énergie, mines, infrastructure, commerce, politique publique — chacun rattaché à ses sources |
| **Entités / Signaux** | Vues dérivées des dossiers : entités co-citées, indice d'attention décomposé |
| **Atelier** | Question → brief structuré citant les dossiers utilisés et signalant les lacunes |
| **Rapports** | Versions, soumission, approbation par un second relecteur |
| **Journal** | Trace en ajout seul des créations, modifications, relectures et exports |

## Ce qu'elle ne fait pas

Ces limites sont affichées dans l'interface ; elles sont répétées ici pour qu'aucune
ne soit découverte par surprise.

- **Pas de serveur.** Dossiers, rapports et journal vivent dans le `localStorage` du
  navigateur : rien n'est partagé entre utilisateurs, et vider les données du site efface tout.
- **Pas de contrôle d'accès.** Les identifiants de démonstration et les rôles sont
  vérifiés côté client. Ils rendent le flux de relecture cohérent ; ils ne protègent rien.
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
│   ├── globe/ hud/         carte, calques, légende, fiche d'entité
│   ├── fusion/             triage, pipeline, anomalies, données, SITREP
│   └── strategic/          dossiers, entités, signaux, atelier, rapports, journal
├── lib/
│   ├── fusion/             moteur de fusion (pur, sans React)
│   ├── live/               clients des sources temps réel
│   ├── strategic/          modèle de dossier, validation, filtrage, brief (pur)
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
