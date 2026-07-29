import type { MembershipAccess } from './authz'

export const fullCarrierAccessRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
] as const

export const fullCarrierAccessEmails = [
  'kassidarius@gmail.com',
] as const

export interface CarrierAssignmentAccess {
  agentId?: string
  callingAgentId?: string
}

function normalizedEmail(value?: string) {
  return value?.trim().toLocaleLowerCase()
}

export function canViewAllCarriers(
  membership: MembershipAccess,
  authenticatedEmail?: string,
) {
  return fullCarrierAccessRoles.includes(membership.role as typeof fullCarrierAccessRoles[number])
    || fullCarrierAccessEmails.includes(normalizedEmail(membership.email) as typeof fullCarrierAccessEmails[number])
    || fullCarrierAccessEmails.includes(normalizedEmail(authenticatedEmail) as typeof fullCarrierAccessEmails[number])
}

export function assertCarrierReadAccess(
  membership: MembershipAccess,
  assignment: CarrierAssignmentAccess | null,
  authenticatedEmail?: string,
  linkedCallingAgentIds: readonly string[] = [],
) {
  if (canViewAllCarriers(membership, authenticatedEmail))
    return membership

  if (
    !assignment
    || (
      assignment.agentId !== membership.userId
      && (!assignment.callingAgentId || !linkedCallingAgentIds.includes(assignment.callingAgentId))
    )
  ) {
    throw new Error('CARRIER_READ_ACCESS_DENIED')
  }

  return membership
}
