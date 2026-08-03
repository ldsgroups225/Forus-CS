import type { OrganizationRole } from './domain'

export interface MembershipAccess {
  organizationId: string
  userId: string
  role: OrganizationRole
  isActive: boolean
  email?: string
}

export function assertMembershipAccess(
  authenticatedUserId: string,
  requestedOrganizationId: string,
  membership: MembershipAccess | null,
) {
  if (
    !membership
    || !membership.isActive
    || membership.userId !== authenticatedUserId
    || membership.organizationId !== requestedOrganizationId
  ) {
    throw new Error('ORGANIZATION_ACCESS_DENIED')
  }

  return membership
}

export function assertRoleAllowed(
  membership: MembershipAccess,
  allowedRoles: readonly OrganizationRole[],
) {
  if (!allowedRoles.includes(membership.role))
    throw new Error('ROLE_FORBIDDEN')

  return membership
}
