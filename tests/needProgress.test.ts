import { describe, expect, it } from 'vitest'
import { deriveNeedProgress } from '../shared/needProgress'

describe('deriveNeedProgress', () => {
  it('calcule un besoin ouvert sans camion approuvé', () => {
    expect(deriveNeedProgress(5, 0, false)).toEqual({
      remainingTruckCount: 5,
      status: 'OPEN',
    })
  })

  it('calcule un besoin partiellement satisfait', () => {
    expect(deriveNeedProgress(5, 2, false)).toEqual({
      remainingTruckCount: 3,
      status: 'PARTIAL',
    })
  })

  it('borne le reste à zéro et clôture le besoin', () => {
    expect(deriveNeedProgress(5, 8, false)).toEqual({
      remainingTruckCount: 0,
      status: 'SATISFIED',
    })
  })

  it('priorise toujours le statut annulé', () => {
    expect(deriveNeedProgress(5, 2, true)).toEqual({
      remainingTruckCount: 3,
      status: 'CANCELLED',
    })
  })

  it('rejette les quantités invalides', () => {
    expect(() => deriveNeedProgress(0, 0, false)).toThrow()
    expect(() => deriveNeedProgress(5, -1, false)).toThrow()
    expect(() => deriveNeedProgress(5.5, 1, false)).toThrow()
  })
})
