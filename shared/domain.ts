export const organizationRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
  'AGENT',
] as const

export const needStatuses = [
  'DRAFT',
  'OPEN',
  'PARTIAL',
  'SATISFIED',
  'CANCELLED',
] as const

export const needUrgencies = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const

export const carrierOptionStatuses = [
  'PENDING',
  'VALIDATED',
  'NEGOTIATION',
  'ACCEPTED',
  'REFUSED',
] as const

export const missionStatuses = [
  'CONFIRMED',
  'MOBILIZING',
  'LOADING',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const

export const invitationStatuses = [
  'PENDING',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED',
] as const

export const carrierSegments = [
  'A',
  'B',
  'C',
  'D',
] as const

export const carrierAvailabilityStatuses = [
  'AVAILABLE',
  'RESERVED',
  'UNAVAILABLE',
] as const

export const incidentSeverities = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const

export const incidentStatuses = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const

export const callOutcomes = [
  'AVAILABLE',
  'UNAVAILABLE',
  'CALLBACK',
  'NO_ANSWER',
  'WRONG_NUMBER',
] as const

export const followUpStatuses = [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
] as const

export type OrganizationRole = typeof organizationRoles[number]
export type NeedStatus = typeof needStatuses[number]
export type NeedUrgency = typeof needUrgencies[number]
export type CarrierOptionStatus = typeof carrierOptionStatuses[number]
export type MissionStatus = typeof missionStatuses[number]
export type InvitationStatus = typeof invitationStatuses[number]
export type CarrierSegment = typeof carrierSegments[number]
export type CarrierAvailabilityStatus = typeof carrierAvailabilityStatuses[number]
export type IncidentSeverity = typeof incidentSeverities[number]
export type IncidentStatus = typeof incidentStatuses[number]
export type CallOutcome = typeof callOutcomes[number]
export type FollowUpStatus = typeof followUpStatuses[number]

export const roleLabels: Record<OrganizationRole, string> = {
  ORGANIZATION_ADMIN: 'Administrateur',
  OPERATIONS_MANAGER: 'Responsable Opérations',
  SUPERVISOR: 'Superviseur',
  AGENT: 'Agent',
}

export const needStatusLabels: Record<NeedStatus, string> = {
  DRAFT: 'Brouillon',
  OPEN: 'Ouvert',
  PARTIAL: 'Partiel',
  SATISFIED: 'Satisfait',
  CANCELLED: 'Annulé',
}

export const needUrgencyLabels: Record<NeedUrgency, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
}

export const carrierOptionStatusLabels: Record<CarrierOptionStatus, string> = {
  PENDING: 'À vérifier',
  VALIDATED: 'Validée par le superviseur',
  NEGOTIATION: 'À négocier',
  ACCEPTED: 'Acceptée',
  REFUSED: 'Refusée',
}

export const missionStatusLabels: Record<MissionStatus, string> = {
  CONFIRMED: 'Confirmée',
  MOBILIZING: 'Mobilisation',
  LOADING: 'Chargement',
  IN_TRANSIT: 'En route',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
}

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REVOKED: 'Révoquée',
  EXPIRED: 'Expirée',
}

export const carrierAvailabilityStatusLabels: Record<CarrierAvailabilityStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Réservé',
  UNAVAILABLE: 'Indisponible',
}

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
}

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En traitement',
  RESOLVED: 'Résolu',
  CLOSED: 'Clos',
}

export const callOutcomeLabels: Record<CallOutcome, string> = {
  AVAILABLE: 'Disponible',
  UNAVAILABLE: 'Indisponible',
  CALLBACK: 'À rappeler',
  NO_ANSWER: 'Ne répond pas',
  WRONG_NUMBER: 'Numéro incorrect',
}

export const followUpStatusLabels: Record<FollowUpStatus, string> = {
  PENDING: 'À faire',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
}

export interface CarrierOptionFormValues {
  carrierId: string
  carrierName: string
  carrierPhone: string
  carrierEmail: string
  truckType: string
  proposedTruckCount: number
  pricePerTruck: number
  availableAt: string
  paymentTerms: string
  documentsConfirmed: boolean
  notes: string
}

export interface ClientFormValues {
  name: string
  contactName: string
  phone: string
  email: string
}

export interface CarrierFormValues {
  name: string
  contactName: string
  phone: string
  email: string
  segment: CarrierSegment
  truckTypes: string
  destinations: string
  notes: string
}

export interface IncidentFormValues {
  title: string
  description: string
  severity: IncidentSeverity
  missionId: string
  needId: string
  assignedTo: string
}

export interface CallLogFormValues {
  carrierId: string
  needId: string
  outcome: CallOutcome
  notes: string
  followUpAt: string
}

export function createEmptyCarrierOptionForm(truckType = ''): CarrierOptionFormValues {
  return {
    carrierId: '',
    carrierName: '',
    carrierPhone: '',
    carrierEmail: '',
    truckType,
    proposedTruckCount: 1,
    pricePerTruck: 0,
    availableAt: '',
    paymentTerms: '',
    documentsConfirmed: false,
    notes: '',
  }
}

export interface NeedFormValues {
  clientId: string
  projectName: string
  urgency: NeedUrgency
  truckType: string
  requestedTruckCount: number
  tonnageTons: number
  cargoType: string
  packaging: string
  loadingLocation: string
  destination: string
  mobilizationAt: string
  rotations?: number
  estimatedDuration: string
  targetCarrierPrice?: number
  maximumCarrierPrice?: number
  paymentTerms: string
  negotiationAllowed: boolean
  constraints: string
}

export function createEmptyNeedForm(): NeedFormValues {
  return {
    clientId: '',
    projectName: '',
    urgency: 'MEDIUM',
    truckType: '',
    requestedTruckCount: 1,
    tonnageTons: 1,
    cargoType: '',
    packaging: '',
    loadingLocation: '',
    destination: '',
    mobilizationAt: '',
    rotations: undefined,
    estimatedDuration: '',
    targetCarrierPrice: undefined,
    maximumCarrierPrice: undefined,
    paymentTerms: '',
    negotiationAllowed: true,
    constraints: '',
  }
}
