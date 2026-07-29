import type { OrganizationRole } from '../shared/domain'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'

const role = v.union(
  v.literal('ORGANIZATION_ADMIN'),
  v.literal('OPERATIONS_MANAGER'),
  v.literal('SUPERVISOR'),
  v.literal('AGENT'),
)

async function activeAdminCount(
  ctx: Parameters<typeof requireRole>[0],
  organizationId: Parameters<typeof requireRole>[1],
) {
  const administrators = await ctx.db
    .query('memberships')
    .withIndex('by_organization_role', query =>
      query.eq('organizationId', organizationId).eq('role', 'ORGANIZATION_ADMIN'))
    .collect()

  return administrators.filter(membership => membership.isActive).length
}

export const list = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.organizationId, [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_MANAGER',
      'SUPERVISOR',
    ])
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return memberships.sort((left, right) =>
      (left.displayName ?? left.email ?? left.userId)
        .localeCompare(right.displayName ?? right.email ?? right.userId))
  },
})

export const updateRole = mutation({
  args: {
    membershipId: v.id('memberships'),
    role,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const membership = await ctx.db.get(args.membershipId)
    if (!membership)
      throw new Error('MEMBERSHIP_NOT_FOUND')

    await requireRole(ctx, membership.organizationId, ['ORGANIZATION_ADMIN'])
    if (
      membership.role === 'ORGANIZATION_ADMIN'
      && args.role !== 'ORGANIZATION_ADMIN'
      && await activeAdminCount(ctx, membership.organizationId) <= 1
    ) {
      throw new Error('ORGANIZATION_LAST_ADMIN_REQUIRED')
    }

    await ctx.db.patch(args.membershipId, {
      role: args.role,
      supervisorId: args.role === 'AGENT' ? membership.supervisorId : undefined,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: membership.organizationId,
      actorId: userId,
      entityType: 'membership',
      entityId: args.membershipId,
      action: 'UPDATE_ROLE',
      previousValue: { role: membership.role },
      newValue: { role: args.role },
    })

    return args.membershipId
  },
})

export const setActive = mutation({
  args: {
    membershipId: v.id('memberships'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const membership = await ctx.db.get(args.membershipId)
    if (!membership)
      throw new Error('MEMBERSHIP_NOT_FOUND')

    await requireRole(ctx, membership.organizationId, ['ORGANIZATION_ADMIN'])
    if (!args.isActive && membership.userId === userId)
      throw new Error('MEMBERSHIP_SELF_DEACTIVATION_FORBIDDEN')
    if (
      !args.isActive
      && membership.role === 'ORGANIZATION_ADMIN'
      && await activeAdminCount(ctx, membership.organizationId) <= 1
    ) {
      throw new Error('ORGANIZATION_LAST_ADMIN_REQUIRED')
    }

    await ctx.db.patch(args.membershipId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: membership.organizationId,
      actorId: userId,
      entityType: 'membership',
      entityId: args.membershipId,
      action: args.isActive ? 'ACTIVATE' : 'DEACTIVATE',
      previousValue: { isActive: membership.isActive },
      newValue: { isActive: args.isActive },
    })

    return args.membershipId
  },
})

export const assignSupervisor = mutation({
  args: {
    membershipId: v.id('memberships'),
    supervisorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const membership = await ctx.db.get(args.membershipId)
    if (!membership)
      throw new Error('MEMBERSHIP_NOT_FOUND')

    await requireRole(ctx, membership.organizationId, [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_MANAGER',
    ])
    if (membership.role !== 'AGENT')
      throw new Error('MEMBERSHIP_AGENT_REQUIRED')

    const supervisorId = args.supervisorId
    if (supervisorId) {
      const supervisor = await ctx.db
        .query('memberships')
        .withIndex('by_organization_user', query =>
          query.eq('organizationId', membership.organizationId).eq('userId', supervisorId))
        .unique()
      if (!supervisor?.isActive || supervisor.role !== 'SUPERVISOR')
        throw new Error('MEMBERSHIP_SUPERVISOR_INVALID')
    }

    await ctx.db.patch(args.membershipId, {
      supervisorId: args.supervisorId,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: membership.organizationId,
      actorId: userId,
      entityType: 'membership',
      entityId: args.membershipId,
      action: 'ASSIGN_SUPERVISOR',
      previousValue: { supervisorId: membership.supervisorId },
      newValue: { supervisorId: args.supervisorId },
    })

    return args.membershipId
  },
})

export const currentRole = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args): Promise<OrganizationRole> => {
    const { membership } = await requireOrganizationAccess(ctx, args.organizationId)
    return membership.role
  },
})
