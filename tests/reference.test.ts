import { describe, expect, it } from 'vitest'
import {
  formatMissionReference,
  formatNeedReference,
  formatOptionReference,
} from '../shared/reference'

describe('formatNeedReference', () => {
  it('respecte le format BS-AAAA-MM-JJ-XXX', () => {
    expect(formatNeedReference(new Date('2026-07-29T08:00:00Z'), 1))
      .toBe('BS-2026-07-29-001')
  })

  it('conserve une séquence distincte pour la même date', () => {
    const date = new Date('2026-12-05T16:30:00Z')
    expect(formatNeedReference(date, 41)).toBe('BS-2026-12-05-041')
    expect(formatNeedReference(date, 42)).toBe('BS-2026-12-05-042')
  })

  it('refuse une séquence hors de la plage du suffixe', () => {
    const date = new Date('2026-07-29T08:00:00Z')
    expect(() => formatNeedReference(date, 0)).toThrow()
    expect(() => formatNeedReference(date, 1000)).toThrow()
  })

  it('génère les références des options et des missions', () => {
    const date = new Date('2026-07-29T08:00:00Z')
    expect(formatOptionReference(date, 7)).toBe('OPT-2026-07-29-007')
    expect(formatMissionReference(date, 12)).toBe('MS-2026-07-29-012')
  })
})
