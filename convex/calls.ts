import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess } from './lib/authz'
import { findIdempotentResult, recordIdempotentResult } from './lib/idempotency'
import { createNotification } from './lib/notifications'
import { insertCallIntoReports } from './lib/reportAggregates'

const callOutcome = v.union(
  v.literal('AVAILABLE'),
  v.literal('UNAVAILABLE'),
  v.literal('CALLBACK'),
  v.literal('NO_ANSWER'),
  v.literal('WRONG_NUMBER'),
)

async function validateRelations(
  ctx: Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>,
  organizationId: Id<'organizations'>,
  carrierId?: Id<'carriers'>,
  needId?: Id<'needs'>,
) {
  if (carrierId) {
    const carrier = await ctx.db.get(carrierId)
    if (!carrier || carrier.organizationId !== organizationId)
      throw new Error('CALL_CARRIER_INVALID')
  }
  if (needId) {
    const need = await ctx.db.get(needId)
    if (!need || need.organizationId !== organizationId)
      throw new Error('CALL_NEED_INVALID')
  }
}

export const log = mutation({
  args: {
    organizationId: v.id('organizations'),
    carrierId: v.optional(v.id('carriers')),
    needId: v.optional(v.id('needs')),
    direction: v.union(v.literal('OUTBOUND'), v.literal('INBOUND')),
    outcome: callOutcome,
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    calledAt: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const receipt = await findIdempotentResult(ctx, args.organizationId, args.idempotencyKey)
    if (receipt?.resultId)
      return receipt.resultId

    await validateRelations(ctx, args.organizationId, args.carrierId, args.needId)
    const notes = args.notes?.trim() || undefined
    const phone = args.phone?.trim() || undefined
    if (!args.carrierId && !phone)
      throw new Error('CALL_CONTACT_REQUIRED')

    const now = Date.now()
    const callLogId = await ctx.db.insert('callLogs', {
      organizationId: args.organizationId,
      carrierId: args.carrierId,
      needId: args.needId,
      direction: args.direction,
      outcome: args.outcome,
      phone,
      notes,
      calledAt: args.calledAt ?? now,
      createdAt: now,
      createdBy: userId,
      idempotencyKey: args.idempotencyKey,
    })
    const callLog = await ctx.db.get(callLogId)
    if (callLog)
      await insertCallIntoReports(ctx, callLog)
    await recordIdempotentResult(ctx, {
      organizationId: args.organizationId,
      key: args.idempotencyKey,
      operation: 'calls.log',
      resultId: callLogId,
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'callLog',
      entityId: callLogId,
      action: 'CREATE',
      newValue: { carrierId: args.carrierId, needId: args.needId, outcome: args.outcome },
    })

    return callLogId
  },
})

export const createFollowUp = mutation({
  args: {
    organizationId: v.id('organizations'),
    carrierId: v.optional(v.id('carriers')),
    needId: v.optional(v.id('needs')),
    assignedTo: v.optional(v.string()),
    dueAt: v.number(),
    notes: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const receipt = await findIdempotentResult(ctx, args.organizationId, args.idempotencyKey)
    if (receipt?.resultId)
      return receipt.resultId

    await validateRelations(ctx, args.organizationId, args.carrierId, args.needId)
    const assignedTo = args.assignedTo ?? userId
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_organization_user', query =>
        query.eq('organizationId', args.organizationId).eq('userId', assignedTo))
      .unique()
    if (!membership?.isActive)
      throw new Error('FOLLOW_UP_ASSIGNEE_INVALID')
    if (!Number.isFinite(args.dueAt))
      throw new Error('FOLLOW_UP_DUE_AT_INVALID')
    const notes = args.notes.trim()
    if (notes.length < 2)
      throw new Error('FOLLOW_UP_NOTES_REQUIRED')

    const now = Date.now()
    const followUpId = await ctx.db.insert('followUps', {
      organizationId: args.organizationId,
      carrierId: args.carrierId,
      needId: args.needId,
      assignedTo,
      dueAt: args.dueAt,
      notes,
      status: 'PENDING',
      createdAt: now,
      createdBy: userId,
      idempotencyKey: args.idempotencyKey,
    })
    await recordIdempotentResult(ctx, {
      organizationId: args.organizationId,
      key: args.idempotencyKey,
      operation: 'calls.createFollowUp',
      resultId: followUpId,
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'followUp',
      entityId: followUpId,
      action: 'CREATE',
      newValue: { carrierId: args.carrierId, needId: args.needId, assignedTo, dueAt: args.dueAt },
    })
    if (assignedTo !== userId) {
      await createNotification(ctx, {
        organizationId: args.organizationId,
        userId: assignedTo,
        kind: 'FOLLOW_UP_ASSIGNED',
        title: 'Nouvelle relance',
        body: notes,
        href: '/operations/transporteurs',
      })
    }

    return followUpId
  },
})

export const completeFollowUp = mutation({
  args: {
    followUpId: v.id('followUps'),
    status: v.union(v.literal('COMPLETED'), v.literal('CANCELLED')),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const followUp = await ctx.db.get(args.followUpId)
    if (!followUp)
      throw new Error('FOLLOW_UP_NOT_FOUND')

    const { membership } = await requireOrganizationAccess(ctx, followUp.organizationId)
    if (
      followUp.assignedTo !== userId
      && membership.role !== 'ORGANIZATION_ADMIN'
      && membership.role !== 'OPERATIONS_MANAGER'
      && membership.role !== 'SUPERVISOR'
    ) {
      throw new Error('FOLLOW_UP_ACCESS_DENIED')
    }
    if (followUp.status !== 'PENDING')
      throw new Error('FOLLOW_UP_FINAL_STATE')

    const now = Date.now()
    await ctx.db.patch(args.followUpId, {
      status: args.status,
      completedAt: now,
      completedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: followUp.organizationId,
      actorId: userId,
      entityType: 'followUp',
      entityId: args.followUpId,
      action: args.status,
      previousValue: { status: followUp.status },
      newValue: { status: args.status },
    })

    return args.followUpId
  },
})

export const listRecent = query({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    return await ctx.db
      .query('callLogs')
      .withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId))
      .order('desc')
      .take(Math.min(Math.max(args.limit ?? 20, 1), 100))
  },
})

export const listFollowUps = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const followUps = await ctx.db
      .query('followUps')
      .withIndex('by_organization_due', query =>
        query.eq('organizationId', args.organizationId).eq('status', 'PENDING'))
      .collect()

    return followUps.sort((left, right) => left.dueAt - right.dueAt)
  },
})
