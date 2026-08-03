import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { canViewAllCarriers } from '../../shared/carrierAccess'
import { requireOrganizationAccess } from './authz'

type CarrierAuthorizationCtx
  = Pick<QueryCtx, 'auth' | 'db'>
    | Pick<MutationCtx, 'auth' | 'db'>

export async function requireCarrierWriteAccess(
  ctx: CarrierAuthorizationCtx,
  organizationId: Id<'organizations'>,
  carrierId: Id<'carriers'>,
) {
  const { membership } = await requireOrganizationAccess(ctx, organizationId)
  if (canViewAllCarriers(membership))
    return membership

  if (!await hasAssignedCarrierAccess(ctx, organizationId, carrierId, membership.userId))
    throw new Error('CARRIER_WRITE_ACCESS_DENIED')

  return membership
}

/** One portfolio rule for all agent actions: direct assignment or Calling envelope. */
export async function hasAssignedCarrierAccess(
  ctx: Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>,
  organizationId: Id<'organizations'>,
  carrierId: Id<'carriers'>,
  userId: string,
) {
  const assignment = await ctx.db
    .query('carrierAssignments')
    .withIndex('by_organization_carrier', query =>
      query.eq('organizationId', organizationId).eq('carrierId', carrierId))
    .unique()

  const linkedCallingAgents = await ctx.db
    .query('callingAgents')
    .withIndex('by_organization_linked_user', query =>
      query.eq('organizationId', organizationId).eq('linkedUserId', userId))
    .collect()
  const linkedCallingAgentIds = new Set(linkedCallingAgents.map(callingAgent => callingAgent._id))

  return Boolean(
    assignment
    && (
      assignment.agentId === userId
      || (assignment.callingAgentId && linkedCallingAgentIds.has(assignment.callingAgentId))
    ),
  )
}
