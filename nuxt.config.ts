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

  runtimeConfig: {
    // eslint-disable-next-line node/prefer-global/process
    groqApiKey: process.env.NUXT_GROQ_API_KEY ?? '',
    public: publicEnv,
  },

  routeRules: {
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
