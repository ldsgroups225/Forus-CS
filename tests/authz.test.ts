import type { MembershipAccess } from '../shared/authz'
import { describe, expect, it } from 'vitest'
import { assertMembershipAccess, assertRoleAllowed } from '../shared/authz'

const membership: MembershipAccess = {
  organizationId: 'organization-forus',
  userId: 'user-operations',
  role: 'OPERATIONS_MANAGER',
  isActive: true,
}

describe('autorisation multi-tenant', () => {
  it('autorise le membre actif dans son organisation', () => {
    expect(assertMembershipAccess(
      'user-operations',
      'organization-forus',
      membership,
    )).toBe(membership)
  })

  it('refuse le même utilisateur dans une autre organisation', () => {
    expect(() => assertMembershipAccess(
      'user-operations',
      'organization-concurrente',
      membership,
    )).toThrow('ORGANIZATION_ACCESS_DENIED')
  })

  it('refuse le membership d’un autre utilisateur', () => {
    expect(() => assertMembershipAccess(
      'user-intrus',
      'organization-forus',
      membership,
    )).toThrow('ORGANIZATION_ACCESS_DENIED')
  })

  it('refuse un membership désactivé', () => {
    expect(() => assertMembershipAccess(
      'user-operations',
      'organization-forus',
      { ...membership, isActive: false },
    )).toThrow('ORGANIZATION_ACCESS_DENIED')
  })

  it('réserve les écritures aux rôles autorisés', () => {
    expect(assertRoleAllowed(
      membership,
      ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'],
    )).toBe(membership)

    expect(() => assertRoleAllowed(
      { ...membership, role: 'AGENT' },
      ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'],
    )).toThrow('ROLE_FORBIDDEN')
  })
})
