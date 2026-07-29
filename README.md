# Forus CS — Forus Call Center

PWA SaaS multi-tenant pour piloter les besoins de transport de FORUS.

La première verticale fonctionnelle couvre :

1. inscription et connexion ;
2. création ou sélection d’une organisation ;
3. création d’un besoin en brouillon ;
4. publication et liste des besoins actifs ;
5. consultation, modification et annulation ;
6. soumission, négociation, acceptation ou refus d’une option transporteur ;
7. création atomique d’une mission et mise à jour des camions approuvés ;
8. audit des actions importantes.

## Architecture

- Nuxt 4, Vue 3 et TypeScript strict pour l’application SSR ;
- UnoCSS et variables CSS pour le design system ;
- Better Auth Vue pour les sessions ;
- Convex pour les données métier, les requêtes temps réel et l’autorisation ;
- Pinia réservé aux futurs états locaux d’interface ;
- Vite PWA pour l’installation et la consultation des pages déjà chargées.

Le serveur Nitro rend l’App Shell, l’accueil et l’écran hors ligne. Les routes
d’authentification et métier (`/login`, `/register`, `/onboarding/**`, `/o/**`)
sont rendues côté client : elles dépendent du bridge navigateur Better
Auth–Convex et de ses abonnements temps réel.

Chaque fonction Convex vérifie le membership de l’utilisateur dans
l’organisation ciblée. Les écritures sur les besoins et les décisions d’option
sont réservées aux rôles `ORGANIZATION_ADMIN` et `OPERATIONS_MANAGER`. Tous les
membres actifs peuvent soumettre une option ; chaque acceptation crée une seule
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

## Données de démonstration

Après inscription, utilisez **Charger la démonstration FORUS** sur l’écran de
création d’organisation. Le bouton n’existe qu’en développement et la mutation
refuse aussi de s’exécuter lorsque `SITE_URL` ne pointe pas vers localhost.

Le seed crée `FORUS GROUP`, trois clients et huit besoins. Il est idempotent
pour chaque utilisateur connecté.

## Contrôles qualité

```bash
pnpm exec convex dev --once
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Les tests couvrent le calcul de progression, le reste à trouver, les références,
l’acceptation partielle ou complète d’une option et l’isolement multi-tenant.

## Hors ligne

Le service worker met en cache l’App Shell et les navigations déjà chargées.
Les mutations métier ne sont pas mises en file dans cette version. Leur future
frontière d’intégration est définie dans
[`app/lib/offline-mutation-queue.ts`](./app/lib/offline-mutation-queue.ts).
