import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { findIdempotentResult, recordIdempotentResult } from './lib/idempotency'
import { NEED_WRITE_ROLES } from './lib/needs'

const clientFields = {
  name: v.string(),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
}

function normalizeClient(args: {
  name: string
  contactName?: string
  phone?: string
  email?: string
}) {
  const name = args.name.trim()
  const email = args.email?.trim().toLocaleLowerCase()

  if (name.length < 2)
    throw new Error('CLIENT_NAME_TOO_SHORT')
  if (email && !email.includes('@'))
    throw new Error('CLIENT_EMAIL_INVALID')

  return {
    name,
    contactName: args.contactName?.trim() || undefined,
    phone: args.phone?.trim() || undefined,
    email: email || undefined,
  }
}

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    idempotencyKey: v.optional(v.string()),
    ...clientFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireRole(ctx, args.organizationId, NEED_WRITE_ROLES)
    const receipt = await findIdempotentResult(ctx, args.organizationId, args.idempotencyKey)
    if (receipt?.resultId)
      return receipt.resultId as Id<'clients'>

    const input = normalizeClient(args)

    const duplicate = await ctx.db
      .query('clients')
      .withIndex('by_organization_name', query =>
        query.eq('organizationId', args.organizationId).eq('name', input.name))
      .unique()

    if (duplicate)
      return duplicate._id

    const now = Date.now()
    const clientId = await ctx.db.insert('clients', {
      organizationId: args.organizationId,
      ...input,
      isActive: true,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'client',
      entityId: clientId,
      action: 'CREATE',
      newValue: input,
    })
    await recordIdempotentResult(ctx, {
      organizationId: args.organizationId,
      key: args.idempotencyKey,
      operation: 'clients.create',
      resultId: clientId,
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

export const listAll = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return clients.sort((left, right) => left.name.localeCompare(right.name))
  },
})

export const getById = query({
  args: {
    clientId: v.id('clients'),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId)
    if (!client)
      return null

    await requireOrganizationAccess(ctx, client.organizationId)
    return client
  },
})

export const update = mutation({
  args: {
    clientId: v.id('clients'),
    ...clientFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const client = await ctx.db.get(args.clientId)
    if (!client)
      throw new Error('CLIENT_NOT_FOUND')

    await requireRole(ctx, client.organizationId, NEED_WRITE_ROLES)
    const input = normalizeClient(args)
    const duplicate = await ctx.db
      .query('clients')
      .withIndex('by_organization_name', query =>
        query.eq('organizationId', client.organizationId).eq('name', input.name))
      .unique()
    if (duplicate && duplicate._id !== args.clientId)
      throw new Error('CLIENT_NAME_TAKEN')

    const now = Date.now()
    await ctx.db.patch(args.clientId, {
      ...input,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: client.organizationId,
      actorId: userId,
      entityType: 'client',
      entityId: args.clientId,
      action: 'UPDATE',
      previousValue: client,
      newValue: input,
    })

    return args.clientId
  },
})

export const setActive = mutation({
  args: {
    clientId: v.id('clients'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const client = await ctx.db.get(args.clientId)
    if (!client)
      throw new Error('CLIENT_NOT_FOUND')

    await requireRole(ctx, client.organizationId, NEED_WRITE_ROLES)
    await ctx.db.patch(args.clientId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: client.organizationId,
      actorId: userId,
      entityType: 'client',
      entityId: args.clientId,
      action: args.isActive ? 'ACTIVATE' : 'DEACTIVATE',
      previousValue: { isActive: client.isActive },
      newValue: { isActive: args.isActive },
    })

    return args.clientId
  },
})
