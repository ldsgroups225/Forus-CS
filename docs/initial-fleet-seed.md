# Seed initial de la flotte FORUS

## Source et périmètre

L’importeur utilise localement le classeur :

`Parc_FORUS_reparti_4_agents_par_type_camion.xlsx`

Source métier : extraction du Dashboard Forus datée du 22 juillet 2026.
Le fichier n’est pas copié dans le dépôt, car il contient des coordonnées
opérationnelles. Les valeurs source (noms, téléphones, immatriculations,
portefeuilles et identifiants) ne sont pas normalisées silencieusement.

Volumes contrôlés dans le classeur :

- 903 transporteurs uniques ;
- 1 893 véhicules ;
- 1 207 lignes chauffeurs ;
- quatre portefeuilles sources, `Agent 1` à `Agent 4`.

Le mode standard limite volontairement le seed à 25 transporteurs. Il produit,
avec le classeur courant, 37 véhicules et 21 chauffeurs liés.

## Sécurité

Les mutations d’import refusent :

- une clé absente ou différente de `FORUS_FLEET_IMPORT_KEY` ou, par
  compatibilité, `DEVELOPMENT_FLEET_IMPORT_KEY`.

La clé reste privée dans Convex et dans l’environnement du terminal. Elle ne
doit jamais utiliser le préfixe `NUXT_PUBLIC_`.

```bash
pnpm exec convex env set DEVELOPMENT_FLEET_IMPORT_KEY
export FORUS_FLEET_IMPORT_KEY='même-valeur-privée'
```

Le script importe les 903 transporteurs uniques de la feuille source et les
véhicules reliés à ces transporteurs par téléphone. Les véhicules dont le
contact propriétaire n’existe pas dans `Transporteurs uniques` sont signalés
dans le diagnostic `skippedVehiclesWithoutImportedCarrier`, sans créer de faux
transporteur.

## Vérification et import

Vérifier d’abord la lecture sans écriture :

```bash
pnpm seed:fleet /chemin/Parc_FORUS_reparti_4_agents_par_type_camion.xlsx --dry-run
```

Importer l’échantillon idempotent dans `forus-group` :

```bash
pnpm seed:fleet /chemin/Parc_FORUS_reparti_4_agents_par_type_camion.xlsx
```

Rejouer la même commande doit produire uniquement des mises à jour. Pour cibler
une autre organisation de développement :

```bash
pnpm seed:fleet /chemin/fichier.xlsx --organization mon-tenant --limit 25
```

L’import complet est explicite :

```bash
pnpm seed:fleet /chemin/fichier.xlsx --organization forus-group --all
```

Pour créer aussi les assignations de portefeuille quand les comptes agents
existent déjà dans Convex, le script crée/réutilise automatiquement les
enveloppes `Agent 1` à `Agent 4`. Fournir le mapping des libellés du classeur
vers leur e-mail ou leur `userId` lie en plus l’enveloppe au compte réel :

```bash
FORUS_AGENT_MAP_JSON='{"Agent 1":"agent1@forus.ci","Agent 2":"agent2@forus.ci"}' \
pnpm seed:fleet /chemin/fichier.xlsx --organization forus-group --all
```

Avant `--all`, vérifier le quota Convex et travailler sur un déploiement de
développement dédié. Chaque lot génère une entrée d’audit.
