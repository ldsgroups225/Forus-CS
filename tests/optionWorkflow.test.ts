import { describe, expect, it } from 'vitest'
import { applyOptionAcceptance, canDecideValidatedOption } from '../shared/optionWorkflow'

describe('applyOptionAcceptance', () => {
  it('crée une progression partielle sans dépasser la proposition', () => {
    expect(applyOptionAcceptance(5, 0, 3, 2)).toEqual({
      approvedTruckCount: 2,
      remainingTruckCount: 3,
      status: 'PARTIAL',
    })
  })

  it('satisfait le besoin lorsque le dernier camion est accepté', () => {
    expect(applyOptionAcceptance(5, 3, 2, 2)).toEqual({
      approvedTruckCount: 5,
      remainingTruckCount: 0,
      status: 'SATISFIED',
    })
  })

  it('refuse une acceptation supérieure à la proposition', () => {
    expect(() => applyOptionAcceptance(5, 0, 2, 3))
      .toThrow('OPTION_ACCEPTED_COUNT_EXCEEDS_PROPOSAL')
  })

  it('refuse une acceptation supérieure au reste du besoin', () => {
    expect(() => applyOptionAcceptance(5, 4, 3, 2))
      .toThrow('OPTION_ACCEPTED_COUNT_EXCEEDS_REMAINING')
  })

  it('refuse les quantités nulles, négatives ou décimales', () => {
    expect(() => applyOptionAcceptance(5, 0, 1, 0))
      .toThrow('OPTION_ACCEPTED_COUNT_INVALID')
    expect(() => applyOptionAcceptance(5, 0, 1, -1))
      .toThrow('OPTION_ACCEPTED_COUNT_INVALID')
    expect(() => applyOptionAcceptance(5, 0, 1, 0.5))
      .toThrow('OPTION_ACCEPTED_COUNT_INVALID')
  })
})

describe('canDecideValidatedOption', () => {
  it('autorise uniquement une option validée par le superviseur', () => {
    expect(canDecideValidatedOption('VALIDATED')).toBe(true)
    expect(canDecideValidatedOption('PENDING')).toBe(false)
    expect(canDecideValidatedOption('NEGOTIATION')).toBe(false)
    expect(canDecideValidatedOption('ACCEPTED')).toBe(false)
    expect(canDecideValidatedOption('REFUSED')).toBe(false)
  })
})
