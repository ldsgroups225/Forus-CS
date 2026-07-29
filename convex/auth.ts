import type { GenericCtx } from '@convex-dev/better-auth'
import type { BetterAuthOptions } from 'better-auth/minimal'
import type { DataModel } from './_generated/dataModel'
import { createClient } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'
import { components } from './_generated/api'
import { query } from './_generated/server'
import authConfig from './auth.config'

// eslint-disable-next-line node/prefer-global/process
const siteUrl = process.env.SITE_URL

export const authComponent = createClient<DataModel>(components.betterAuth)

export function createAuth(ctx: GenericCtx<DataModel>) {
  if (!siteUrl)
    throw new Error('SITE_URL doit être configurée dans le déploiement Convex.')

  return betterAuth({
    // eslint-disable-next-line node/prefer-global/process
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions)
}

export const getCurrentUser = query({
  args: {},
  handler: async ctx => authComponent.getAuthUser(ctx),
})
