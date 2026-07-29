import type { CarrierOptionStatus, MissionStatus, NeedStatus, NeedUrgency } from '~~/shared/domain'

const nonDigitPattern = /\D/g
const ciPhonePattern = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/

export function formatDateTime(value: number | string) {
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Abidjan',
  }).format(date)
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
    ...options,
  }).format(value)
}

export function formatCurrency(value?: number) {
  if (value === undefined)
    return 'Non renseigné'

  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value)

  return formatted
    .replace('F CFA', 'FCFA')
    .replace(/\s+FCFA$/, ' FCFA')
}

export function normalizePhoneNumberForLink(value?: string) {
  let digits = value?.replace(nonDigitPattern, '') ?? ''

  if (digits.startsWith('00'))
    digits = digits.slice(2)

  if (digits && !digits.startsWith('225'))
    digits = `225${digits}`

  return digits
}

export function formatPhoneNumber(value?: string) {
  const digits = normalizePhoneNumberForLink(value)
  const localDigits = digits.startsWith('225') ? digits.slice(3) : digits

  if (!ciPhonePattern.test(localDigits))
    return value?.trim() ?? ''

  return `+225 ${localDigits.replace(ciPhonePattern, '$1 $2 $3 $4 $5')}`
}

export function buildPhoneUrl(value: string) {
  const phone = normalizePhoneNumberForLink(value)
  return phone ? `tel:+${phone}` : ''
}

export function needStatusTone(status: NeedStatus) {
  return {
    DRAFT: 'neutral',
    OPEN: 'success',
    PARTIAL: 'warning',
    SATISFIED: 'info',
    CANCELLED: 'danger',
  }[status] as 'neutral' | 'success' | 'warning' | 'info' | 'danger'
}

export function needUrgencyTone(urgency: NeedUrgency) {
  return {
    LOW: 'neutral',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'danger',
  }[urgency] as 'neutral' | 'info' | 'warning' | 'danger'
}

export function carrierOptionStatusTone(status: CarrierOptionStatus) {
  return {
    PENDING: 'warning',
    NEGOTIATION: 'info',
    ACCEPTED: 'success',
    REFUSED: 'danger',
  }[status] as 'warning' | 'info' | 'success' | 'danger'
}

export function missionStatusTone(status: MissionStatus) {
  return {
    CONFIRMED: 'success',
  }[status] as 'success'
}
