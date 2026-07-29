import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireOrganizationAccess } from './lib/authz'

export const listForCarrier = query({
  args: {
    carrierId: v.id('carriers'),
  },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      return []
    await requireOrganizationAccess(ctx, carrier.organizationId)
    const drivers = await ctx.db
      .query('drivers')
      .withIndex('by_organization', query =>
        query.eq('organizationId', carrier.organizationId))
      .collect()

    return drivers.filter(driver => driver.carrierId === args.carrierId)
  },
})
