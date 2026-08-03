import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { applyOptionAcceptance, canDecideValidatedOption, canReviewOption } from '../shared/optionWorkflow'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { requireCarrierWriteAccess } from './lib/carrierAuthz'
import { createNotification, notifyOrganizationRoles } from './lib/notifications'
import { generateWorkflowReference } from './lib/workflow'

const OPTION_SUBMIT_ROLES = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
  'AGENT',
] as const

const OPTION_REVIEW_ROLES = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
] as const

const OPTION_DECISION_ROLES = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
] as const

const optionFields = {
  carrierId: v.optional(v.id('carriers')),
  carrierName: v.string(),
  carrierPhone: v.optional(v.string()),
  carrierEmail: v.optional(v.string()),
  source: v.optional(v.union(v.literal('APPEL'), v.literal('RECOMMANDATION'))),
  truckType: v.string(),
  proposedTruckCount: v.number(),
  pricePerTruck: v.number(),
  availableAt: v.number(),
  acceptedDestination: v.optional(v.string()),
  paymentTerms: v.optional(v.string()),
  documentsConfirmed: v.boolean(),
  notes: v.optional(v.string()),
  vehicles: v.optional(v.array(v.object({
    vehicleId: v.optional(v.id('vehicles')),
    registration: v.string(),
    truckType: v.string(),
    capacityTons: v.number(),
    location: v.string(),
    documentsConfirmed: v.boolean(),
  }))),
}

interface OptionVehicleInput {
  vehicleId?: Id<'vehicles'>
  registration: string
  truckType: string
  capacityTons: number
  location: string
  documentsConfirmed: boolean
}

interface OptionInput {
  carrierId?: Id<'carriers'>
  carrierName: string
  carrierPhone?: string
  carrierEmail?: string
  source?: 'APPEL' | 'RECOMMANDATION'
  truckType: string
  proposedTruckCount: number
  pricePerTruck: number
  availableAt: number
  acceptedDestination?: string
  paymentTerms?: string
  documentsConfirmed: boolean
  documentStatus?: 'TO_VERIFY' | 'CONFIRMED'
  notes?: string
  vehicles?: OptionVehicleInput[]
}

function normalizeOptionInput(input: OptionInput): OptionInput {
  if (input.carrierName.trim().length < 2)
    throw new Error('OPTION_CARRIER_NAME_INVALID')

  if (input.truckType.trim().length < 2)
    throw new Error('OPTION_TRUCK_TYPE_INVALID')

  if (!Number.isInteger(input.proposedTruckCount) || input.proposedTruckCount <= 0)
    throw new Error('OPTION_PROPOSED_COUNT_INVALID')

  if (!Number.isFinite(input.pricePerTruck) || input.pricePerTruck <= 0)
    throw new Error('OPTION_PRICE_INVALID')

  if (!Number.isFinite(input.availableAt))
    throw new Error('OPTION_AVAILABILITY_INVALID')

  const carrierEmail = input.carrierEmail?.trim().toLocaleLowerCase()
  if (carrierEmail && !carrierEmail.includes('@'))
    throw new Error('OPTION_EMAIL_INVALID')

  const vehicles = input.vehicles?.map((vehicle) => {
    const registration = vehicle.registration.trim().toUpperCase()
    const normalizedRegistration = registration.replace(/[^A-Z0-9]/g, '')
    if (normalizedRegistration.length < 4)
      throw new Error('OPTION_VEHICLE_REGISTRATION_INVALID')
    if (vehicle.truckType.trim().length < 2)
      throw new Error('OPTION_VEHICLE_TRUCK_TYPE_INVALID')
    if (!Number.isFinite(vehicle.capacityTons) || vehicle.capacityTons <= 0)
      throw new Error('OPTION_VEHICLE_CAPACITY_INVALID')
    if (vehicle.location.trim().length < 2)
      throw new Error('OPTION_VEHICLE_LOCATION_INVALID')
    return { ...vehicle, registration, truckType: vehicle.truckType.trim(), location: vehicle.location.trim() }
  })
  if (vehicles && vehicles.length !== input.proposedTruckCount)
    throw new Error('OPTION_VEHICLE_COUNT_MISMATCH')
  if (vehicles && new Set(vehicles.map(vehicle => vehicle.registration.replace(/[^A-Z0-9]/g, ''))).size !== vehicles.length)
    throw new Error('OPTION_VEHICLE_DUPLICATE')

  return {
    carrierId: input.carrierId,
    carrierName: input.carrierName.trim(),
    carrierPhone: input.carrierPhone?.trim() || undefined,
    carrierEmail: carrierEmail || undefined,
    source: input.source ?? 'APPEL',
    truckType: input.truckType.trim(),
    proposedTruckCount: input.proposedTruckCount,
    pricePerTruck: input.pricePerTruck,
    availableAt: input.availableAt,
    acceptedDestination: input.acceptedDestination?.trim() || undefined,
    paymentTerms: input.paymentTerms?.trim() || undefined,
    documentsConfirmed: Boolean(vehicles?.length) && (vehicles?.every(vehicle => vehicle.documentsConfirmed) ?? false),
    documentStatus: Boolean(vehicles?.length) && (vehicles?.every(vehicle => vehicle.documentsConfirmed) ?? false)
      ? 'CONFIRMED' as const
      : 'TO_VERIFY' as const,
    notes: input.notes?.trim() || undefined,
    vehicles,
  }
}

async function requireOption(
  ctx: Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>,
  optionId: Id<'carrierOptions'>,
) {
  const option = await ctx.db.get(optionId)
  if (!option)
    throw new Error('OPTION_NOT_FOUND')

  return option
}

async function replaceOptionVehicles(
  ctx: MutationCtx,
  option: Pick<Doc<'carrierOptions'>, '_id' | 'organizationId' | 'carrierId'>,
  vehicles: OptionVehicleInput[] | undefined,
  userId: string,
) {
  const existing = await ctx.db
    .query('carrierOptionVehicles')
    .withIndex('by_option', query => query.eq('optionId', option._id))
    .collect()
  await Promise.all(existing.map(vehicle => ctx.db.delete(vehicle._id)))

  if (!vehicles)
    return

  await Promise.all(vehicles.map(async (vehicle) => {
    if (vehicle.vehicleId) {
      const fleetVehicle = await ctx.db.get(vehicle.vehicleId)
      if (!fleetVehicle || !fleetVehicle.isActive || fleetVehicle.organizationId !== option.organizationId)
        throw new Error('OPTION_VEHICLE_INVALID')
      if (option.carrierId && fleetVehicle.carrierId !== option.carrierId)
        throw new Error('OPTION_VEHICLE_CARRIER_MISMATCH')
    }
    await ctx.db.insert('carrierOptionVehicles', {
      organizationId: option.organizationId,
      optionId: option._id,
      vehicleId: vehicle.vehicleId,
      registration: vehicle.registration,
      normalizedRegistration: vehicle.registration.replace(/[^A-Z0-9]/g, ''),
      truckType: vehicle.truckType,
      capacityTons: vehicle.capacityTons,
      location: vehicle.location,
      documentsConfirmed: vehicle.documentsConfirmed,
      createdAt: Date.now(),
      createdBy: userId,
    })
  }))
}

async function enrichOption(
  ctx: Pick<QueryCtx, 'db'>,
  option: Doc<'carrierOptions'>,
) {
  const [need, mission, vehicles] = await Promise.all([
    ctx.db.get(option.needId),
    ctx.db
      .query('missions')
      .withIndex('by_option', query => query.eq('optionId', option._id))
      .unique(),
    ctx.db
      .query('carrierOptionVehicles')
      .withIndex('by_option', query => query.eq('optionId', option._id))
      .collect(),
  ])

  if (!need)
    throw new Error('NEED_NOT_FOUND')

  const client = await ctx.db.get(need.clientId)
  return {
    ...option,
    needReference: need.reference,
    needStatus: need.status,
    needRemainingTruckCount: need.remainingTruckCount,
    clientName: client?.name ?? 'Client inconnu',
    loadingLocation: need.loadingLocation,
    destination: need.destination,
    missionId: mission?._id,
    missionReference: mission?.reference,
    vehicles,
  }
}

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    needId: v.id('needs'),
    ...optionFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const membership = await requireRole(ctx, args.organizationId, OPTION_SUBMIT_ROLES)

    const need = await ctx.db.get(args.needId)
    if (!need || need.organizationId !== args.organizationId)
      throw new Error('NEED_ORGANIZATION_MISMATCH')
    if (need.status !== 'OPEN' && need.status !== 'PARTIAL')
      throw new Error('OPTION_NEED_NOT_ACTIVE')

    const input = normalizeOptionInput(args)
    const { vehicles, ...optionInput } = input
    const carrierId = input.carrierId
    if (membership.role === 'AGENT' && (!vehicles?.length || vehicles.some(vehicle => !vehicle.vehicleId)))
      throw new Error('OPTION_CRM_VEHICLES_REQUIRED')
    if (carrierId) {
      const carrier = await ctx.db.get(carrierId)
      if (!carrier || carrier.organizationId !== args.organizationId || !carrier.isActive)
        throw new Error('OPTION_CARRIER_INVALID')
      await requireCarrierWriteAccess(ctx, args.organizationId, carrierId)
    }
    else if (membership.role === 'AGENT') {
      throw new Error('OPTION_CARRIER_NOT_ASSIGNED')
    }
    if (input.proposedTruckCount > need.remainingTruckCount)
      throw new Error('OPTION_PROPOSED_COUNT_EXCEEDS_REMAINING')

    const now = Date.now()
    const reference = await generateWorkflowReference(
      ctx,
      args.organizationId,
      'OPTION',
      new Date(now),
    )
    const optionId = await ctx.db.insert('carrierOptions', {
      organizationId: args.organizationId,
      needId: args.needId,
      reference,
      ...optionInput,
      status: 'PENDING',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await replaceOptionVehicles(ctx, {
      _id: optionId,
      organizationId: args.organizationId,
      carrierId: input.carrierId,
    }, vehicles, userId)

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: optionId,
      action: 'SUBMIT',
      newValue: { reference, needId: args.needId, ...optionInput, vehicleCount: vehicles?.length ?? 0 },
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: args.needId,
      action: 'OPTION_SUBMITTED',
      newValue: { optionId, reference, proposedTruckCount: input.proposedTruckCount },
    })
    await notifyOrganizationRoles(ctx, {
      organizationId: args.organizationId,
      roles: ['SUPERVISOR', 'ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'],
      excludeUserId: userId,
      kind: 'CALLING_OPTION_PENDING',
      title: `Disponibilité à contrôler · ${reference}`,
      body: `${optionInput.proposedTruckCount} camion(s) pour ${need.reference} remonté(s) par Calling.`,
      href: '/operations/calling/supervision',
      deduplicationKey: `calling-option:${optionId}:pending`,
    })

    return optionId
  },
})

export const revise = mutation({
  args: {
    optionId: v.id('carrierOptions'),
    ...optionFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const option = await requireOption(ctx, args.optionId)
    const membership = await requireRole(ctx, option.organizationId, OPTION_SUBMIT_ROLES)

    if (membership.role === 'AGENT' && option.createdBy !== userId)
      throw new Error('OPTION_NOT_CREATED_BY_AGENT')
    if (option.carrierId)
      await requireCarrierWriteAccess(ctx, option.organizationId, option.carrierId)

    if (option.status !== 'NEGOTIATION')
      throw new Error('OPTION_NOT_NEGOTIATING')

    const need = await ctx.db.get(option.needId)
    if (!need || (need.status !== 'OPEN' && need.status !== 'PARTIAL'))
      throw new Error('OPTION_NEED_NOT_ACTIVE')

    const input = normalizeOptionInput(args)
    const { vehicles, ...optionInput } = input
    if (optionInput.carrierId)
      await requireCarrierWriteAccess(ctx, option.organizationId, optionInput.carrierId)
    else if (membership.role === 'AGENT')
      throw new Error('OPTION_CARRIER_NOT_ASSIGNED')
    if (optionInput.proposedTruckCount > need.remainingTruckCount)
      throw new Error('OPTION_PROPOSED_COUNT_EXCEEDS_REMAINING')

    const now = Date.now()
    await ctx.db.patch(args.optionId, {
      ...optionInput,
      status: 'PENDING',
      decisionNote: undefined,
      decidedAt: undefined,
      decidedBy: undefined,
      updatedAt: now,
      updatedBy: userId,
    })
    await replaceOptionVehicles(ctx, { ...option, carrierId: optionInput.carrierId }, vehicles, userId)

    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: args.optionId,
      action: 'REVISE',
      previousValue: option,
      newValue: { ...optionInput, status: 'PENDING', vehicleCount: vehicles?.length ?? 0 },
    })

    return args.optionId
  },
})

export const validate = mutation({
  args: {
    optionId: v.id('carrierOptions'),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const option = await requireOption(ctx, args.optionId)
    await requireRole(ctx, option.organizationId, OPTION_REVIEW_ROLES)
    if (option.status !== 'PENDING')
      throw new Error('OPTION_NOT_PENDING')
    if (!option.documentsConfirmed)
      throw new Error('OPTION_DOCUMENTS_NOT_CONFIRMED')
    const vehicles = await ctx.db
      .query('carrierOptionVehicles')
      .withIndex('by_option', query => query.eq('optionId', args.optionId))
      .collect()
    if (vehicles.length !== option.proposedTruckCount)
      throw new Error('OPTION_VEHICLES_REQUIRED')
    if (vehicles.some(vehicle => !vehicle.documentsConfirmed))
      throw new Error('OPTION_VEHICLE_DOCUMENTS_NOT_CONFIRMED')

    const now = Date.now()
    const reviewNote = args.reviewNote?.trim() || undefined
    await ctx.db.patch(args.optionId, {
      status: 'VALIDATED',
      decisionNote: reviewNote,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: args.optionId,
      action: 'VALIDATE',
      previousValue: { status: option.status },
      newValue: { status: 'VALIDATED', reviewNote },
    })
    await notifyOrganizationRoles(ctx, {
      organizationId: option.organizationId,
      roles: ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'],
      excludeUserId: userId,
      kind: 'CALLING_OPTION_VALIDATED',
      title: `Disponibilité validée · ${option.reference}`,
      body: 'La disponibilité est prête pour la décision Opérations.',
      href: `/operations/options/${args.optionId}`,
      deduplicationKey: `calling-option:${args.optionId}:validated`,
    })

    return args.optionId
  },
})

export const negotiate = mutation({
  args: {
    optionId: v.id('carrierOptions'),
    decisionNote: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const option = await requireOption(ctx, args.optionId)
    const { membership } = await requireOrganizationAccess(ctx, option.organizationId)
    if (membership.role === 'AGENT' && option.createdBy !== membership.userId)
      throw new Error('OPTION_READ_ACCESS_DENIED')
    await requireRole(ctx, option.organizationId, OPTION_REVIEW_ROLES)

    if (!canReviewOption(option.status))
      throw new Error('OPTION_NOT_DECIDABLE')
    const decisionNote = args.decisionNote.trim()
    if (decisionNote.length < 2)
      throw new Error('OPTION_DECISION_NOTE_REQUIRED')

    const now = Date.now()
    await ctx.db.patch(args.optionId, {
      status: 'NEGOTIATION',
      decisionNote,
      decidedAt: now,
      decidedBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: args.optionId,
      action: 'NEGOTIATE',
      previousValue: { status: option.status },
      newValue: { status: 'NEGOTIATION', decisionNote },
    })
    await createNotification(ctx, {
      organizationId: option.organizationId,
      userId: option.createdBy,
      kind: 'CALLING_OPTION_NEGOTIATION',
      title: `Retour à reprendre · ${option.reference}`,
      body: decisionNote,
      href: `/operations/options/${args.optionId}`,
      deduplicationKey: `calling-option:${args.optionId}:negotiation`,
    })

    return args.optionId
  },
})

export const refuse = mutation({
  args: {
    optionId: v.id('carrierOptions'),
    decisionNote: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const option = await requireOption(ctx, args.optionId)
    await requireOrganizationAccess(ctx, option.organizationId)
    await requireRole(ctx, option.organizationId, OPTION_REVIEW_ROLES)

    if (!canReviewOption(option.status))
      throw new Error('OPTION_FINAL_STATE')
    const decisionNote = args.decisionNote.trim()
    if (decisionNote.length < 2)
      throw new Error('OPTION_DECISION_NOTE_REQUIRED')

    const now = Date.now()
    await ctx.db.patch(args.optionId, {
      status: 'REFUSED',
      decisionNote,
      decidedAt: now,
      decidedBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: args.optionId,
      action: 'REFUSE',
      previousValue: { status: option.status },
      newValue: { status: 'REFUSED', decisionNote },
    })
    await createNotification(ctx, {
      organizationId: option.organizationId,
      userId: option.createdBy,
      kind: 'CALLING_OPTION_REFUSED',
      title: `Retour refusé · ${option.reference}`,
      body: decisionNote,
      href: `/operations/options/${args.optionId}`,
      deduplicationKey: `calling-option:${args.optionId}:refused`,
    })

    return args.optionId
  },
})

export const accept = mutation({
  args: {
    optionId: v.id('carrierOptions'),
    acceptedTruckCount: v.number(),
    acceptedOptionVehicleIds: v.optional(v.array(v.id('carrierOptionVehicles'))),
    decisionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const option = await requireOption(ctx, args.optionId)
    await requireOrganizationAccess(ctx, option.organizationId)
    await requireRole(ctx, option.organizationId, OPTION_DECISION_ROLES)

    if (!canDecideValidatedOption(option.status))
      throw new Error('OPTION_FINAL_STATE')

    const existingMission = await ctx.db
      .query('missions')
      .withIndex('by_option', query => query.eq('optionId', args.optionId))
      .unique()
    if (existingMission)
      throw new Error('OPTION_MISSION_ALREADY_EXISTS')

    const need = await ctx.db.get(option.needId)
    if (!need || need.organizationId !== option.organizationId)
      throw new Error('NEED_ORGANIZATION_MISMATCH')
    if (need.status !== 'OPEN' && need.status !== 'PARTIAL')
      throw new Error('OPTION_NEED_NOT_ACTIVE')

    const reportedVehicles = await ctx.db
      .query('carrierOptionVehicles')
      .withIndex('by_option', query => query.eq('optionId', args.optionId))
      .collect()
    const reportedById = new Map(reportedVehicles.map(vehicle => [vehicle._id, vehicle]))
    const selectedVehicles = args.acceptedOptionVehicleIds
      ? args.acceptedOptionVehicleIds.map(vehicleId => reportedById.get(vehicleId))
      : reportedVehicles.slice(0, args.acceptedTruckCount)
    if (
      selectedVehicles.length !== args.acceptedTruckCount
      || selectedVehicles.some(vehicle => !vehicle || !vehicle.documentsConfirmed)
    ) {
      throw new Error('OPTION_ACCEPTED_VEHICLES_INVALID')
    }
    for (const vehicle of selectedVehicles) {
      if (!vehicle)
        continue
      const reservations = await ctx.db
        .query('missionVehicleAssignments')
        .withIndex('by_organization_registration', query => query
          .eq('organizationId', option.organizationId)
          .eq('normalizedRegistration', vehicle.normalizedRegistration))
        .collect()
      const hasActiveReservation = await Promise.all(reservations.map(async (reservation) => {
        const reservedMission = await ctx.db.get(reservation.missionId)
        return reservedMission && !['COMPLETED', 'CANCELLED'].includes(reservedMission.status)
      }))
      if (hasActiveReservation.some(Boolean))
        throw new Error('OPTION_VEHICLE_ALREADY_RESERVED')
    }

    const progress = applyOptionAcceptance(
      need.requestedTruckCount,
      need.approvedTruckCount,
      option.proposedTruckCount,
      args.acceptedTruckCount,
    )
    const now = Date.now()
    const decisionNote = args.decisionNote?.trim() || undefined
    const missionReference = await generateWorkflowReference(
      ctx,
      option.organizationId,
      'MISSION',
      new Date(now),
    )
    const missionId = await ctx.db.insert('missions', {
      organizationId: option.organizationId,
      needId: option.needId,
      optionId: args.optionId,
      carrierId: option.carrierId,
      reference: missionReference,
      carrierName: option.carrierName,
      carrierPhone: option.carrierPhone,
      truckType: option.truckType,
      truckCount: args.acceptedTruckCount,
      pricePerTruck: option.pricePerTruck,
      totalPrice: option.pricePerTruck * args.acceptedTruckCount,
      loadingLocation: need.loadingLocation,
      destination: need.destination,
      mobilizationAt: need.mobilizationAt,
      status: 'CONFIRMED',
      createdAt: now,
      createdBy: userId,
      lastUpdatedAt: now,
    })
    await ctx.db.insert('missionEvents', {
      organizationId: option.organizationId,
      missionId,
      status: 'CONFIRMED',
      note: 'Mission créée depuis une option acceptée.',
      createdAt: now,
      createdBy: userId,
    })
    await Promise.all(selectedVehicles.map(vehicle => vehicle && ctx.db.insert('missionVehicleAssignments', {
      organizationId: option.organizationId,
      missionId,
      optionVehicleId: vehicle._id,
      vehicleId: vehicle.vehicleId,
      registration: vehicle.registration,
      normalizedRegistration: vehicle.normalizedRegistration,
      createdAt: now,
      createdBy: userId,
    })))

    await ctx.db.patch(args.optionId, {
      status: 'ACCEPTED',
      acceptedTruckCount: args.acceptedTruckCount,
      decisionNote,
      decidedAt: now,
      decidedBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await ctx.db.patch(option.needId, {
      approvedTruckCount: progress.approvedTruckCount,
      remainingTruckCount: progress.remainingTruckCount,
      status: progress.status,
      lastUpdatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: args.optionId,
      action: 'ACCEPT',
      previousValue: { status: option.status },
      newValue: {
        status: 'ACCEPTED',
        acceptedTruckCount: args.acceptedTruckCount,
        decisionNote,
        missionId,
      },
    })
    await createNotification(ctx, {
      organizationId: option.organizationId,
      userId: option.createdBy,
      kind: 'CALLING_OPTION_DECIDED',
      title: `Disponibilité acceptée · ${option.reference}`,
      body: `${args.acceptedTruckCount} camion(s) ont été affectés à la mission ${missionReference}.`,
      href: `/operations/options/${args.optionId}`,
      deduplicationKey: `calling-option:${args.optionId}:accepted-agent`,
    })
    await notifyOrganizationRoles(ctx, {
      organizationId: option.organizationId,
      roles: ['SUPERVISOR'],
      excludeUserId: userId,
      kind: 'CALLING_OPTION_DECIDED',
      title: `Disponibilité acceptée · ${option.reference}`,
      body: `La mission ${missionReference} a été créée.`,
      href: `/operations/options/${args.optionId}`,
      deduplicationKey: `calling-option:${args.optionId}:accepted-supervisor`,
    })
    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: option.needId,
      action: 'OPTION_ACCEPTED',
      previousValue: {
        status: need.status,
        approvedTruckCount: need.approvedTruckCount,
        remainingTruckCount: need.remainingTruckCount,
      },
      newValue: { ...progress, optionId: args.optionId, missionId },
    })
    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'mission',
      entityId: missionId,
      action: 'CREATE',
      newValue: {
        reference: missionReference,
        needId: option.needId,
        optionId: args.optionId,
        truckCount: args.acceptedTruckCount,
      },
    })

    return missionId
  },
})

export const getById = query({
  args: {
    optionId: v.id('carrierOptions'),
  },
  handler: async (ctx, args) => {
    const option = await ctx.db.get(args.optionId)
    if (!option)
      return null

    const { membership } = await requireOrganizationAccess(ctx, option.organizationId)
    if (membership.role === 'AGENT' && option.createdBy !== membership.userId)
      throw new Error('OPTION_READ_ACCESS_DENIED')
    return await enrichOption(ctx, option)
  },
})

export const listForNeed = query({
  args: {
    needId: v.id('needs'),
  },
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId)
    if (!need)
      return []

    const { membership } = await requireOrganizationAccess(ctx, need.organizationId)
    const options = await ctx.db
      .query('carrierOptions')
      .withIndex('by_need', query => query.eq('needId', args.needId))
      .collect()

    return await Promise.all(
      options
        .filter(option => membership.role !== 'AGENT' || option.createdBy === membership.userId)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(option => enrichOption(ctx, option)),
    )
  },
})

export const listForOrganization = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireOrganizationAccess(ctx, args.organizationId)
    const options = await ctx.db
      .query('carrierOptions')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return await Promise.all(
      options
        .filter(option => membership.role !== 'AGENT' || option.createdBy === membership.userId)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(option => enrichOption(ctx, option)),
    )
  },
})
