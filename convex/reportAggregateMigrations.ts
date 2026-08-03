import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { insertCallIntoReports } from './lib/reportAggregates'

export const backfillCalls = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('callLogs').paginate(args.paginationOpts)
    for (const call of page.page)
      await insertCallIntoReports(ctx, call)
    return { isDone: page.isDone, continueCursor: page.continueCursor }
  },
})
