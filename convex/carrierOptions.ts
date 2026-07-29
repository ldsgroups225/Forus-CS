import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { applyOptionAcceptance } from '../shared/optionWorkflow'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { generateWorkflowReference } from './lib/workflow'

const OPTION_SUBMIT_ROLES = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
  'AGENT',
] as const

const OPTION_DECISION_ROLES = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
] as const

const optionFields = {
  carrierName: v.string(),
  carrierPhone: v.optional(v.string()),
  carrierEmail: v.optional(v.string()),
  truckType: v.string(),
  proposedTruckCount: v.number(),
  pricePerTruck: v.number(),
  availableAt: v.number(),
  paymentTerms: v.optional(v.string()),
  documentsConfirmed: v.boolean(),
  notes: v.optional(v.string()),
}

interface OptionInput {
  carrierName: string
  carrierPhone?: string
  carrierEmail?: string
  truckType: string
  proposedTruckCount: number
  pricePerTruck: number
  availableAt: number
  paymentTerms?: string
  documentsConfirmed: boolean
  notes?: string
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

  return {
    carrierName: input.carrierName.trim(),
    carrierPhone: input.carrierPhone?.trim() || undefined,
    carrierEmail: carrierEmail || undefined,
    truckType: input.truckType.trim(),
    proposedTruckCount: input.proposedTruckCount,
    pricePerTruck: input.pricePerTruck,
    availableAt: input.availableAt,
    paymentTerms: input.paymentTerms?.trim() || undefined,
    documentsConfirmed: input.documentsConfirmed,
    notes: input.notes?.trim() || undefined,
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

async function enrichOption(
  ctx: Pick<QueryCtx, 'db'>,
  option: Doc<'carrierOptions'>,
) {
  const [need, mission] = await Promise.all([
    ctx.db.get(option.needId),
    ctx.db
      .query('missions')
      .withIndex('by_option', query => query.eq('optionId', option._id))
      .unique(),
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
    await requireRole(ctx, args.organizationId, OPTION_SUBMIT_ROLES)

    const need = await ctx.db.get(args.needId)
    if (!need || need.organizationId !== args.organizationId)
      throw new Error('NEED_ORGANIZATION_MISMATCH')
    if (need.status !== 'OPEN' && need.status !== 'PARTIAL')
      throw new Error('OPTION_NEED_NOT_ACTIVE')

    const input = normalizeOptionInput(args)
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
      ...input,
      status: 'PENDING',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: optionId,
      action: 'SUBMIT',
      newValue: { reference, needId: args.needId, ...input },
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: args.needId,
      action: 'OPTION_SUBMITTED',
      newValue: { optionId, reference, proposedTruckCount: input.proposedTruckCount },
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
    await requireOrganizationAccess(ctx, option.organizationId)
    await requireRole(ctx, option.organizationId, OPTION_SUBMIT_ROLES)

    if (option.status !== 'NEGOTIATION')
      throw new Error('OPTION_NOT_NEGOTIATING')

    const need = await ctx.db.get(option.needId)
    if (!need || (need.status !== 'OPEN' && need.status !== 'PARTIAL'))
      throw new Error('OPTION_NEED_NOT_ACTIVE')

    const input = normalizeOptionInput(args)
    if (input.proposedTruckCount > need.remainingTruckCount)
      throw new Error('OPTION_PROPOSED_COUNT_EXCEEDS_REMAINING')

    const now = Date.now()
    await ctx.db.patch(args.optionId, {
      ...input,
      status: 'PENDING',
      decisionNote: undefined,
      decidedAt: undefined,
      decidedBy: undefined,
      updatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: option.organizationId,
      actorId: userId,
      entityType: 'carrierOption',
      entityId: args.optionId,
      action: 'REVISE',
      previousValue: option,
      newValue: { ...input, status: 'PENDING' },
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
    await requireOrganizationAccess(ctx, option.organizationId)
    await requireRole(ctx, option.organizationId, OPTION_DECISION_ROLES)

    if (option.status !== 'PENDING')
      throw new Error('OPTION_NOT_PENDING')
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
    await requireRole(ctx, option.organizationId, OPTION_DECISION_ROLES)

    if (option.status !== 'PENDING' && option.status !== 'NEGOTIATION')
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

    return args.optionId
  },
})

export const accept = mutation({
  args: {
    optionId: v.id('carrierOptions'),
    acceptedTruckCount: v.number(),
    decisionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const option = await requireOption(ctx, args.optionId)
    await requireOrganizationAccess(ctx, option.organizationId)
    await requireRole(ctx, option.organizationId, OPTION_DECISION_ROLES)

    if (option.status !== 'PENDING' && option.status !== 'NEGOTIATION')
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

    await requireOrganizationAccess(ctx, option.organizationId)
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

    await requireOrganizationAccess(ctx, need.organizationId)
    const options = await ctx.db
      .query('carrierOptions')
      .withIndex('by_need', query => query.eq('needId', args.needId))
      .collect()

    return await Promise.all(
      options
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
    await requireOrganizationAccess(ctx, args.organizationId)
    const options = await ctx.db
      .query('carrierOptions')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return await Promise.all(
      options
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(option => enrichOption(ctx, option)),
    )
  },
})
