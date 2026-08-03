import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { assertCarrierReadAccess, canViewAllCarriers } from '../shared/carrierAccess'
import { normalizePhoneKey } from '../shared/normalization'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { requireCarrierWriteAccess } from './lib/carrierAuthz'
import { findIdempotentResult, recordIdempotentResult } from './lib/idempotency'

const carrierCreateRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
  'AGENT',
] as const

const segment = v.union(
  v.literal('A'),
  v.literal('B'),
  v.literal('C'),
  v.literal('D'),
)

const carrierFields = {
  name: v.string(),
  contactName: v.optional(v.string()),
  phone: v.string(),
  email: v.optional(v.string()),
  segment,
  truckTypes: v.array(v.string()),
  destinations: v.array(v.string()),
  notes: v.optional(v.string()),
}

interface CarrierInput {
  name: string
  contactName?: string
  phone: string
  email?: string
  segment: 'A' | 'B' | 'C' | 'D'
  truckTypes: string[]
  destinations: string[]
  notes?: string
}

function uniqueText(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function normalizeCarrier(input: CarrierInput) {
  const name = input.name.trim()
  const phone = input.phone.trim()
  const normalizedPhone = normalizePhoneKey(phone)
  const email = input.email?.trim().toLocaleLowerCase()

  if (name.length < 2)
    throw new Error('CARRIER_NAME_INVALID')
  if (normalizedPhone.length < 8)
    throw new Error('CARRIER_PHONE_INVALID')
  if (email && !email.includes('@'))
    throw new Error('CARRIER_EMAIL_INVALID')

  return {
    name,
    contactName: input.contactName?.trim() || undefined,
    phone,
    normalizedPhone,
    email: email || undefined,
    segment: input.segment,
    truckTypes: uniqueText(input.truckTypes),
    destinations: uniqueText(input.destinations),
    notes: input.notes?.trim() || undefined,
  }
}

function identityText(identity: object, key: string) {
  const value = Reflect.get(identity, key)
  return typeof value === 'string' ? value : undefined
}

async function enrichCarrier(
  ctx: Parameters<typeof requireOrganizationAccess>[0],
  carrierId: Id<'carriers'>,
) {
  const carrier = await ctx.db.get(carrierId)
  if (!carrier)
    return null

  const [vehicles, documents, availabilities, assignment] = await Promise.all([
    ctx.db.query('vehicles').withIndex('by_carrier', query => query.eq('carrierId', carrierId)).collect(),
    ctx.db.query('carrierDocuments').withIndex('by_carrier', query => query.eq('carrierId', carrierId)).collect(),
    ctx.db.query('carrierAvailabilities').withIndex('by_carrier', query => query.eq('carrierId', carrierId)).collect(),
    ctx.db
      .query('carrierAssignments')
      .withIndex('by_organization_carrier', query =>
        query.eq('organizationId', carrier.organizationId).eq('carrierId', carrierId))
      .unique(),
  ])
  const callingAgent = assignment?.callingAgentId
    ? await ctx.db.get(assignment.callingAgentId)
    : null
  const now = Date.now()
  const activeVehicles = vehicles.filter(vehicle => vehicle.isActive)
  const documentsValid = documents.length === 0 || documents.every(document =>
    document.isVerified && (document.expiresAt === undefined || document.expiresAt > now))
  const availableVehicleCount = availabilities.filter(item =>
    item.status === 'AVAILABLE'
    && item.availableFrom <= now
    && (item.availableUntil === undefined || item.availableUntil >= now))
    .length

  return {
    ...carrier,
    activeVehicleCount: activeVehicles.length,
    availableVehicleCount,
    documentsValid,
    assignedAgentId: assignment?.agentId,
    assignedCallingAgentId: assignment?.callingAgentId,
    assignedCallingAgentName: callingAgent?.name,
  }
}

async function linkedCallingAgentIds(
  ctx: Parameters<typeof requireOrganizationAccess>[0],
  organizationId: Id<'organizations'>,
  userId: string,
) {
  const callingAgents = await ctx.db
    .query('callingAgents')
    .withIndex('by_organization_linked_user', query =>
      query.eq('organizationId', organizationId).eq('linkedUserId', userId))
    .collect()

  return callingAgents.map(callingAgent => callingAgent._id)
}

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    idempotencyKey: v.optional(v.string()),
    ...carrierFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const membership = await requireRole(ctx, args.organizationId, carrierCreateRoles)
    const receipt = await findIdempotentResult(ctx, args.organizationId, args.idempotencyKey)
    if (receipt?.resultId)
      return receipt.resultId as Id<'carriers'>

    const input = normalizeCarrier(args)
    const duplicate = await ctx.db
      .query('carriers')
      .withIndex('by_organization_phone', query =>
        query.eq('organizationId', args.organizationId).eq('normalizedPhone', input.normalizedPhone))
      .unique()
    if (duplicate)
      throw new Error('CARRIER_PHONE_TAKEN')

    const now = Date.now()
    const carrierId = await ctx.db.insert('carriers', {
      organizationId: args.organizationId,
      ...input,
      isActive: true,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    if (membership.role === 'AGENT') {
      await ctx.db.insert('carrierAssignments', {
        organizationId: args.organizationId,
        carrierId,
        agentId: userId,
        assignedAt: now,
        assignedBy: userId,
      })
    }
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'carrier',
      entityId: carrierId,
      action: 'CREATE',
      newValue: input,
    })
    await recordIdempotentResult(ctx, {
      organizationId: args.organizationId,
      key: args.idempotencyKey,
      operation: 'carriers.create',
      resultId: carrierId,
    })

    return carrierId
  },
})

export const update = mutation({
  args: {
    carrierId: v.id('carriers'),
    ...carrierFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireCarrierWriteAccess(ctx, carrier.organizationId, args.carrierId)
    const input = normalizeCarrier(args)
    const duplicate = await ctx.db
      .query('carriers')
      .withIndex('by_organization_phone', query =>
        query.eq('organizationId', carrier.organizationId).eq('normalizedPhone', input.normalizedPhone))
      .unique()
    if (duplicate && duplicate._id !== args.carrierId)
      throw new Error('CARRIER_PHONE_TAKEN')

    await ctx.db.patch(args.carrierId, {
      ...input,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrier',
      entityId: args.carrierId,
      action: 'UPDATE',
      previousValue: carrier,
      newValue: input,
    })

    return args.carrierId
  },
})

export const setActive = mutation({
  args: {
    carrierId: v.id('carriers'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireRole(ctx, carrier.organizationId, [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_MANAGER',
      'SUPERVISOR',
    ])
    await ctx.db.patch(args.carrierId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrier',
      entityId: args.carrierId,
      action: args.isActive ? 'ACTIVATE' : 'DEACTIVATE',
    })

    return args.carrierId
  },
})

export const list = query({
  args: {
    organizationId: v.id('organizations'),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireOrganizationAccess(ctx, args.organizationId)
    const { identity } = await requireAuthenticatedUser(ctx)
    const authenticatedEmail = identityText(identity, 'email')
    const carriers = await ctx.db
      .query('carriers')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()
    let visibleByRole = carriers
    if (!canViewAllCarriers(membership, authenticatedEmail)) {
      const linkedIds = await linkedCallingAgentIds(ctx, args.organizationId, membership.userId)
      const directAssignments = await ctx.db
        .query('carrierAssignments')
        .withIndex('by_organization_agent', query =>
          query.eq('organizationId', args.organizationId).eq('agentId', membership.userId))
        .collect()
      const envelopeAssignments = await Promise.all(linkedIds.map(async callingAgentId =>
        await ctx.db
          .query('carrierAssignments')
          .withIndex('by_organization_calling_agent', query =>
            query.eq('organizationId', args.organizationId).eq('callingAgentId', callingAgentId))
          .collect()))
      const assignedCarrierIds = new Set([
        ...directAssignments.map(assignment => assignment.carrierId),
        ...envelopeAssignments.flat().map(assignment => assignment.carrierId),
      ])
      visibleByRole = carriers.filter(carrier => assignedCarrierIds.has(carrier._id))
    }
    const visible = args.includeInactive ? visibleByRole : visibleByRole.filter(carrier => carrier.isActive)
    const enriched = await Promise.all(visible.map(carrier => enrichCarrier(ctx, carrier._id)))

    return enriched.filter(carrier => carrier !== null)
  },
})

export const getById = query({
  args: {
    carrierId: v.id('carriers'),
  },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      return null

    const { membership } = await requireOrganizationAccess(ctx, carrier.organizationId)
    const { identity } = await requireAuthenticatedUser(ctx)
    const assignment = await ctx.db
      .query('carrierAssignments')
      .withIndex('by_organization_carrier', query =>
        query.eq('organizationId', carrier.organizationId).eq('carrierId', args.carrierId))
      .unique()
    assertCarrierReadAccess(
      membership,
      assignment,
      identityText(identity, 'email'),
      await linkedCallingAgentIds(ctx, carrier.organizationId, membership.userId),
    )
    return await enrichCarrier(ctx, args.carrierId)
  },
})
