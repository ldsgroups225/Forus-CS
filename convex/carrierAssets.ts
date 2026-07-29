import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess } from './lib/authz'
import { requireCarrierWriteAccess } from './lib/carrierAuthz'

const availabilityStatus = v.union(
  v.literal('AVAILABLE'),
  v.literal('RESERVED'),
  v.literal('UNAVAILABLE'),
)

export const addDocument = mutation({
  args: {
    carrierId: v.id('carriers'),
    vehicleId: v.optional(v.id('vehicles')),
    type: v.string(),
    label: v.string(),
    expiresAt: v.optional(v.number()),
    isVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    const membership = await requireCarrierWriteAccess(
      ctx,
      carrier.organizationId,
      args.carrierId,
    )
    if (args.vehicleId) {
      const vehicle = await ctx.db.get(args.vehicleId)
      if (!vehicle || vehicle.carrierId !== args.carrierId)
        throw new Error('VEHICLE_CARRIER_MISMATCH')
    }
    if (args.type.trim().length < 2 || args.label.trim().length < 2)
      throw new Error('CARRIER_DOCUMENT_INVALID')

    const now = Date.now()
    const documentId = await ctx.db.insert('carrierDocuments', {
      organizationId: carrier.organizationId,
      carrierId: args.carrierId,
      vehicleId: args.vehicleId,
      type: args.type.trim(),
      label: args.label.trim(),
      expiresAt: args.expiresAt,
      isVerified: membership.role === 'AGENT' ? false : args.isVerified,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrierDocument',
      entityId: documentId,
      action: 'CREATE',
      newValue: { carrierId: args.carrierId, type: args.type, label: args.label },
    })

    return documentId
  },
})

export const listDocuments = query({
  args: {
    carrierId: v.id('carriers'),
  },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      return []

    await requireOrganizationAccess(ctx, carrier.organizationId)
    return await ctx.db
      .query('carrierDocuments')
      .withIndex('by_carrier', query => query.eq('carrierId', args.carrierId))
      .collect()
  },
})

export const setAvailability = mutation({
  args: {
    carrierId: v.id('carriers'),
    vehicleId: v.optional(v.id('vehicles')),
    status: availabilityStatus,
    location: v.string(),
    availableFrom: v.number(),
    availableUntil: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireCarrierWriteAccess(ctx, carrier.organizationId, args.carrierId)
    if (args.vehicleId) {
      const vehicle = await ctx.db.get(args.vehicleId)
      if (!vehicle || vehicle.carrierId !== args.carrierId)
        throw new Error('VEHICLE_CARRIER_MISMATCH')
    }
    const location = args.location.trim()
    if (location.length < 2)
      throw new Error('CARRIER_AVAILABILITY_LOCATION_INVALID')
    if (
      args.availableUntil !== undefined
      && args.availableUntil < args.availableFrom
    ) {
      throw new Error('CARRIER_AVAILABILITY_RANGE_INVALID')
    }

    const now = Date.now()
    const availabilityId = await ctx.db.insert('carrierAvailabilities', {
      organizationId: carrier.organizationId,
      carrierId: args.carrierId,
      vehicleId: args.vehicleId,
      status: args.status,
      location,
      availableFrom: args.availableFrom,
      availableUntil: args.availableUntil,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrierAvailability',
      entityId: availabilityId,
      action: 'CREATE',
      newValue: {
        carrierId: args.carrierId,
        status: args.status,
        location,
        availableFrom: args.availableFrom,
      },
    })

    return availabilityId
  },
})

export const listAvailabilities = query({
  args: {
    carrierId: v.id('carriers'),
  },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      return []

    await requireOrganizationAccess(ctx, carrier.organizationId)
    return await ctx.db
      .query('carrierAvailabilities')
      .withIndex('by_carrier', query => query.eq('carrierId', args.carrierId))
      .order('desc')
      .collect()
  },
})
