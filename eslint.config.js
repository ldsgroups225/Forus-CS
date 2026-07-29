// @ts-check
import antfu from '@antfu/eslint-config'
import nuxt from './.nuxt/eslint.config.mjs'

export default antfu(
  {
    unocss: true,
    formatters: true,
    ignores: ['convex/_generated/**'],
    pnpm: true,
  },
)
  .append(nuxt())
