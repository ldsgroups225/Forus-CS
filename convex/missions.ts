import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireOrganizationAccess } from './lib/authz'

async function enrichMission(
  ctx: Pick<QueryCtx, 'db'>,
  mission: Doc<'missions'>,
) {
  const need = await ctx.db.get(mission.needId)
  if (!need)
    throw new Error('NEED_NOT_FOUND')

  const client = await ctx.db.get(need.clientId)
  return {
    ...mission,
    needReference: need.reference,
    needStatus: need.status,
    clientName: client?.name ?? 'Client inconnu',
  }
}

export const getById = query({
  args: {
    missionId: v.id('missions'),
  },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get(args.missionId)
    if (!mission)
      return null

    await requireOrganizationAccess(ctx, mission.organizationId)
    return await enrichMission(ctx, mission)
  },
})

export const listForOrganization = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const missions = await ctx.db
      .query('missions')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return await Promise.all(
      missions
        .sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt)
        .map(mission => enrichMission(ctx, mission)),
    )
  },
})
