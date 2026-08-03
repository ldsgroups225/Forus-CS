import type { ModuleOptions } from '@vite-pwa/nuxt'
import process from 'node:process'
import { appDescription, appName } from '../constants/index'

const scope = '/'
export const navigationFallbackDenylist = [
  /^\/api\//,
  /^\/invite\//,
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
]

export const pwa: ModuleOptions = {
  registerType: 'autoUpdate',
  scope,
  base: scope,
  manifest: {
    id: scope,
    start_url: scope,
    scope,
    name: appName,
    short_name: 'Forus CS',
    description: appDescription,
    theme_color: '#07111f',
    background_color: '#07111f',
    display: 'standalone',
    orientation: 'any',
    lang: 'fr',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'maskable-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    globPatterns: ['**/*.{js,css,html,txt,png,ico,svg,woff2}'],
    navigateFallbackDenylist: navigationFallbackDenylist,
    navigateFallback: '/',
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts.googleapis.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: ({ request, url }) =>
          request.mode === 'navigate'
          && ![
            /^\/api\//,
            /^\/invite\//,
            /^\/login$/,
            /^\/register$/,
            /^\/forgot-password$/,
            /^\/reset-password$/,
          ].some(pattern => pattern.test(url.pathname)),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'forus-pages',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts.gstatic.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
  registerWebManifestInRouteRules: true,
  writePlugin: true,
  devOptions: {
    enabled: process.env.VITE_PLUGIN_PWA === 'true',
    navigateFallback: scope,
  },
}
