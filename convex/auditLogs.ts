import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireOrganizationAccess } from './lib/authz'

export const listForEntity = query({
  args: {
    organizationId: v.id('organizations'),
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const logs = await ctx.db
      .query('auditLogs')
      .withIndex('by_organization_entity', query =>
        query
          .eq('organizationId', args.organizationId)
          .eq('entityType', args.entityType)
          .eq('entityId', args.entityId))
      .collect()

    return logs.sort((left, right) => right.createdAt - left.createdAt)
  },
})
