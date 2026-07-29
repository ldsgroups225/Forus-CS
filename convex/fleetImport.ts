import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { normalizePhoneKey } from '../shared/normalization'
import { mutation } from './_generated/server'
import { writeAuditLog } from './lib/audit'

const importActor = 'development-fleet-import'

function requireDevelopmentImport(importKey: string) {
  // eslint-disable-next-line node/prefer-global/process
  const siteUrl = process.env.SITE_URL ?? ''
  // eslint-disable-next-line node/prefer-global/process
  const expectedKey = process.env.DEVELOPMENT_FLEET_IMPORT_KEY
  if (!siteUrl.startsWith('http://localhost') && !siteUrl.startsWith('http://127.0.0.1'))
    throw new Error('DEVELOPMENT_FLEET_IMPORT_DISABLED')
  if (!expectedKey || importKey !== expectedKey)
    throw new Error('DEVELOPMENT_FLEET_IMPORT_UNAUTHORIZED')
}

async function requireOrganizationBySlug(ctx: MutationCtx, slug: string, importKey: string) {
  requireDevelopmentImport(importKey)
  const organization = await ctx.db
    .query('organizations')
    .withIndex('by_slug', query => query.eq('slug', slug))
    .unique()
  if (!organization?.isActive)
    throw new Error('IMPORT_ORGANIZATION_NOT_FOUND')

  return organization
}

const carrierRow = v.object({
  name: v.string(),
  phone: v.string(),
  truckTypes: v.array(v.string()),
  destinations: v.array(v.string()),
  notes: v.optional(v.string()),
  sourcePortfolio: v.optional(v.string()),
  sourceExternalId: v.optional(v.string()),
})

const vehicleRow = v.object({
  registration: v.string(),
  truckType: v.string(),
  capacityTons: v.number(),
  bodyType: v.optional(v.string()),
  carrierPhone: v.string(),
  isActive: v.boolean(),
  sourceExternalId: v.optional(v.string()),
})

const driverRow = v.object({
  name: v.string(),
  phone: v.optional(v.string()),
  secondaryPhone: v.optional(v.string()),
  country: v.optional(v.string()),
  licenseNumber: v.optional(v.string()),
  licenseType: v.optional(v.string()),
  licenseExpiresAt: v.optional(v.number()),
  isActive: v.boolean(),
  isArchived: v.boolean(),
  carrierPhone: v.optional(v.string()),
  vehicleRegistrations: v.array(v.string()),
  sourceExternalId: v.optional(v.string()),
})

export const upsertCarriers = mutation({
  args: {
    organizationSlug: v.string(),
    importKey: v.string(),
    rows: v.array(carrierRow),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrganizationBySlug(ctx, args.organizationSlug, args.importKey)
    const now = Date.now()
    let created = 0
    let updated = 0

    for (const row of args.rows) {
      const normalizedPhone = normalizePhoneKey(row.phone)
      if (row.name.trim().length < 2 || normalizedPhone.length < 8)
        throw new Error('IMPORT_CARRIER_INVALID')
      const existing = await ctx.db
        .query('carriers')
        .withIndex('by_organization_phone', query =>
          query.eq('organizationId', organization._id).eq('normalizedPhone', normalizedPhone))
        .unique()
      const values = {
        name: row.name,
        phone: row.phone,
        normalizedPhone,
        segment: 'C' as const,
        truckTypes: row.truckTypes,
        destinations: row.destinations,
        notes: row.notes,
        sourcePortfolio: row.sourcePortfolio,
        sourceExternalId: row.sourceExternalId,
        sourceLabel: 'Dashboard Forus - extraction du 22/07/2026',
        isActive: true,
        updatedAt: now,
        updatedBy: importActor,
      }
      if (existing) {
        await ctx.db.patch(existing._id, values)
        updated += 1
      }
      else {
        await ctx.db.insert('carriers', {
          organizationId: organization._id,
          ...values,
          createdAt: now,
          createdBy: importActor,
        })
        created += 1
      }
    }
    await writeAuditLog(ctx, {
      organizationId: organization._id,
      actorId: importActor,
      entityType: 'fleetImport',
      entityId: organization._id,
      action: 'UPSERT_CARRIERS_BATCH',
      newValue: { created, updated, received: args.rows.length },
    })
    return { created, updated }
  },
})

export const upsertVehicles = mutation({
  args: {
    organizationSlug: v.string(),
    importKey: v.string(),
    rows: v.array(vehicleRow),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrganizationBySlug(ctx, args.organizationSlug, args.importKey)
    const now = Date.now()
    let created = 0
    let updated = 0

    for (const row of args.rows) {
      const carrier = await ctx.db
        .query('carriers')
        .withIndex('by_organization_phone', query =>
          query
            .eq('organizationId', organization._id)
            .eq('normalizedPhone', normalizePhoneKey(row.carrierPhone)))
        .unique()
      if (!carrier)
        throw new Error('IMPORT_VEHICLE_CARRIER_NOT_FOUND')
      const normalizedRegistration = row.registration.replace(/[^A-Z0-9]/gi, '').toUpperCase()
      if (normalizedRegistration.length < 3)
        throw new Error('IMPORT_VEHICLE_REGISTRATION_INVALID')
      const existing = await ctx.db
        .query('vehicles')
        .withIndex('by_organization_registration', query =>
          query
            .eq('organizationId', organization._id)
            .eq('normalizedRegistration', normalizedRegistration))
        .unique()
      const values = {
        carrierId: carrier._id,
        registration: row.registration,
        normalizedRegistration,
        truckType: row.truckType,
        capacityTons: row.capacityTons,
        bodyType: row.bodyType,
        sourceExternalId: row.sourceExternalId,
        isActive: row.isActive,
        updatedAt: now,
        updatedBy: importActor,
      }
      if (existing) {
        await ctx.db.patch(existing._id, values)
        updated += 1
      }
      else {
        await ctx.db.insert('vehicles', {
          organizationId: organization._id,
          ...values,
          createdAt: now,
          createdBy: importActor,
        })
        created += 1
      }
    }
    await writeAuditLog(ctx, {
      organizationId: organization._id,
      actorId: importActor,
      entityType: 'fleetImport',
      entityId: organization._id,
      action: 'UPSERT_VEHICLES_BATCH',
      newValue: { created, updated, received: args.rows.length },
    })
    return { created, updated }
  },
})

export const upsertDrivers = mutation({
  args: {
    organizationSlug: v.string(),
    importKey: v.string(),
    rows: v.array(driverRow),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrganizationBySlug(ctx, args.organizationSlug, args.importKey)
    const now = Date.now()
    let created = 0
    let updated = 0

    for (const row of args.rows) {
      const normalizedPhone = row.phone ? normalizePhoneKey(row.phone) : undefined
      let existing = normalizedPhone
        ? await ctx.db
            .query('drivers')
            .withIndex('by_organization_phone', query =>
              query.eq('organizationId', organization._id).eq('normalizedPhone', normalizedPhone))
            .unique()
        : null
      if (!existing && row.sourceExternalId) {
        const organizationDrivers = await ctx.db
          .query('drivers')
          .withIndex('by_organization', query =>
            query.eq('organizationId', organization._id))
          .collect()
        existing = organizationDrivers.find(driver =>
          driver.sourceExternalId === row.sourceExternalId) ?? null
      }
      let carrierId: Id<'carriers'> | undefined
      if (row.carrierPhone) {
        const carrierPhone = row.carrierPhone
        const carrier = await ctx.db
          .query('carriers')
          .withIndex('by_organization_phone', query =>
            query
              .eq('organizationId', organization._id)
              .eq('normalizedPhone', normalizePhoneKey(carrierPhone)))
          .unique()
        carrierId = carrier?._id
      }
      const values = {
        carrierId,
        name: row.name,
        phone: row.phone,
        normalizedPhone,
        secondaryPhone: row.secondaryPhone,
        country: row.country,
        licenseNumber: row.licenseNumber,
        licenseType: row.licenseType,
        licenseExpiresAt: row.licenseExpiresAt,
        isActive: row.isActive,
        isArchived: row.isArchived,
        sourceExternalId: row.sourceExternalId,
        updatedAt: now,
        updatedBy: importActor,
      }
      let driverId: Id<'drivers'>
      if (existing) {
        driverId = existing._id
        await ctx.db.patch(existing._id, values)
        updated += 1
      }
      else {
        driverId = await ctx.db.insert('drivers', {
          organizationId: organization._id,
          ...values,
          createdAt: now,
          createdBy: importActor,
        })
        created += 1
      }

      for (const registration of row.vehicleRegistrations) {
        const vehicle = await ctx.db
          .query('vehicles')
          .withIndex('by_organization_registration', query =>
            query
              .eq('organizationId', organization._id)
              .eq('normalizedRegistration', registration.replace(/[^A-Z0-9]/gi, '').toUpperCase()))
          .unique()
        if (!vehicle)
          continue
        const assignments = await ctx.db
          .query('vehicleDriverAssignments')
          .withIndex('by_vehicle', query => query.eq('vehicleId', vehicle._id))
          .collect()
        if (!assignments.some(assignment => assignment.driverId === driverId)) {
          await ctx.db.insert('vehicleDriverAssignments', {
            organizationId: organization._id,
            vehicleId: vehicle._id,
            driverId,
            assignedAt: now,
            assignedBy: importActor,
          })
        }
      }
    }
    await writeAuditLog(ctx, {
      organizationId: organization._id,
      actorId: importActor,
      entityType: 'fleetImport',
      entityId: organization._id,
      action: 'UPSERT_DRIVERS_BATCH',
      newValue: { created, updated, received: args.rows.length },
    })
    return { created, updated }
  },
})
