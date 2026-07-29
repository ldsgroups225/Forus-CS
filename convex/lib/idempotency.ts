import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export async function findIdempotentResult(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  key: string | undefined,
) {
  if (!key)
    return null

  return await ctx.db
    .query('mutationReceipts')
    .withIndex('by_organization_key', query =>
      query.eq('organizationId', organizationId).eq('key', key))
    .unique()
}

export async function recordIdempotentResult(
  ctx: MutationCtx,
  input: {
    organizationId: Id<'organizations'>
    key?: string
    operation: string
    resultId?: string
  },
) {
  if (!input.key)
    return

  await ctx.db.insert('mutationReceipts', {
    organizationId: input.organizationId,
    key: input.key,
    operation: input.operation,
    resultId: input.resultId,
    createdAt: Date.now(),
  })
}
