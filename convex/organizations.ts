import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import {
  requireAuthenticatedUser,
  requireOrganizationAccess,
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
