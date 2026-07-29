import { describe, expect, it } from 'vitest'
import {
  rankCarriersForNeed,
  scoreCarrierForNeed,
} from '../shared/carrierMatching'

const need = {
  truckType: 'Porteur 10T',
  destination: 'Bouaké',
  remainingTruckCount: 3,
}

describe('matching transporteur et besoin', () => {
  it('explique un match complet', () => {
    const match = scoreCarrierForNeed({
      carrierId: 'carrier-a',
      truckTypes: ['Porteur 10T'],
      destinations: ['Bouaké'],
      activeVehicleTypes: [],
      availableVehicleCount: 3,
      documentsValid: true,
      assignedAgentId: 'agent-a',
    }, need)

    expect(match.score).toBe(95)
    expect(match.reasons).toContain('Type de camion compatible')
    expect(match.reasons).toContain('Destination habituelle')
  })

  it('classe par score puis de manière déterministe par identifiant', () => {
    const ranked = rankCarriersForNeed([
      {
        carrierId: 'carrier-b',
        truckTypes: ['Porteur 10T'],
        destinations: [],
        activeVehicleTypes: [],
        availableVehicleCount: 0,
        documentsValid: false,
      },
      {
        carrierId: 'carrier-a',
        truckTypes: [],
        destinations: ['Bouaké'],
        activeVehicleTypes: ['Porteur 10T'],
        availableVehicleCount: 0,
        documentsValid: false,
      },
    ], need)

    expect(ranked.map(match => match.carrierId)).toEqual(['carrier-a', 'carrier-b'])
  })

  it('écarte les transporteurs sans aucun signal pertinent', () => {
    expect(rankCarriersForNeed([{
      carrierId: 'carrier-z',
      truckTypes: ['Benne'],
      destinations: ['San Pedro'],
      activeVehicleTypes: [],
      availableVehicleCount: 0,
      documentsValid: false,
    }], need)).toEqual([])
  })
})
