import { describe, expect, it } from 'vitest'
import { getCallingTruckTypeOptions, matchesCallingTruckTypeFilter } from '../app/utils/calling-truck-types'

describe('calling truck type filters', () => {
  const carriers = [
    { truckTypes: ['Benne', 'Plateau'] },
    { truckTypes: ['plateau'] },
    { truckTypes: ['Citerne'] },
  ]

  it('deduplicates types without losing their readable label', () => {
    expect(getCallingTruckTypeOptions(carriers)).toEqual([
      { value: 'benne', label: 'Benne' },
      { value: 'citerne', label: 'Citerne' },
      { value: 'plateau', label: 'Plateau' },
    ])
  })

  it('keeps carriers that match any selected type', () => {
    expect(matchesCallingTruckTypeFilter(carriers[0], ['benne', 'citerne'])).toBe(true)
    expect(matchesCallingTruckTypeFilter(carriers[1], ['benne', 'citerne'])).toBe(false)
    expect(matchesCallingTruckTypeFilter(carriers[2], ['benne', 'citerne'])).toBe(true)
  })

  it('does not filter the portfolio when no type is selected', () => {
    expect(matchesCallingTruckTypeFilter(carriers[1], [])).toBe(true)
  })
})
