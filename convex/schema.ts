import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const role = v.union(
  v.literal('ORGANIZATION_ADMIN'),
  v.literal('OPERATIONS_MANAGER'),
  v.literal('SUPERVISOR'),
  v.literal('AGENT'),
)

const urgency = v.union(
  v.literal('LOW'),
  v.literal('MEDIUM'),
  v.literal('HIGH'),
  v.literal('CRITICAL'),
)

const needStatus = v.union(
  v.literal('DRAFT'),
  v.literal('OPEN'),
  v.literal('PARTIAL'),
  v.literal('SATISFIED'),
  v.literal('CANCELLED'),
)

const carrierOptionStatus = v.union(
  v.literal('PENDING'),
  v.literal('VALIDATED'),
  v.literal('NEGOTIATION'),
  v.literal('ACCEPTED'),
  v.literal('REFUSED'),
)

const missionStatus = v.union(
  v.literal('CONFIRMED'),
  v.literal('MOBILIZING'),
  v.literal('LOADING'),
  v.literal('IN_TRANSIT'),
  v.literal('DELIVERED'),
  v.literal('COMPLETED'),
  v.literal('CANCELLED'),
)

const workflowCounterKind = v.union(
  v.literal('OPTION'),
  v.literal('MISSION'),
  v.literal('INCIDENT'),
)

const invitationStatus = v.union(
  v.literal('PENDING'),
  v.literal('ACCEPTED'),
  v.literal('REVOKED'),
  v.literal('EXPIRED'),
)

const carrierSegment = v.union(
  v.literal('A'),
  v.literal('B'),
  v.literal('C'),
  v.literal('D'),
)

const availabilityStatus = v.union(
  v.literal('AVAILABLE'),
  v.literal('RESERVED'),
  v.literal('UNAVAILABLE'),
)

const incidentSeverity = v.union(
  v.literal('LOW'),
  v.literal('MEDIUM'),
  v.literal('HIGH'),
  v.literal('CRITICAL'),
)

const incidentStatus = v.union(
  v.literal('OPEN'),
  v.literal('IN_PROGRESS'),
  v.literal('RESOLVED'),
  v.literal('CLOSED'),
)

const callOutcome = v.union(
  v.literal('AVAILABLE'),
  v.literal('UNAVAILABLE'),
  v.literal('CALLBACK'),
  v.literal('NO_ANSWER'),
  v.literal('WRONG_NUMBER'),
)

const followUpStatus = v.union(
  v.literal('PENDING'),
  v.literal('COMPLETED'),
  v.literal('CANCELLED'),
)

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  })
    .index('by_slug', ['slug']),

  memberships: defineTable({
    organizationId: v.id('organizations'),
    userId: v.string(),
    role,
    isActive: v.boolean(),
    createdAt: v.number(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    supervisorId: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_organization', ['organizationId'])
    .index('by_organization_user', ['organizationId', 'userId'])
    .index('by_organization_role', ['organizationId', 'role']),

  callingAgents: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    slug: v.string(),
    color: v.optional(v.string()),
    linkedUserId: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_organization', ['organizationId', 'name'])
    .index('by_organization_slug', ['organizationId', 'slug'])
    .index('by_organization_linked_user', ['organizationId', 'linkedUserId']),

  clients: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_name', ['organizationId', 'name']),

  needs: defineTable({
    organizationId: v.id('organizations'),
    reference: v.string(),
    clientId: v.id('clients'),
    projectName: v.optional(v.string()),
    urgency,
    truckType: v.string(),
    requestedTruckCount: v.number(),
    approvedTruckCount: v.number(),
    remainingTruckCount: v.number(),
    tonnageTons: v.number(),
    cargoType: v.string(),
    packaging: v.optional(v.string()),
    loadingLocation: v.string(),
    destination: v.string(),
    mobilizationAt: v.number(),
    rotations: v.optional(v.number()),
    estimatedDuration: v.optional(v.string()),
    targetCarrierPrice: v.optional(v.number()),
    maximumCarrierPrice: v.optional(v.number()),
    paymentTerms: v.optional(v.string()),
    negotiationAllowed: v.boolean(),
    constraints: v.string(),
    status: needStatus,
    publishedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    lastUpdatedAt: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedBy: v.string(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_status', ['organizationId', 'status'])
    .index('by_organization_destination', ['organizationId', 'destination'])
    .index('by_organization_reference', ['organizationId', 'reference'])
    .index('by_organization_updated', ['organizationId', 'lastUpdatedAt']),

  carrierOptions: defineTable({
    organizationId: v.id('organizations'),
    needId: v.id('needs'),
    carrierId: v.optional(v.id('carriers')),
    reference: v.string(),
    carrierName: v.string(),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    source: v.optional(v.union(v.literal('APPEL'), v.literal('RECOMMANDATION'))),
    truckType: v.string(),
    proposedTruckCount: v.number(),
    acceptedTruckCount: v.optional(v.number()),
    pricePerTruck: v.number(),
    availableAt: v.number(),
    acceptedDestination: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    documentsConfirmed: v.boolean(),
    documentStatus: v.optional(v.union(v.literal('TO_VERIFY'), v.literal('CONFIRMED'))),
    notes: v.optional(v.string()),
    decisionNote: v.optional(v.string()),
    status: carrierOptionStatus,
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_status', ['organizationId', 'status'])
    .index('by_organization_reference', ['organizationId', 'reference'])
    .index('by_need', ['needId'])
    .index('by_need_status', ['needId', 'status']),

  // A named vehicle reported during a call. vehicleId is optional so historic
  // and newly reported registrations remain readable until the fleet is matched.
  carrierOptionVehicles: defineTable({
    organizationId: v.id('organizations'),
    optionId: v.id('carrierOptions'),
    vehicleId: v.optional(v.id('vehicles')),
    registration: v.string(),
    normalizedRegistration: v.string(),
    truckType: v.string(),
    capacityTons: v.number(),
    location: v.string(),
    documentsConfirmed: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index('by_option', ['optionId'])
    .index('by_vehicle', ['vehicleId'])
    .index('by_organization_registration', ['organizationId', 'normalizedRegistration']),

  missions: defineTable({
    organizationId: v.id('organizations'),
    needId: v.id('needs'),
    optionId: v.id('carrierOptions'),
    carrierId: v.optional(v.id('carriers')),
    reference: v.string(),
    carrierName: v.string(),
    carrierPhone: v.optional(v.string()),
    truckType: v.string(),
    truckCount: v.number(),
    pricePerTruck: v.number(),
    totalPrice: v.number(),
    loadingLocation: v.string(),
    destination: v.string(),
    mobilizationAt: v.number(),
    status: missionStatus,
    createdAt: v.number(),
    createdBy: v.string(),
    lastUpdatedAt: v.number(),
    assignedTo: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_status', ['organizationId', 'status'])
    .index('by_organization_reference', ['organizationId', 'reference'])
    .index('by_need', ['needId'])
    .index('by_option', ['optionId']),

  // The operational assignment preserves the plate even when a vehicle has
  // not yet been reconciled with the fleet register.
  missionVehicleAssignments: defineTable({
    organizationId: v.id('organizations'),
    missionId: v.id('missions'),
    optionVehicleId: v.id('carrierOptionVehicles'),
    vehicleId: v.optional(v.id('vehicles')),
    registration: v.string(),
    normalizedRegistration: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index('by_mission', ['missionId'])
    .index('by_vehicle', ['vehicleId'])
    .index('by_organization_registration', ['organizationId', 'normalizedRegistration']),

  missionEvents: defineTable({
    organizationId: v.id('organizations'),
    missionId: v.id('missions'),
    status: missionStatus,
    note: v.optional(v.string()),
    location: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index('by_mission', ['missionId', 'createdAt'])
    .index('by_organization', ['organizationId', 'createdAt']),

  organizationSettings: defineTable({
    organizationId: v.id('organizations'),
    timezone: v.string(),
    currency: v.string(),
    defaultCountryCode: v.string(),
    whatsappBusinessEnabled: v.boolean(),
    presenceEnabled: v.optional(v.boolean()),
    agentBaseStipend: v.optional(v.number()),
    maximumPerformanceBonus: v.optional(v.number()),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_organization', ['organizationId']),

  invitations: defineTable({
    organizationId: v.id('organizations'),
    email: v.string(),
    role,
    code: v.string(),
    status: invitationStatus,
    expiresAt: v.number(),
    createdAt: v.number(),
    invitedBy: v.string(),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.string()),
  })
    .index('by_code', ['code'])
    .index('by_organization', ['organizationId', 'createdAt'])
    .index('by_organization_email', ['organizationId', 'email']),

  carriers: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.string(),
    normalizedPhone: v.string(),
    email: v.optional(v.string()),
    segment: carrierSegment,
    truckTypes: v.array(v.string()),
    destinations: v.array(v.string()),
    notes: v.optional(v.string()),
    sourcePortfolio: v.optional(v.string()),
    sourceExternalId: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_organization', ['organizationId', 'name'])
    .index('by_organization_phone', ['organizationId', 'normalizedPhone'])
    .index('by_organization_segment', ['organizationId', 'segment']),

  vehicles: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.id('carriers'),
    registration: v.string(),
    normalizedRegistration: v.string(),
    truckType: v.string(),
    capacityTons: v.number(),
    bodyType: v.optional(v.string()),
    sourceExternalId: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_carrier', ['carrierId'])
    .index('by_organization_registration', ['organizationId', 'normalizedRegistration']),

  drivers: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.optional(v.id('carriers')),
    name: v.string(),
    phone: v.optional(v.string()),
    normalizedPhone: v.optional(v.string()),
    secondaryPhone: v.optional(v.string()),
    country: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
    licenseType: v.optional(v.string()),
    licenseExpiresAt: v.optional(v.number()),
    isActive: v.boolean(),
    isArchived: v.boolean(),
    sourceExternalId: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_organization', ['organizationId', 'name'])
    .index('by_organization_phone', ['organizationId', 'normalizedPhone'])
    .index('by_organization_external', ['organizationId', 'sourceExternalId']),

  vehicleDriverAssignments: defineTable({
    organizationId: v.id('organizations'),
    vehicleId: v.id('vehicles'),
    driverId: v.id('drivers'),
    assignedAt: v.number(),
    assignedBy: v.string(),
  })
    .index('by_vehicle', ['vehicleId'])
    .index('by_driver', ['driverId']),

  carrierDocuments: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.id('carriers'),
    vehicleId: v.optional(v.id('vehicles')),
    type: v.string(),
    label: v.string(),
    expiresAt: v.optional(v.number()),
    isVerified: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_carrier', ['carrierId'])
    .index('by_vehicle', ['vehicleId']),

  carrierAvailabilities: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.id('carriers'),
    vehicleId: v.optional(v.id('vehicles')),
    status: availabilityStatus,
    location: v.string(),
    availableFrom: v.number(),
    availableUntil: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_carrier', ['carrierId', 'availableFrom'])
    .index('by_organization_status', ['organizationId', 'status', 'availableFrom']),

  carrierAssignments: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.id('carriers'),
    agentId: v.optional(v.string()),
    callingAgentId: v.optional(v.id('callingAgents')),
    assignedAt: v.number(),
    assignedBy: v.string(),
  })
    .index('by_organization_carrier', ['organizationId', 'carrierId'])
    .index('by_organization_agent', ['organizationId', 'agentId'])
    .index('by_organization_calling_agent', ['organizationId', 'callingAgentId']),

  callingEscalations: defineTable({
    organizationId: v.id('organizations'),
    needId: v.optional(v.id('needs')),
    carrierName: v.string(),
    phone: v.optional(v.string()),
    source: v.string(),
    note: v.string(),
    status: v.union(v.literal('PENDING'), v.literal('RESOLVED')),
    createdAt: v.number(),
    createdBy: v.string(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index('by_organization_status', ['organizationId', 'status', 'createdAt'])
    .index('by_need', ['needId']),

  incidents: defineTable({
    organizationId: v.id('organizations'),
    reference: v.string(),
    needId: v.optional(v.id('needs')),
    missionId: v.optional(v.id('missions')),
    title: v.string(),
    description: v.string(),
    severity: incidentSeverity,
    status: incidentStatus,
    assignedTo: v.optional(v.string()),
    resolution: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
    resolvedAt: v.optional(v.number()),
  })
    .index('by_organization', ['organizationId', 'updatedAt'])
    .index('by_organization_status', ['organizationId', 'status', 'updatedAt'])
    .index('by_organization_reference', ['organizationId', 'reference'])
    .index('by_mission', ['missionId']),

  callLogs: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.optional(v.id('carriers')),
    needId: v.optional(v.id('needs')),
    direction: v.union(v.literal('OUTBOUND'), v.literal('INBOUND')),
    outcome: callOutcome,
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    calledAt: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
    idempotencyKey: v.optional(v.string()),
  })
    .index('by_organization', ['organizationId', 'calledAt'])
    .index('by_carrier', ['carrierId', 'calledAt'])
    .index('by_organization_idempotency', ['organizationId', 'idempotencyKey']),

  followUps: defineTable({
    organizationId: v.id('organizations'),
    carrierId: v.optional(v.id('carriers')),
    needId: v.optional(v.id('needs')),
    assignedTo: v.string(),
    dueAt: v.number(),
    notes: v.string(),
    status: followUpStatus,
    createdAt: v.number(),
    createdBy: v.string(),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    reminderSentAt: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
  })
    .index('by_organization_due', ['organizationId', 'status', 'dueAt'])
    .index('by_assignee_due', ['assignedTo', 'status', 'dueAt'])
    .index('by_organization_idempotency', ['organizationId', 'idempotencyKey']),

  notifications: defineTable({
    organizationId: v.id('organizations'),
    userId: v.string(),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    href: v.optional(v.string()),
    deduplicationKey: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index('by_user', ['userId', 'createdAt'])
    .index('by_user_read', ['userId', 'isRead', 'createdAt'])
    .index('by_organization_user_deduplication', ['organizationId', 'userId', 'deduplicationKey']),

  transcriptionJobs: defineTable({
    organizationId: v.id('organizations'),
    createdBy: v.string(),
    storageId: v.optional(v.id('_storage')),
    audioHash: v.string(),
    mimeType: v.string(),
    model: v.string(),
    language: v.string(),
    status: v.union(
      v.literal('UPLOADING'),
      v.literal('QUEUED'),
      v.literal('PROCESSING'),
      v.literal('COMPLETED'),
      v.literal('FAILED'),
      v.literal('RATE_LIMITED'),
    ),
    workId: v.optional(v.string()),
    text: v.optional(v.string()),
    duration: v.optional(v.number()),
    retryAfter: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization_created', ['organizationId', 'createdAt'])
    .index('by_organization_hash', ['organizationId', 'audioHash'])
    .index('by_storage', ['storageId']),

  mutationReceipts: defineTable({
    organizationId: v.id('organizations'),
    key: v.string(),
    operation: v.string(),
    resultId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_organization_key', ['organizationId', 'key']),

  auditLogs: defineTable({
    organizationId: v.id('organizations'),
    actorId: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_entity', ['organizationId', 'entityType', 'entityId']),

  referenceCounters: defineTable({
    organizationId: v.id('organizations'),
    dateKey: v.string(),
    sequence: v.number(),
  })
    .index('by_organization_date', ['organizationId', 'dateKey']),

  workflowCounters: defineTable({
    organizationId: v.id('organizations'),
    kind: workflowCounterKind,
    dateKey: v.string(),
    sequence: v.number(),
  })
    .index('by_organization_kind_date', ['organizationId', 'kind', 'dateKey']),

  developmentSeeds: defineTable({
    organizationId: v.id('organizations'),
    key: v.string(),
    createdAt: v.number(),
  })
    .index('by_organization_key', ['organizationId', 'key']),
})
