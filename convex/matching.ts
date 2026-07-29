import { v } from 'convex/values'
import { rankCarriersForNeed } from '../shared/carrierMatching'
import { query } from './_generated/server'
import { requireOrganizationAccess } from './lib/authz'

export const listForNeed = query({
  args: {
    needId: v.id('needs'),
  },
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId)
    if (!need)
      return []

    await requireOrganizationAccess(ctx, need.organizationId)
    const carriers = await ctx.db
      .query('carriers')
      .withIndex('by_organization', query =>
        query.eq('organizationId', need.organizationId))
      .collect()
    const now = Date.now()
    const candidates = await Promise.all(
      carriers
        .filter(carrier => carrier.isActive)
        .map(async (carrier) => {
          const [vehicles, documents, availabilities, assignment] = await Promise.all([
            ctx.db
              .query('vehicles')
              .withIndex('by_carrier', query => query.eq('carrierId', carrier._id))
              .collect(),
            ctx.db
              .query('carrierDocuments')
              .withIndex('by_carrier', query => query.eq('carrierId', carrier._id))
              .collect(),
            ctx.db
              .query('carrierAvailabilities')
              .withIndex('by_carrier', query => query.eq('carrierId', carrier._id))
              .collect(),
            ctx.db
              .query('carrierAssignments')
              .withIndex('by_organization_carrier', query =>
                query.eq('organizationId', need.organizationId).eq('carrierId', carrier._id))
              .unique(),
          ])
          const activeVehicles = vehicles.filter(vehicle => vehicle.isActive)
          const availableVehicleIds = new Set(
            availabilities
              .filter(availability =>
                availability.status === 'AVAILABLE'
                && availability.availableFrom <= need.mobilizationAt
                && (!availability.availableUntil || availability.availableUntil >= need.mobilizationAt))
              .map(availability => availability.vehicleId)
              .filter(vehicleId => vehicleId !== undefined),
          )
          const documentsValid = documents.length > 0 && documents.every(document =>
            document.isVerified && (!document.expiresAt || document.expiresAt >= now))

          return {
            carrierId: carrier._id,
            truckTypes: carrier.truckTypes,
            destinations: carrier.destinations,
            activeVehicleTypes: activeVehicles.map(vehicle => vehicle.truckType),
            availableVehicleCount: availableVehicleIds.size > 0
              ? availableVehicleIds.size
              : availabilities.filter(availability =>
                availability.status === 'AVAILABLE'
                && availability.vehicleId === undefined).length,
            documentsValid,
            assignedAgentId: assignment?.agentId,
          }
        }),
    )
    const matches = rankCarriersForNeed(candidates, {
      truckType: need.truckType,
      destination: need.destination,
      remainingTruckCount: need.remainingTruckCount,
    })
    const byId = new Map(carriers.map(carrier => [String(carrier._id), carrier]))

    return matches.map(match => ({
      ...match,
      carrier: byId.get(match.carrierId),
    }))
  },
})
