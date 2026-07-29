import { describe, expect, it } from 'vitest'
import {
  buildPhoneUrl,
  formatCurrency,
  formatPhoneNumber,
  normalizePhoneNumberForLink,
} from '../app/utils/formatters'
import { buildNeedWhatsAppMessage, buildWhatsAppUrl } from '../app/utils/need-contact'

const need = {
  reference: 'BS-2026-07-29-001',
  clientName: 'SOTRA BTP',
  contactName: 'Awa Koné',
  loadingLocation: 'Abidjan',
  destination: 'Korhogo',
  truckType: 'Semi-remorque',
  requestedTruckCount: 5,
  remainingTruckCount: 3,
  tonnageTons: 30,
  cargoType: 'Ciment',
  mobilizationAt: Date.UTC(2026, 7, 1, 8, 30),
}

describe('utilitaires de contact ivoiriens', () => {
  it('normalise les numéros locaux pour tel et wa.me', () => {
    expect(normalizePhoneNumberForLink('07 08 09 10 11')).toBe('2250708091011')
    expect(normalizePhoneNumberForLink('+225 07 08 09 10 11')).toBe('2250708091011')
    expect(buildPhoneUrl('07 08 09 10 11')).toBe('tel:+2250708091011')
  })

  it('formate le téléphone et la devise pour les interfaces françaises', () => {
    expect(formatPhoneNumber('2250708091011')).toBe('+225 07 08 09 10 11')
    expect(formatCurrency(1_750_000)).toContain('1 750 000 FCFA')
  })

  it('prépare une conversation WhatsApp encodée sans envoi automatique', () => {
    const message = buildNeedWhatsAppMessage(need, 'FOLLOW_UP')
    const url = buildWhatsAppUrl('07 08 09 10 11', message)

    expect(message).toContain('Camions encore à trouver : 3')
    expect(url).toMatch(/^https:\/\/wa\.me\/2250708091011\?text=/)
    expect(decodeURIComponent(url)).toContain('BS-2026-07-29-001')
  })
})
