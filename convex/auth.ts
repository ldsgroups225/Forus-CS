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

async function deliverAuthEmail(input: {
  kind: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION'
  email: string
  name: string
  url: string
}) {
  // eslint-disable-next-line node/prefer-global/process
  const webhookUrl = process.env.AUTH_EMAIL_WEBHOOK_URL
  // eslint-disable-next-line node/prefer-global/process
  const webhookSecret = process.env.AUTH_EMAIL_WEBHOOK_SECRET
  if (!webhookUrl || !webhookSecret)
    throw new Error('AUTH_EMAIL_DELIVERY_NOT_CONFIGURED')

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${webhookSecret}`,
    },
    body: JSON.stringify(input),
  })
  if (!response.ok)
    throw new Error('AUTH_EMAIL_DELIVERY_FAILED')
}

export const authComponent = createClient<DataModel>(components.betterAuth)

export function createAuth(ctx: GenericCtx<DataModel>) {
  if (!siteUrl)
    throw new Error('SITE_URL doit être configurée dans le déploiement Convex.')

  // eslint-disable-next-line node/prefer-global/process
  const requireEmailVerification = process.env.BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION === 'true'
  // eslint-disable-next-line node/prefer-global/process
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  // eslint-disable-next-line node/prefer-global/process
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  // eslint-disable-next-line node/prefer-global/process
  const githubClientId = process.env.GITHUB_CLIENT_ID
  // eslint-disable-next-line node/prefer-global/process
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET

  return betterAuth({
    // eslint-disable-next-line node/prefer-global/process
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      sendResetPassword: async ({ user, url }) => {
        await deliverAuthEmail({
          kind: 'PASSWORD_RESET',
          email: user.email,
          name: user.name,
          url,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await deliverAuthEmail({
          kind: 'EMAIL_VERIFICATION',
          email: user.email,
          name: user.name,
          url,
        })
      },
    },
    socialProviders: {
      ...(googleClientId && googleClientSecret
        ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
        : {}),
      ...(githubClientId && githubClientSecret
        ? { github: { clientId: githubClientId, clientSecret: githubClientSecret } }
        : {}),
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

export const getCapabilities = query({
  args: {},
  handler: async () => ({
    // Only capability flags are public. Provider credentials stay private.
    // eslint-disable-next-line node/prefer-global/process
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    // eslint-disable-next-line node/prefer-global/process
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    // eslint-disable-next-line node/prefer-global/process
    emailVerification: process.env.BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION === 'true',
  }),
})
