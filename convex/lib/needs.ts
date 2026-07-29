import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { formatNeedReference } from '../../shared/reference'

export const NEED_WRITE_ROLES = ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'] as const

export async function generateNeedReference(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  now: Date,
) {
  const dateKey = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const counter = await ctx.db
    .query('referenceCounters')
    .withIndex('by_organization_date', query =>
      query.eq('organizationId', organizationId).eq('dateKey', dateKey))
    .unique()

  const sequence = (counter?.sequence ?? 0) + 1
  const reference = formatNeedReference(now, sequence)

  const duplicate = await ctx.db
    .query('needs')
    .withIndex('by_organization_reference', query =>
      query.eq('organizationId', organizationId).eq('reference', reference))
    .unique()

  if (duplicate)
    throw new Error('NEED_REFERENCE_CONFLICT')

  if (counter)
    await ctx.db.patch(counter._id, { sequence })
  else
    await ctx.db.insert('referenceCounters', { organizationId, dateKey, sequence })

  return reference
}
