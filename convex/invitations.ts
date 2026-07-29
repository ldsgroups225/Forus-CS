import type { Id } from './_generated/dataModel'
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

function identityText(identity: object, key: string) {
  const value = Reflect.get(identity, key)
  return typeof value === 'string' ? value : undefined
}

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    email: v.string(),
    role,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireRole(ctx, args.organizationId, ['ORGANIZATION_ADMIN'])
    const email = args.email.trim().toLocaleLowerCase()
    if (!email.includes('@'))
      throw new Error('INVITATION_EMAIL_INVALID')

    const existing = await ctx.db
      .query('invitations')
      .withIndex('by_organization_email', query =>
        query.eq('organizationId', args.organizationId).eq('email', email))
      .collect()
    const activeInvitation = existing.find(invitation =>
      invitation.status === 'PENDING' && invitation.expiresAt > Date.now())
    if (activeInvitation)
      return { invitationId: activeInvitation._id, code: activeInvitation.code }

    const now = Date.now()
    const code = crypto.randomUUID().replaceAll('-', '')
    const invitationId = await ctx.db.insert('invitations', {
      organizationId: args.organizationId,
      email,
      role: args.role,
      code,
      status: 'PENDING',
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      createdAt: now,
      invitedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'invitation',
      entityId: invitationId,
      action: 'CREATE',
      newValue: { email, role: args.role },
    })

    return { invitationId, code }
  },
})

export const list = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.organizationId, ['ORGANIZATION_ADMIN'])
    const invitations = await ctx.db
      .query('invitations')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()
    const now = Date.now()

    return invitations
      .map(invitation => ({
        ...invitation,
        effectiveStatus: invitation.status === 'PENDING' && invitation.expiresAt <= now
          ? 'EXPIRED' as const
          : invitation.status,
      }))
      .sort((left, right) => right.createdAt - left.createdAt)
  },
})

export const preview = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx)
    const invitation = await ctx.db
      .query('invitations')
      .withIndex('by_code', query => query.eq('code', args.code))
      .unique()
    if (!invitation)
      return null

    const organization = await ctx.db.get(invitation.organizationId)
    return {
      email: invitation.email,
      role: invitation.role,
      status: invitation.status === 'PENDING' && invitation.expiresAt <= Date.now()
        ? 'EXPIRED' as const
        : invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization?.name ?? 'Organisation indisponible',
    }
  },
})

export const accept = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, identity } = await requireAuthenticatedUser(ctx)
    const invitation = await ctx.db
      .query('invitations')
      .withIndex('by_code', query => query.eq('code', args.code))
      .unique()
    if (!invitation)
      throw new Error('INVITATION_NOT_FOUND')
    if (invitation.status !== 'PENDING')
      throw new Error('INVITATION_NOT_PENDING')
    if (invitation.expiresAt <= Date.now())
      throw new Error('INVITATION_EXPIRED')

    const authenticatedEmail = identityText(identity, 'email')?.toLocaleLowerCase()
    if (!authenticatedEmail || authenticatedEmail !== invitation.email)
      throw new Error('INVITATION_EMAIL_MISMATCH')

    const existing = await ctx.db
      .query('memberships')
      .withIndex('by_organization_user', query =>
        query.eq('organizationId', invitation.organizationId).eq('userId', userId))
      .unique()
    const now = Date.now()
    const membershipValues = {
      email: authenticatedEmail,
      displayName: identityText(identity, 'name'),
      role: invitation.role,
      isActive: true,
      updatedAt: now,
      updatedBy: userId,
    }
    let membershipId: Id<'memberships'>

    if (existing) {
      membershipId = existing._id
      await ctx.db.patch(existing._id, membershipValues)
    }
    else {
      membershipId = await ctx.db.insert('memberships', {
        organizationId: invitation.organizationId,
        userId,
        createdAt: now,
        ...membershipValues,
      })
    }

    await ctx.db.patch(invitation._id, {
      status: 'ACCEPTED',
      acceptedAt: now,
      acceptedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: invitation.organizationId,
      actorId: userId,
      entityType: 'invitation',
      entityId: invitation._id,
      action: 'ACCEPT',
      newValue: { membershipId, role: invitation.role },
    })

    const organization = await ctx.db.get(invitation.organizationId)
    return { membershipId, slug: organization?.slug ?? '' }
  },
})

export const revoke = mutation({
  args: {
    invitationId: v.id('invitations'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation)
      throw new Error('INVITATION_NOT_FOUND')

    await requireRole(ctx, invitation.organizationId, ['ORGANIZATION_ADMIN'])
    if (invitation.status !== 'PENDING')
      throw new Error('INVITATION_NOT_PENDING')

    await ctx.db.patch(args.invitationId, { status: 'REVOKED' })
    await writeAuditLog(ctx, {
      organizationId: invitation.organizationId,
      actorId: userId,
      entityType: 'invitation',
      entityId: args.invitationId,
      action: 'REVOKE',
    })

    return args.invitationId
  },
})

export const canAccessOrganization = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    return true
  },
})
