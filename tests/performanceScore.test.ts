import { describe, expect, it } from 'vitest'
import {
  calculateAgentPerformance,
  estimatePerformanceBonus,
} from '../shared/performanceScore'

describe('score de performance des agents', () => {
  it('applique les pondérations du brief FORUS', () => {
    expect(calculateAgentPerformance({
      calls: 250,
      workingDays: 10,
      newCarriers: 20,
      submittedOptions: 10,
      completedFollowUps: 50,
      responseRate: 80,
    })).toEqual({
      activity: 100,
      baseDevelopment: 100,
      needTreatment: 100,
      portfolioQuality: 100,
      total: 100,
    })
  })

  it('plafonne le score et estime la prime sans dépasser le maximum', () => {
    expect(estimatePerformanceBonus(120, 100_000)).toBe(100_000)
    expect(estimatePerformanceBonus(-10, 100_000)).toBe(0)
    expect(estimatePerformanceBonus(75, 100_000)).toBe(75_000)
  })

  it('retourne zéro quand la prime maximale est invalide', () => {
    expect(estimatePerformanceBonus(80, 0)).toBe(0)
    expect(estimatePerformanceBonus(80, Number.NaN)).toBe(0)
  })
})
