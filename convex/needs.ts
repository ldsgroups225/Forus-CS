import type { NeedStatus } from '../shared/domain'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { deriveNeedProgress } from '../shared/needProgress'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { generateNeedReference, NEED_WRITE_ROLES } from './lib/needs'

const urgency = v.union(
  v.literal('LOW'),
  v.literal('MEDIUM'),
  v.literal('HIGH'),
  v.literal('CRITICAL'),
)

const needFields = {
  clientId: v.id('clients'),
  projectName: v.optional(v.string()),
  urgency,
  truckType: v.string(),
  requestedTruckCount: v.number(),
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
}

interface NeedInput {
  clientId: Id<'clients'>
  projectName?: string
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  truckType: string
  requestedTruckCount: number
  tonnageTons: number
  cargoType: string
  packaging?: string
  loadingLocation: string
  destination: string
  mobilizationAt: number
  rotations?: number
  estimatedDuration?: string
  targetCarrierPrice?: number
  maximumCarrierPrice?: number
  paymentTerms?: string
  negotiationAllowed: boolean
  constraints: string
}

function normalizedNeedInput(args: NeedInput): NeedInput {
  if (!Number.isInteger(args.requestedTruckCount) || args.requestedTruckCount <= 0)
    throw new Error('NEED_REQUESTED_COUNT_INVALID')

  if (!Number.isFinite(args.tonnageTons) || args.tonnageTons <= 0)
    throw new Error('NEED_TONNAGE_INVALID')

  if (!Number.isFinite(args.mobilizationAt))
    throw new Error('NEED_MOBILIZATION_INVALID')

  if (args.rotations !== undefined && (!Number.isInteger(args.rotations) || args.rotations <= 0))
    throw new Error('NEED_ROTATIONS_INVALID')

  if (
    args.targetCarrierPrice !== undefined
    && args.maximumCarrierPrice !== undefined
    && args.targetCarrierPrice > args.maximumCarrierPrice
  ) {
    throw new Error('NEED_PRICE_RANGE_INVALID')
  }

  const requiredText = [
    args.truckType,
    args.cargoType,
    args.loadingLocation,
    args.destination,
  ]

  if (requiredText.some(value => value.trim().length < 2))
    throw new Error('NEED_REQUIRED_FIELD_INVALID')

  return {
    clientId: args.clientId,
    projectName: args.projectName?.trim() || undefined,
    urgency: args.urgency,
    truckType: args.truckType.trim(),
    requestedTruckCount: args.requestedTruckCount,
    tonnageTons: args.tonnageTons,
    cargoType: args.cargoType.trim(),
    packaging: args.packaging?.trim() || undefined,
    loadingLocation: args.loadingLocation.trim(),
    destination: args.destination.trim(),
    mobilizationAt: args.mobilizationAt,
    rotations: args.rotations,
    estimatedDuration: args.estimatedDuration?.trim() || undefined,
    targetCarrierPrice: args.targetCarrierPrice,
    maximumCarrierPrice: args.maximumCarrierPrice,
    paymentTerms: args.paymentTerms?.trim() || undefined,
    negotiationAllowed: args.negotiationAllowed,
    constraints: args.constraints.trim(),
  }
}

async function ensureClientBelongsToOrganization(
  ctx: Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>,
  clientId: Id<'clients'>,
  organizationId: Id<'organizations'>,
) {
  const client = await ctx.db.get(clientId)

  if (!client || client.organizationId !== organizationId || !client.isActive)
    throw new Error('CLIENT_ORGANIZATION_MISMATCH')

  return client
}

async function enrichNeed(
  ctx: Pick<QueryCtx, 'db'>,
  need: Doc<'needs'>,
) {
  const client = await ctx.db.get(need.clientId)
  return {
    ...need,
    clientName: client?.name ?? 'Client inconnu',
    clientContactName: client?.contactName,
    clientPhone: client?.phone,
    clientEmail: client?.email,
  }
}

async function requireNeedWriteAccess(ctx: MutationCtx, needId: Id<'needs'>) {
  const need = await ctx.db.get(needId)

  if (!need)
    throw new Error('NEED_NOT_FOUND')

  await requireRole(ctx, need.organizationId, NEED_WRITE_ROLES)
  return need
}

export const createDraft = mutation({
  args: {
    organizationId: v.id('organizations'),
    ...needFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireRole(ctx, args.organizationId, NEED_WRITE_ROLES)
    await ensureClientBelongsToOrganization(ctx, args.clientId, args.organizationId)

    const input = normalizedNeedInput(args)
    const now = Date.now()
    const reference = await generateNeedReference(ctx, args.organizationId, new Date(now))

    const needId = await ctx.db.insert('needs', {
      organizationId: args.organizationId,
      reference,
      ...input,
      approvedTruckCount: 0,
      remainingTruckCount: input.requestedTruckCount,
      status: 'DRAFT',
      lastUpdatedAt: now,
      createdAt: now,
      createdBy: userId,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: needId,
      action: 'CREATE_DRAFT',
      newValue: { reference, ...input },
    })

    return needId
  },
})

export const updateDraft = mutation({
  args: {
    needId: v.id('needs'),
    ...needFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const need = await requireNeedWriteAccess(ctx, args.needId)

    if (need.status === 'SATISFIED' || need.status === 'CANCELLED')
      throw new Error('NEED_FINAL_STATE')

    await ensureClientBelongsToOrganization(ctx, args.clientId, need.organizationId)

    const input = normalizedNeedInput(args)
    const progress = deriveNeedProgress(
      input.requestedTruckCount,
      need.approvedTruckCount,
      false,
    )
    const status: NeedStatus = need.status === 'DRAFT' ? 'DRAFT' : progress.status
    const now = Date.now()

    await ctx.db.patch(args.needId, {
      ...input,
      remainingTruckCount: progress.remainingTruckCount,
      status,
      lastUpdatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: need.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: args.needId,
      action: 'UPDATE',
      previousValue: need,
      newValue: { ...input, status, remainingTruckCount: progress.remainingTruckCount },
    })

    return args.needId
  },
})

export const publish = mutation({
  args: {
    needId: v.id('needs'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const need = await requireNeedWriteAccess(ctx, args.needId)

    if (need.status !== 'DRAFT')
      throw new Error('NEED_NOT_DRAFT')

    const now = Date.now()
    await ctx.db.patch(args.needId, {
      status: 'OPEN',
      publishedAt: now,
      lastUpdatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: need.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: args.needId,
      action: 'PUBLISH',
      previousValue: { status: need.status },
      newValue: { status: 'OPEN', publishedAt: now },
    })

    return args.needId
  },
})

export const cancel = mutation({
  args: {
    needId: v.id('needs'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const need = await requireNeedWriteAccess(ctx, args.needId)

    if (need.status === 'SATISFIED' || need.status === 'CANCELLED')
      throw new Error('NEED_FINAL_STATE')

    const now = Date.now()
    const progress = deriveNeedProgress(
      need.requestedTruckCount,
      need.approvedTruckCount,
      true,
    )

    await ctx.db.patch(args.needId, {
      status: progress.status,
      remainingTruckCount: progress.remainingTruckCount,
      cancelledAt: now,
      lastUpdatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: need.organizationId,
      actorId: userId,
      entityType: 'need',
      entityId: args.needId,
      action: 'CANCEL',
      previousValue: { status: need.status },
      newValue: { status: progress.status, cancelledAt: now },
    })

    return args.needId
  },
})

export const getById = query({
  args: {
    needId: v.id('needs'),
  },
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId)
    if (!need)
      return null

    await requireOrganizationAccess(ctx, need.organizationId)
    return await enrichNeed(ctx, need)
  },
})

export const listActive = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const [open, partial] = await Promise.all([
      ctx.db
        .query('needs')
        .withIndex('by_organization_status', query =>
          query.eq('organizationId', args.organizationId).eq('status', 'OPEN'))
        .collect(),
      ctx.db
        .query('needs')
        .withIndex('by_organization_status', query =>
          query.eq('organizationId', args.organizationId).eq('status', 'PARTIAL'))
        .collect(),
    ])

    return await Promise.all(
      [...open, ...partial]
        .sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt)
        .map(need => enrichNeed(ctx, need)),
    )
  },
})

export const listAll = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const needs = await ctx.db
      .query('needs')
      .withIndex('by_organization_updated', query => query.eq('organizationId', args.organizationId))
      .order('desc')
      .collect()

    return await Promise.all(needs.map(need => enrichNeed(ctx, need)))
  },
})
