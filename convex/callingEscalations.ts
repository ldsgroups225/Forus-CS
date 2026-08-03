import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { notifyOrganizationRoles } from './lib/notifications'

const supervisorRoles = ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER', 'SUPERVISOR'] as const

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    needId: v.optional(v.id('needs')),
    carrierName: v.string(),
    phone: v.optional(v.string()),
    source: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const { membership } = await requireOrganizationAccess(ctx, args.organizationId)
    if (membership.role !== 'AGENT')
      throw new Error('CALLING_ESCALATION_AGENT_ONLY')
    if (args.needId) {
      const need = await ctx.db.get(args.needId)
      if (!need || need.organizationId !== args.organizationId)
        throw new Error('CALLING_ESCALATION_NEED_INVALID')
    }
    const carrierName = args.carrierName.trim()
    const source = args.source.trim()
    const note = args.note.trim()
    if (carrierName.length < 2 || source.length < 2 || note.length < 2)
      throw new Error('CALLING_ESCALATION_FIELDS_REQUIRED')

    const escalationId = await ctx.db.insert('callingEscalations', {
      organizationId: args.organizationId,
      needId: args.needId,
      carrierName,
      phone: args.phone?.trim() || undefined,
      source,
      note,
      status: 'PENDING',
      createdAt: Date.now(),
      createdBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'callingEscalation',
      entityId: escalationId,
      action: 'CREATE',
      newValue: { needId: args.needId, carrierName, source },
    })
    await notifyOrganizationRoles(ctx, {
      organizationId: args.organizationId,
      roles: supervisorRoles,
      excludeUserId: userId,
      kind: 'CALLING_PORTFOLIO_ESCALATION',
      title: 'Prospect Calling à traiter',
      body: `${carrierName} a été remonté hors portefeuille.`,
      href: '/operations/calling/supervision',
    })
    return escalationId
  },
})

export const listPending = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.organizationId, supervisorRoles)
    return await ctx.db.query('callingEscalations')
      .withIndex('by_organization_status', query => query
        .eq('organizationId', args.organizationId)
        .eq('status', 'PENDING'))
      .order('desc')
      .collect()
  },
})

export const resolve = mutation({
  args: { escalationId: v.id('callingEscalations') },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const escalation = await ctx.db.get(args.escalationId)
    if (!escalation)
      throw new Error('CALLING_ESCALATION_NOT_FOUND')
    await requireRole(ctx, escalation.organizationId, supervisorRoles)
    await ctx.db.patch(args.escalationId, { status: 'RESOLVED', resolvedAt: Date.now(), resolvedBy: userId })
    return args.escalationId
  },
})
