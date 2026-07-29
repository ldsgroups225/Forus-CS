import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

interface NotificationInput {
  organizationId: Id<'organizations'>
  userId: string
  kind: string
  title: string
  body: string
  href?: string
}

export async function createNotification(
  ctx: MutationCtx,
  input: NotificationInput,
) {
  return await ctx.db.insert('notifications', {
    ...input,
    isRead: false,
    createdAt: Date.now(),
  })
}

export async function notifyOrganizationRoles(
  ctx: MutationCtx,
  input: Omit<NotificationInput, 'userId'> & {
    roles: readonly string[]
    excludeUserId?: string
  },
) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_organization', query =>
      query.eq('organizationId', input.organizationId))
    .collect()

  await Promise.all(
    memberships
      .filter(membership =>
        membership.isActive
        && input.roles.includes(membership.role)
        && membership.userId !== input.excludeUserId)
      .map(membership => createNotification(ctx, {
        organizationId: input.organizationId,
        userId: membership.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
      })),
  )
}
