import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

/**
 * Safe, rerunnable backfill for records created before named Calling vehicles.
 * It never invents a plate; those options remain readable as TO_VERIFY.
 */
export const markHistoricOptionsIncomplete = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('carrierOptions').paginate(args.paginationOpts)
    for (const option of page.page) {
      if (option.documentStatus)
        continue
      const vehicles = await ctx.db
        .query('carrierOptionVehicles')
        .withIndex('by_option', query => query.eq('optionId', option._id))
        .collect()
      const confirmed = vehicles.length === option.proposedTruckCount
        && vehicles.every(vehicle => vehicle.documentsConfirmed)
      await ctx.db.patch(option._id, {
        documentsConfirmed: confirmed,
        documentStatus: confirmed ? 'CONFIRMED' : 'TO_VERIFY',
      })
    }
    return { isDone: page.isDone, continueCursor: page.continueCursor }
  },
})
