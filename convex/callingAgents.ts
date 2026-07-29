import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'

const managementRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
] as const

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function requireCallingAgent(
  ctx: Parameters<typeof requireOrganizationAccess>[0],
  callingAgentId: Id<'callingAgents'>,
) {
  const callingAgent = await ctx.db.get(callingAgentId)
  if (!callingAgent)
    throw new Error('CALLING_AGENT_NOT_FOUND')

  return callingAgent
}

export const list = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const callingAgents = await ctx.db
      .query('callingAgents')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return await Promise.all(callingAgents.map(async (callingAgent) => {
      const assignments = await ctx.db
        .query('carrierAssignments')
        .withIndex('by_organization_calling_agent', query =>
          query.eq('organizationId', args.organizationId).eq('callingAgentId', callingAgent._id))
        .collect()
      const linkedMember = callingAgent.linkedUserId
        ? memberships.find(membership => membership.userId === callingAgent.linkedUserId)
        : undefined

      return {
        ...callingAgent,
        assignedCarrierCount: assignments.length,
        linkedUserEmail: linkedMember?.email,
        linkedUserName: linkedMember?.displayName,
      }
    }))
  },
})

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireRole(ctx, args.organizationId, managementRoles)
    const name = args.name.trim()
    if (name.length < 2)
      throw new Error('CALLING_AGENT_NAME_INVALID')

    const slug = slugify(name)
    const existing = await ctx.db
      .query('callingAgents')
      .withIndex('by_organization_slug', query =>
        query.eq('organizationId', args.organizationId).eq('slug', slug))
      .unique()
    if (existing)
      return existing._id

    const now = Date.now()
    const callingAgentId = await ctx.db.insert('callingAgents', {
      organizationId: args.organizationId,
      name,
      slug,
      color: args.color,
      isActive: true,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'callingAgent',
      entityId: callingAgentId,
      action: 'CREATE',
      newValue: { name },
    })

    return callingAgentId
  },
})

export const update = mutation({
  args: {
    callingAgentId: v.id('callingAgents'),
    name: v.string(),
    color: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const callingAgent = await requireCallingAgent(ctx, args.callingAgentId)
    await requireRole(ctx, callingAgent.organizationId, managementRoles)
    const name = args.name.trim()
    if (name.length < 2)
      throw new Error('CALLING_AGENT_NAME_INVALID')

    await ctx.db.patch(args.callingAgentId, {
      name,
      slug: slugify(name),
      color: args.color,
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: callingAgent.organizationId,
      actorId: userId,
      entityType: 'callingAgent',
      entityId: args.callingAgentId,
      action: 'UPDATE',
      previousValue: callingAgent,
      newValue: { name, isActive: args.isActive },
    })

    return args.callingAgentId
  },
})

export const linkUser = mutation({
  args: {
    callingAgentId: v.id('callingAgents'),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const callingAgent = await requireCallingAgent(ctx, args.callingAgentId)
    await requireRole(ctx, callingAgent.organizationId, managementRoles)

    const linkedUserId = args.userId
    if (linkedUserId) {
      const membership = await ctx.db
        .query('memberships')
        .withIndex('by_organization_user', query =>
          query.eq('organizationId', callingAgent.organizationId).eq('userId', linkedUserId))
        .unique()
      if (!membership?.isActive || membership.role !== 'AGENT')
        throw new Error('CALLING_AGENT_LINK_MEMBER_INVALID')
    }

    await ctx.db.patch(args.callingAgentId, {
      linkedUserId,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: callingAgent.organizationId,
      actorId: userId,
      entityType: 'callingAgent',
      entityId: args.callingAgentId,
      action: 'LINK_USER',
      previousValue: { linkedUserId: callingAgent.linkedUserId },
      newValue: { linkedUserId },
    })

    return args.callingAgentId
  },
})
