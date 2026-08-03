import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'

const assignmentRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
] as const

export const assign = mutation({
  args: {
    carrierId: v.id('carriers'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireRole(ctx, carrier.organizationId, assignmentRoles)
    const agentMembership = await ctx.db
      .query('memberships')
      .withIndex('by_organization_user', query =>
        query.eq('organizationId', carrier.organizationId).eq('userId', args.agentId))
      .unique()
    if (!agentMembership?.isActive || agentMembership.role !== 'AGENT')
      throw new Error('PORTFOLIO_AGENT_INVALID')

    const existing = await ctx.db
      .query('carrierAssignments')
      .withIndex('by_organization_carrier', query =>
        query.eq('organizationId', carrier.organizationId).eq('carrierId', args.carrierId))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        agentId: args.agentId,
        callingAgentId: undefined,
        assignedAt: now,
        assignedBy: userId,
      })
    }
    else {
      await ctx.db.insert('carrierAssignments', {
        organizationId: carrier.organizationId,
        carrierId: args.carrierId,
        agentId: args.agentId,
        assignedAt: now,
        assignedBy: userId,
      })
    }

    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrierAssignment',
      entityId: args.carrierId,
      action: 'ASSIGN',
      previousValue: { agentId: existing?.agentId },
      newValue: { agentId: args.agentId },
    })

    return args.carrierId
  },
})

export const unassign = mutation({
  args: {
    carrierId: v.id('carriers'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireRole(ctx, carrier.organizationId, assignmentRoles)
    const existing = await ctx.db
      .query('carrierAssignments')
      .withIndex('by_organization_carrier', query =>
        query.eq('organizationId', carrier.organizationId).eq('carrierId', args.carrierId))
      .unique()
    if (existing)
      await ctx.db.delete(existing._id)

    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrierAssignment',
      entityId: args.carrierId,
      action: 'UNASSIGN',
      previousValue: { agentId: existing?.agentId },
    })

    return args.carrierId
  },
})

export const assignToCallingAgent = mutation({
  args: {
    carrierId: v.id('carriers'),
    callingAgentId: v.id('callingAgents'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const carrier = await ctx.db.get(args.carrierId)
    if (!carrier)
      throw new Error('CARRIER_NOT_FOUND')

    await requireRole(ctx, carrier.organizationId, assignmentRoles)
    const callingAgent = await ctx.db.get(args.callingAgentId)
    if (
      !callingAgent
      || !callingAgent.isActive
      || callingAgent.organizationId !== carrier.organizationId
    ) {
      throw new Error('CALLING_AGENT_INVALID')
    }

    const existing = await ctx.db
      .query('carrierAssignments')
      .withIndex('by_organization_carrier', query =>
        query.eq('organizationId', carrier.organizationId).eq('carrierId', args.carrierId))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        // An envelope is a distinct portfolio authority, not a duplicate direct assignment.
        agentId: undefined,
        callingAgentId: args.callingAgentId,
        assignedAt: now,
        assignedBy: userId,
      })
    }
    else {
      await ctx.db.insert('carrierAssignments', {
        organizationId: carrier.organizationId,
        carrierId: args.carrierId,
        callingAgentId: args.callingAgentId,
        assignedAt: now,
        assignedBy: userId,
      })
    }

    await writeAuditLog(ctx, {
      organizationId: carrier.organizationId,
      actorId: userId,
      entityType: 'carrierAssignment',
      entityId: args.carrierId,
      action: 'ASSIGN_CALLING_AGENT',
      previousValue: { agentId: existing?.agentId, callingAgentId: existing?.callingAgentId },
      newValue: { callingAgentId: args.callingAgentId },
    })

    return args.carrierId
  },
})

export const listForAgent = query({
  args: {
    organizationId: v.id('organizations'),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireOrganizationAccess(ctx, args.organizationId)
    const requestedAgentId = args.agentId ?? membership.userId
    if (
      requestedAgentId !== membership.userId
      && !assignmentRoles.includes(membership.role as typeof assignmentRoles[number])
    ) {
      throw new Error('ROLE_FORBIDDEN')
    }

    const assignments = await ctx.db
      .query('carrierAssignments')
      .withIndex('by_organization_agent', query =>
        query.eq('organizationId', args.organizationId).eq('agentId', requestedAgentId))
      .collect()
    return await Promise.all(assignments.map(async assignment => ({
      ...assignment,
      carrier: await ctx.db.get(assignment.carrierId),
    })))
  },
})
