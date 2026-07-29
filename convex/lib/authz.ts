import type { OrganizationRole } from '../../shared/domain'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { assertMembershipAccess, assertRoleAllowed } from '../../shared/authz'

type AuthorizationCtx = Pick<QueryCtx, 'auth' | 'db'> | Pick<MutationCtx, 'auth' | 'db'>

export interface AuthenticatedUser {
  userId: string
  identity: Awaited<ReturnType<QueryCtx['auth']['getUserIdentity']>> & object
}

export async function requireAuthenticatedUser(ctx: AuthorizationCtx): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity()

  if (!identity)
    throw new Error('AUTH_REQUIRED')

  return {
    userId: identity.subject,
    identity,
  }
}

export async function requireMembership(
  ctx: AuthorizationCtx,
  organizationId: Id<'organizations'>,
) {
  const { userId } = await requireAuthenticatedUser(ctx)
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_organization_user', query =>
      query.eq('organizationId', organizationId).eq('userId', userId))
    .unique()

  return assertMembershipAccess(userId, organizationId, membership)
}

export async function requireRole(
  ctx: AuthorizationCtx,
  organizationId: Id<'organizations'>,
  allowedRoles: readonly OrganizationRole[],
) {
  const membership = await requireMembership(ctx, organizationId)

  return assertRoleAllowed(membership, allowedRoles)
}

export async function requireOrganizationAccess(
  ctx: AuthorizationCtx,
  organizationId: Id<'organizations'>,
) {
  const membership = await requireMembership(ctx, organizationId)
  const organization = await ctx.db.get(organizationId)

  if (!organization?.isActive)
    throw new Error('ORGANIZATION_INACTIVE')

  return { membership, organization }
}
