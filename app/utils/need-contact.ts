import { formatDateTime, formatNumber, normalizePhoneNumberForLink } from './formatters'

export type NeedConversation = 'BRIEF' | 'MOBILIZATION' | 'FOLLOW_UP'

export interface NeedContactSummary {
  reference: string
  clientName: string
  contactName?: string
  loadingLocation: string
  destination: string
  truckType: string
  requestedTruckCount: number
  remainingTruckCount: number
  tonnageTons: number
  cargoType: string
  mobilizationAt: number
}

function recipient(need: NeedContactSummary) {
  return need.contactName?.trim() || need.clientName
}

function route(need: NeedContactSummary) {
  return `${need.loadingLocation} → ${need.destination}`
}

export function buildNeedWhatsAppMessage(
  need: NeedContactSummary,
  conversation: NeedConversation,
) {
  const greeting = `Bonjour ${recipient(need)},`

  if (conversation === 'MOBILIZATION') {
    return [
      greeting,
      '',
      `Nous confirmons la mobilisation du besoin ${need.reference}.`,
      `Trajet : ${route(need)}`,
      `Camion : ${need.truckType} · ${formatNumber(need.tonnageTons)} T`,
      `Date : ${formatDateTime(need.mobilizationAt)}`,
      '',
      'Merci de confirmer la disponibilité de votre équipe.',
      'Équipe Forus CS',
    ].join('\n')
  }

  if (conversation === 'FOLLOW_UP') {
    return [
      greeting,
      '',
      `Point de suivi pour le besoin ${need.reference}.`,
      `Camions encore à trouver : ${formatNumber(need.remainingTruckCount)}`,
      `Trajet : ${route(need)}`,
      `Mobilisation : ${formatDateTime(need.mobilizationAt)}`,
      '',
      'Pouvez-vous nous confirmer votre avancement ?',
      'Équipe Forus CS',
    ].join('\n')
  }

  return [
    greeting,
    '',
    `Voici le brief du besoin ${need.reference}.`,
    `Trajet : ${route(need)}`,
    `Marchandise : ${need.cargoType}`,
    `Camion : ${need.truckType} · ${formatNumber(need.tonnageTons)} T`,
    `Quantité : ${formatNumber(need.requestedTruckCount)} camion(s)`,
    `Mobilisation : ${formatDateTime(need.mobilizationAt)}`,
    '',
    'Merci de confirmer la bonne réception.',
    'Équipe Forus CS',
  ].join('\n')
}

export function buildWhatsAppUrl(
  phone: string,
  message: string,
) {
  const normalizedPhone = normalizePhoneNumberForLink(phone)
  if (!normalizedPhone)
    return ''

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}
