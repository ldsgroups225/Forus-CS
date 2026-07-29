import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { NEED_WRITE_ROLES } from './lib/needs'

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireRole(ctx, args.organizationId, NEED_WRITE_ROLES)
    const name = args.name.trim()

    if (name.length < 2)
      throw new Error('CLIENT_NAME_TOO_SHORT')

    const duplicate = await ctx.db
      .query('clients')
      .withIndex('by_organization_name', query =>
        query.eq('organizationId', args.organizationId).eq('name', name))
      .unique()

    if (duplicate)
      return duplicate._id

    const clientId = await ctx.db.insert('clients', {
      organizationId: args.organizationId,
      name,
      contactName: args.contactName?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim().toLowerCase() || undefined,
      isActive: true,
      createdAt: Date.now(),
      createdBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'client',
      entityId: clientId,
      action: 'CREATE',
      newValue: { name },
    })

    return clientId
  },
})

export const list = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return clients
      .filter(client => client.isActive)
      .sort((left, right) => left.name.localeCompare(right.name))
  },
})
