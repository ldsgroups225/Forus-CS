import { Presence } from '@convex-dev/presence'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireAuthenticatedUser, requireOrganizationAccess } from './lib/authz'

const presence = new Presence(components.presence)
const heartbeatIntervalMs = 30_000

function roomId(organizationId: string) {
  return `organization:${organizationId}`
}

async function isEnabled(ctx: Parameters<typeof requireOrganizationAccess>[0], organizationId: Parameters<typeof requireOrganizationAccess>[1]) {
  const settings = await ctx.db
    .query('organizationSettings')
    .withIndex('by_organization', q => q.eq('organizationId', organizationId))
    .unique()
  return settings?.presenceEnabled === true
}

export const heartbeat = mutation({
  args: { organizationId: v.id('organizations'), sessionId: v.string() },
  returns: v.union(v.null(), v.object({ roomToken: v.string(), sessionToken: v.string() })),
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    if (!await isEnabled(ctx, args.organizationId))
      return null
    return await presence.heartbeat(ctx, roomId(args.organizationId), userId, args.sessionId, heartbeatIntervalMs)
  },
})

export const listTeam = query({
  args: { organizationId: v.id('organizations') },
  returns: v.array(v.object({
    userId: v.string(),
    displayName: v.string(),
    role: v.string(),
  })),
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    if (!await isEnabled(ctx, args.organizationId))
      return []
    const [online, members] = await Promise.all([
      presence.listRoom(ctx, roomId(args.organizationId), true, 100),
      ctx.db.query('memberships')
        .withIndex('by_organization', q => q.eq('organizationId', args.organizationId))
        .take(100),
    ])
    const membersByUser = new Map(members.filter(member => member.isActive).map(member => [member.userId, member]))
    return online.flatMap((entry) => {
      const member = membersByUser.get(entry.userId)
      return member
        ? [{
            userId: member.userId,
            displayName: member.displayName ?? member.email ?? member.userId,
            role: member.role,
          }]
        : []
    })
  },
})
