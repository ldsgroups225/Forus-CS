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

export type OrganizationRole = typeof organizationRoles[number]
export type NeedStatus = typeof needStatuses[number]
export type NeedUrgency = typeof needUrgencies[number]

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
