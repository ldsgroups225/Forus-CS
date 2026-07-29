import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import {
  requireAuthenticatedUser,
  requireOrganizationAccess,
  requireRole,
} from './lib/authz'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const name = args.name.trim()
    const slug = args.slug.trim().toLowerCase()

    if (name.length < 2)
      throw new Error('ORGANIZATION_NAME_TOO_SHORT')

    if (!slugPattern.test(slug))
      throw new Error('ORGANIZATION_SLUG_INVALID')

    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_slug', query => query.eq('slug', slug))
      .unique()

    if (existing)
      throw new Error('ORGANIZATION_SLUG_TAKEN')

    const now = Date.now()
    const organizationId = await ctx.db.insert('organizations', {
      name,
      slug,
      isActive: true,
      createdAt: now,
      createdBy: userId,
    })

    await ctx.db.insert('memberships', {
      organizationId,
      userId,
      role: 'ORGANIZATION_ADMIN',
      isActive: true,
      createdAt: now,
    })

    await writeAuditLog(ctx, {
      organizationId,
      actorId: userId,
      entityType: 'organization',
      entityId: organizationId,
      action: 'CREATE',
      newValue: { name, slug },
    })

    return { organizationId, slug }
  },
})

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', query => query.eq('userId', userId))
      .collect()

    const organizations = await Promise.all(
      memberships
        .filter(membership => membership.isActive)
        .map(async (membership) => {
          const organization = await ctx.db.get(membership.organizationId)
          if (!organization?.isActive)
            return null

          return {
            ...organization,
            role: membership.role,
          }
        }),
    )

    return organizations.filter(organization => organization !== null)
  },
})

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query('organizations')
      .withIndex('by_slug', query => query.eq('slug', args.slug.toLowerCase()))
      .unique()

    if (!organization)
      return null

    const { membership } = await requireOrganizationAccess(ctx, organization._id)

    return {
      ...organization,
      role: membership.role,
    }
  },
})

export const getSettings = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const settings = await ctx.db
      .query('organizationSettings')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .unique()

    return settings ?? {
      organizationId: args.organizationId,
      timezone: 'Africa/Abidjan',
      currency: 'XOF',
      defaultCountryCode: '225',
      whatsappBusinessEnabled: false,
      agentBaseStipend: 50_000,
      maximumPerformanceBonus: 50_000,
      updatedAt: 0,
      updatedBy: '',
    }
  },
})

export const updateSettings = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    timezone: v.string(),
    currency: v.string(),
    defaultCountryCode: v.string(),
    whatsappBusinessEnabled: v.boolean(),
    agentBaseStipend: v.number(),
    maximumPerformanceBonus: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireRole(ctx, args.organizationId, ['ORGANIZATION_ADMIN'])
    const name = args.name.trim()
    const timezone = args.timezone.trim()
    const currency = args.currency.trim().toUpperCase()
    const defaultCountryCode = args.defaultCountryCode.replace(/\D/g, '')

    if (name.length < 2)
      throw new Error('ORGANIZATION_NAME_TOO_SHORT')
    if (!timezone.includes('/'))
      throw new Error('ORGANIZATION_TIMEZONE_INVALID')
    if (!/^[A-Z]{3}$/.test(currency))
      throw new Error('ORGANIZATION_CURRENCY_INVALID')
    if (defaultCountryCode.length < 1 || defaultCountryCode.length > 4)
      throw new Error('ORGANIZATION_COUNTRY_CODE_INVALID')
    if (args.agentBaseStipend < 0 || args.maximumPerformanceBonus < 0)
      throw new Error('ORGANIZATION_BONUS_INVALID')

    const organization = await ctx.db.get(args.organizationId)
    if (!organization)
      throw new Error('ORGANIZATION_NOT_FOUND')

    const now = Date.now()
    const settings = await ctx.db
      .query('organizationSettings')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .unique()
    const values = {
      organizationId: args.organizationId,
      timezone,
      currency,
      defaultCountryCode,
      whatsappBusinessEnabled: args.whatsappBusinessEnabled,
      agentBaseStipend: args.agentBaseStipend,
      maximumPerformanceBonus: args.maximumPerformanceBonus,
      updatedAt: now,
      updatedBy: userId,
    }

    await ctx.db.patch(args.organizationId, {
      name,
      updatedAt: now,
      updatedBy: userId,
    })
    if (settings)
      await ctx.db.patch(settings._id, values)
    else
      await ctx.db.insert('organizationSettings', values)

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'organization',
      entityId: args.organizationId,
      action: 'UPDATE_SETTINGS',
      previousValue: { name: organization.name, settings },
      newValue: { name, ...values },
    })

    return args.organizationId
  },
})
