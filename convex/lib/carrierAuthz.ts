import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireOrganizationAccess } from './authz'

type CarrierAuthorizationCtx
  = Pick<QueryCtx, 'auth' | 'db'>
    | Pick<MutationCtx, 'auth' | 'db'>

const managementRoles = new Set([
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
])

export async function requireCarrierWriteAccess(
  ctx: CarrierAuthorizationCtx,
  organizationId: Id<'organizations'>,
  carrierId: Id<'carriers'>,
) {
  const { membership } = await requireOrganizationAccess(ctx, organizationId)
  if (managementRoles.has(membership.role))
    return membership

  const assignment = await ctx.db
    .query('carrierAssignments')
    .withIndex('by_organization_carrier', query =>
      query.eq('organizationId', organizationId).eq('carrierId', carrierId))
    .unique()

  if (!assignment || assignment.agentId !== membership.userId)
    throw new Error('CARRIER_WRITE_ACCESS_DENIED')

  return membership
}
