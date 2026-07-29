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
  v.literal('NEGOTIATION'),
  v.literal('ACCEPTED'),
  v.literal('REFUSED'),
)

const missionStatus = v.union(
  v.literal('CONFIRMED'),
)

const workflowCounterKind = v.union(
  v.literal('OPTION'),
  v.literal('MISSION'),
)

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index('by_slug', ['slug']),

  memberships: defineTable({
    organizationId: v.id('organizations'),
    userId: v.string(),
    role,
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_organization', ['organizationId'])
    .index('by_organization_user', ['organizationId', 'userId'])
    .index('by_organization_role', ['organizationId', 'role']),

  clients: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
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
    reference: v.string(),
    carrierName: v.string(),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    truckType: v.string(),
    proposedTruckCount: v.number(),
    acceptedTruckCount: v.optional(v.number()),
    pricePerTruck: v.number(),
    availableAt: v.number(),
    paymentTerms: v.optional(v.string()),
    documentsConfirmed: v.boolean(),
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

  missions: defineTable({
    organizationId: v.id('organizations'),
    needId: v.id('needs'),
    optionId: v.id('carrierOptions'),
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
  })
    .index('by_organization', ['organizationId'])
    .index('by_organization_status', ['organizationId', 'status'])
    .index('by_organization_reference', ['organizationId', 'reference'])
    .index('by_need', ['needId'])
    .index('by_option', ['optionId']),

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
