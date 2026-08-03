import { loadEnv } from 'vite'
import { pwa } from './app/config/pwa'
import { appDescription } from './app/constants/index'

const localPublicEnv = loadEnv(
  // eslint-disable-next-line node/prefer-global/process
  process.env.NODE_ENV ?? 'development',
  // eslint-disable-next-line node/prefer-global/process
  process.cwd(),
  'NUXT_PUBLIC_',
)

const publicEnv = {
  // eslint-disable-next-line node/prefer-global/process
  convexUrl: process.env.NUXT_PUBLIC_CONVEX_URL ?? localPublicEnv.NUXT_PUBLIC_CONVEX_URL ?? '',
  // eslint-disable-next-line node/prefer-global/process
  convexSiteUrl: process.env.NUXT_PUBLIC_CONVEX_SITE_URL ?? localPublicEnv.NUXT_PUBLIC_CONVEX_SITE_URL ?? '',
  // eslint-disable-next-line node/prefer-global/process
  siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? localPublicEnv.NUXT_PUBLIC_SITE_URL ?? '',
}

const securityHeaders = {
  'Content-Security-Policy': [
    'default-src \'self\'',
    'base-uri \'self\'',
    'object-src \'none\'',
    'frame-ancestors \'none\'',
    'form-action \'self\' https://*.convex.site',
    'img-src \'self\' data: blob:',
    'font-src \'self\' data: https://fonts.gstatic.com',
    'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com',
    'script-src \'self\' \'unsafe-inline\'',
    'connect-src \'self\' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site',
    'worker-src \'self\' blob:',
  ].join('; '),
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
  ],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'fr',
      },
      viewport: 'width=device-width,initial-scale=1',
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'theme-color', content: '#07111f' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'system',
    fallback: 'system',
    classSuffix: '',
  },

  runtimeConfig: { public: publicEnv },

  routeRules: {
    '/**': { headers: securityHeaders },
    '/': { ssr: false },
    '/login': { ssr: false },
    '/register': { ssr: false },
    '/invite/**': { ssr: false },
    '/onboarding/**': { ssr: false },
    '/o/**': { ssr: false },
  },

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    // when using generate, payload js assets included in sw precache manifest
    // but missing on offline, disabling extraction it until fixed
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  compatibilityDate: '2026-07-29',

  nitro: {
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
    prerender: {
      crawlLinks: false,
      routes: ['/', '/offline'],
    },
  },

  eslint: {
    config: {
      standalone: false,
      nuxt: {
        sortConfigKeys: true,
      },
    },
  },

  pwa,
})
