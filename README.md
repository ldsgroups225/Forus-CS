# Forus CS — Forus Call Center

PWA SaaS multi-tenant pour piloter les besoins de transport de FORUS.

Le socle fonctionnel couvre :

1. inscription et connexion ;
2. création ou sélection d’une organisation ;
3. création d’un besoin en brouillon ;
4. publication et liste des besoins actifs ;
5. consultation, modification et annulation ;
6. soumission, négociation, acceptation ou refus d’une option transporteur ;
7. création atomique d’une mission et mise à jour des camions approuvés ;
8. CRM clients et transporteurs, véhicules, chauffeurs, documents et disponibilités ;
9. équipes, invitations, rôles, superviseurs et portefeuilles exclusifs ;
10. appels, relances, notifications, incidents, rapports et KPI ;
11. reprise idempotente de certaines créations hors ligne ;
12. audit des actions importantes.

## Architecture

- Nuxt 4, Vue 3 et TypeScript strict pour l’application SSR ;
- UnoCSS et variables CSS pour le design system ;
- Better Auth Vue pour les sessions ;
- Convex pour les données métier, les requêtes temps réel et l’autorisation ;
- Pinia réservé aux états locaux d’interface ;
- Vite PWA pour l’installation et la consultation des pages déjà chargées.

Le serveur Nitro rend l’App Shell, l’accueil et l’écran hors ligne. Les routes
d’authentification et métier (`/login`, `/register`, `/onboarding/**`, `/o/**`)
sont rendues côté client : elles dépendent du bridge navigateur Better
Auth–Convex et de ses abonnements temps réel.

Chaque fonction Convex vérifie le membership et le rôle dans l’organisation
ciblée. Les agents n’accèdent qu’aux transporteurs de leur portefeuille pour les
écritures sensibles. Le superviseur valide les options ; la décision commerciale
reste réservée au Responsable Opérations. Chaque acceptation crée une seule
mission et met à jour la progression du besoin dans la même transaction Convex.

## Prérequis

- Node.js 24 ;
- pnpm 11.17.0 ;
- un compte Convex connecté au CLI.

## Configuration locale

Installez les dépendances :

```bash
pnpm install --frozen-lockfile
```

Sélectionnez ou créez votre déploiement de développement :

```bash
pnpm exec convex dev
```

Le CLI génère `CONVEX_DEPLOYMENT` dans `.env.local`. Ajoutez ensuite les trois
variables publiques en suivant [`.env.example`](./.env.example) :

```dotenv
CONVEX_DEPLOYMENT=dev:your-deployment
NUXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NUXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

Les variables privées sont configurées uniquement dans Convex :

```bash
openssl rand -base64 32 | pnpm exec convex env set BETTER_AUTH_SECRET
printf 'http://localhost:3000' | pnpm exec convex env set SITE_URL
```

Ne préfixez jamais ces secrets avec `NUXT_PUBLIC_`.

Les variables privées facultatives (e-mail, vérification et OAuth) ainsi que la
checklist de production sont décrites dans
[`docs/production-runbook.md`](./docs/production-runbook.md).

Le guide d’intégration détaillé est disponible dans
[`docs/better-auth-setup.md`](./docs/better-auth-setup.md).

## Lancement

Dans un terminal :

```bash
pnpm exec convex dev
```

Dans un second terminal :

```bash
pnpm dev
```

L’application est disponible sur <http://localhost:3000>.

Pour tester le service worker en développement :

```bash
pnpm dev:pwa
```

## Données de démonstration et flotte initiale

Après inscription, utilisez **Charger la démonstration FORUS** sur l’écran de
création d’organisation. Le bouton n’existe qu’en développement et la mutation
refuse aussi de s’exécuter lorsque `SITE_URL` ne pointe pas vers localhost.

Le seed crée `FORUS GROUP`, trois clients et huit besoins. Il est idempotent
pour chaque utilisateur connecté.

Un importeur séparé lit le classeur FORUS sans le copier dans Git. Il est
idempotent, limité au développement et protégé par une clé privée Convex.
Le mode par défaut charge un échantillon de 25 transporteurs :

```bash
pnpm seed:fleet /chemin/Parc_FORUS_reparti_4_agents_par_type_camion.xlsx --dry-run
```

La procédure d’import, les volumes et la provenance sont documentés dans
[`docs/initial-fleet-seed.md`](./docs/initial-fleet-seed.md).

## Contrôles qualité

```bash
pnpm exec convex dev --once
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Les tests unitaires couvrent progression, références, autorisation multi-tenant,
options, missions, incidents, matching et KPI. Playwright vérifie l’App Shell,
les vues desktop/mobile, la PWA et, lorsque les secrets E2E sont configurés, le
parcours Responsable Opérations sur un vrai backend.

Le parcours Calling multi-rôles est volontairement isolé des E2E ordinaires : il
crée ses propres client, transporteur, deux véhicules et besoin, puis vérifie
`Agent → Superviseur → Opérations`, y compris l’acceptation d’un sous-ensemble
des véhicules. Les trois comptes doivent déjà être membres actifs de la même
organisation ; le compte administrateur doit pouvoir créer les données de test.

```bash
E2E_CALLING_FULL=true \
E2E_BASE_URL=https://forus-cs.vercel.app \
E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD='…' \
E2E_SUPERVISOR_EMAIL=supervisor@example.com E2E_SUPERVISOR_PASSWORD='…' \
E2E_AGENT_EMAIL=agent@example.com E2E_AGENT_PASSWORD='…' E2E_AGENT_LABEL='Nom affiché de l’agent' \
pnpm exec playwright test e2e/calling-workflow.spec.ts --project=desktop-chromium
```

Les variables restent dans le gestionnaire de secrets local ou CI ; elles ne
doivent jamais être enregistrées dans un fichier versionné.

Pour une recette isolée, `E2E_CALLING_BOOTSTRAP=true` crée des comptes
temporaires, une organisation et les invitations nécessaires dans le
déploiement Convex de développement. Quand l’authentification Convex ne
reconnaît que l’origine Vercel, lancez-la avec
`E2E_BASE_URL=https://forus-cs.vercel.app`. Ne l’utilisez ni contre une base de
données métier, ni contre le déploiement Convex de production.

## Hors ligne

Le service worker met en cache l’App Shell et les navigations déjà chargées.
IndexedDB conserve de manière idempotente les nouvelles fiches client,
transporteur, appel, relance et incident, puis les rejoue au retour du réseau.
Les autres mutations métier restent volontairement en ligne uniquement.
