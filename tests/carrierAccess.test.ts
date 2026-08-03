import type { MembershipAccess } from '../shared/authz'
import { describe, expect, it } from 'vitest'
import { assertCarrierReadAccess, canViewAllCarriers } from '../shared/carrierAccess'

const agentMembership: MembershipAccess = {
  organizationId: 'forus-group',
  userId: 'agent-calling-1',
  role: 'AGENT',
  isActive: true,
}

describe('visibilité des transporteurs', () => {
  it('réserve la liste complète aux rôles élevés', () => {
    expect(canViewAllCarriers({ ...agentMembership, role: 'ORGANIZATION_ADMIN' })).toBe(true)
    expect(canViewAllCarriers({ ...agentMembership, role: 'OPERATIONS_MANAGER' })).toBe(true)
    expect(canViewAllCarriers({ ...agentMembership, role: 'SUPERVISOR' })).toBe(true)
    expect(canViewAllCarriers(agentMembership)).toBe(false)
  })

  it('autorise Darius Kassi par son adresse e-mail même sans rôle élevé', () => {
    expect(canViewAllCarriers(agentMembership, 'kassidarius@gmail.com')).toBe(true)
  })

  it('limite un agent calling à ses transporteurs assignés', () => {
    expect(assertCarrierReadAccess(
      agentMembership,
      { agentId: 'agent-calling-1' },
    )).toBe(agentMembership)

    expect(() => assertCarrierReadAccess(
      agentMembership,
      { agentId: 'agent-calling-2' },
    )).toThrow('CARRIER_READ_ACCESS_DENIED')

    expect(() => assertCarrierReadAccess(agentMembership, null))
      .toThrow('CARRIER_READ_ACCESS_DENIED')
  })

  it('autorise un agent réel lié à une enveloppe calling', () => {
    expect(assertCarrierReadAccess(
      agentMembership,
      { callingAgentId: 'calling-agent-1' },
      undefined,
      ['calling-agent-1'],
    )).toBe(agentMembership)

    expect(() => assertCarrierReadAccess(
      agentMembership,
      { callingAgentId: 'calling-agent-2' },
      undefined,
      ['calling-agent-1'],
    )).toThrow('CARRIER_READ_ACCESS_DENIED')
  })
})
