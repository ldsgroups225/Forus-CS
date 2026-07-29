# Mise en production de Forus CS

## 1. Déploiements séparés

Créer un déploiement Convex de production distinct du déploiement de
développement. Le plan doit absorber la flotte initiale, les abonnements temps
réel, les audits et les appels périodiques. Le déploiement de développement
signale actuellement un dépassement du plan gratuit : ne pas importer les 903
transporteurs en production avant d’avoir choisi un plan adapté.

## 2. Variables Nuxt

Configurer uniquement ces valeurs publiques sur l’hébergeur :

```dotenv
CONVEX_DEPLOYMENT=prod:deployment
NUXT_PUBLIC_CONVEX_URL=https://deployment.convex.cloud
NUXT_PUBLIC_CONVEX_SITE_URL=https://deployment.convex.site
NUXT_PUBLIC_SITE_URL=https://app.example.com
```

`.env.example` reste volontairement limité à ces quatre noms.

## 3. Variables privées Convex

Obligatoires :

```text
BETTER_AUTH_SECRET
SITE_URL
```

E-mail et vérification :

```text
AUTH_EMAIL_WEBHOOK_URL
AUTH_EMAIL_WEBHOOK_SECRET
BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION=true
```

Le webhook reçoit `kind`, `email`, `name` et `url` en JSON, avec
`Authorization: Bearer <secret>`. Il doit répondre en 2xx et ne doit jamais
journaliser les jetons présents dans les URL.

OAuth facultatif :

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

Les boutons OAuth apparaissent seulement lorsqu’une paire ID/secret est
complète. Les callbacks sont :

```text
https://deployment.convex.site/api/auth/callback/google
https://deployment.convex.site/api/auth/callback/github
```

Développement uniquement :

```text
DEVELOPMENT_FLEET_IMPORT_KEY
```

Ne jamais configurer les secrets avec `NUXT_PUBLIC_`.

## 4. Domaine et sécurité

1. Faire pointer le domaine vers l’hébergeur SSR Node 24.
2. Définir exactement le même domaine HTTPS dans `SITE_URL` et
   `NUXT_PUBLIC_SITE_URL`.
3. Autoriser ce domaine chez les fournisseurs OAuth.
4. Vérifier inscription, confirmation d’e-mail, récupération de mot de passe,
   déconnexion et révocation de session.
5. Vérifier avec deux comptes de tenants différents qu’un ID Convex copié depuis
   un autre tenant est rejeté côté serveur.

## 5. Observabilité

- Superviser `GET /api/health` et la page `/`.
- Alerter sur les erreurs Nitro, les échecs Convex, la latence et le quota.
- Suivre les relances échouées et la profondeur de la file hors ligne dans
  l’interface.
- Conserver les `auditLogs` selon une politique de rétention définie par FORUS.
- Ne jamais exporter de secrets, jetons, mots de passe ou contacts complets vers
  un outil de logs.

## 6. CI et E2E

La CI utilise Node 24 et exécute lint, typecheck, tests, build et Playwright.
Les tests publics tournent sans secrets. Pour activer le parcours métier réel :

- variables GitHub : `E2E_FULL=true`, `NUXT_PUBLIC_CONVEX_URL`,
  `NUXT_PUBLIC_CONVEX_SITE_URL` ;
- secrets GitHub : `E2E_EMAIL`, `E2E_PASSWORD`.

Utiliser un tenant E2E séparé, sans données clients de production. Les rapports
Playwright sont conservés 14 jours.

## 7. Intégrations non activables sans fournisseur

L’application fournit les liens directs téléphone et `wa.me`. L’envoi WhatsApp
Business, le push web en arrière-plan et l’e-mail transactionnel nécessitent
respectivement un compte fournisseur, des clés VAPID et un webhook d’e-mail.
Le code ne doit pas simuler leur activation en production.

## 8. Go-live

Exécuter avant publication :

```bash
pnpm install --frozen-lockfile
pnpm exec convex dev --once
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

Puis vérifier le manifeste PWA, les icônes, le service worker, `/api/health`,
la connexion réelle et un parcours complet Besoin → Option → Mission.
