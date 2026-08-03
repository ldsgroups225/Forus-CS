import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser } from './lib/authz'
import { requireCarrierWriteAccess } from './lib/carrierAuthz'

export const create = mutation({
  args: {
    carrierId: v.id('carriers'),
    registration: v.string(),
    truckType: v.string(),
    capacityTons: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireCarrierWriteAccess(ctx, carrier.organizationId, args.carrierId)
    const registration = args.registration.trim().toUpperCase()
    const normalizedRegistration = registration.replace(/[^A-Z0-9]/g, '')
    const truckType = args.truckType.trim()
    if (normalizedRegistration.length < 4)
      throw new Error('VEHICLE_REGISTRATION_INVALID')
    if (truckType.length < 2)
      throw new Error('VEHICLE_TRUCK_TYPE_INVALID')
    if (!Number.isFinite(args.capacityTons) || args.capacityTons <= 0)
      throw new Error('VEHICLE_CAPACITY_INVALID')

    const duplicate = await ctx.db
      .query('vehicles')
      .withIndex('by_organization_registration', query =>
        query
          .eq('organizationId', carrier.organizationId)
          .eq('normalizedRegistration', normalizedRegistration))
      .unique()
    if (duplicate)
      throw new Error('VEHICLE_REGISTRATION_TAKEN')

    const now = Date.now()
    const vehicleId = await ctx.db.insert('vehicles', {
      organizationId: carrier.organizationId,
      carrierId: args.carrierId,
      registration,
      normalizedRegistration,
      truckType,
      capacityTons: args.capacityTons,
      isActive: true,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'vehicle',
      entityId: vehicleId,
      action: 'CREATE',
      newValue: { carrierId: args.carrierId, registration, truckType },
    })

    return vehicleId
  },
})

export const listForCarrier = query({
  args: {
    carrierId: v.id('carriers'),
  },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      return []

    await requireCarrierWriteAccess(ctx, carrier.organizationId, args.carrierId)
    return await ctx.db
      .query('vehicles')
      .withIndex('by_carrier', query => query.eq('carrierId', args.carrierId))
      .collect()
  },
})

export const setActive = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle)
      throw new Error('VEHICLE_NOT_FOUND')

    await requireCarrierWriteAccess(ctx, vehicle.organizationId, vehicle.carrierId)
    await ctx.db.patch(args.vehicleId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: vehicle.organizationId,
      actorId: userId,
      entityType: 'vehicle',
      entityId: args.vehicleId,
      action: args.isActive ? 'ACTIVATE' : 'DEACTIVATE',
    })

    return args.vehicleId
  },
})
