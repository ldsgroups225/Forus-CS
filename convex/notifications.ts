import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireAuthenticatedUser, requireOrganizationAccess } from './lib/authz'
import { createNotification } from './lib/notifications'

export const listCurrent = query({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user', query => query.eq('userId', userId))
      .order('desc')
      .take(Math.min(Math.max(args.limit ?? 20, 1), 100))

    return notifications.filter(notification =>
      notification.organizationId === args.organizationId)
  },
})

export const unreadCount = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', query =>
        query.eq('userId', userId).eq('isRead', false))
      .collect()

    return unread.filter(notification =>
      notification.organizationId === args.organizationId).length
  },
})

export const markRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const notification = await ctx.db.get(args.notificationId)
    if (!notification || notification.userId !== userId)
      throw new Error('NOTIFICATION_NOT_FOUND')

    await requireOrganizationAccess(ctx, notification.organizationId)
    if (!notification.isRead) {
      await ctx.db.patch(args.notificationId, {
        isRead: true,
        readAt: Date.now(),
      })
    }

    return args.notificationId
  },
})

export const markAllRead = mutation({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', query =>
        query.eq('userId', userId).eq('isRead', false))
      .collect()
    const organizationNotifications = unread.filter(notification =>
      notification.organizationId === args.organizationId)
    const now = Date.now()

    await Promise.all(organizationNotifications.map(notification =>
      ctx.db.patch(notification._id, { isRead: true, readAt: now })))

    return organizationNotifications.length
  },
})

export const sendDueFollowUpReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const dueFollowUps = await ctx.db
      .query('followUps')
      .filter(query =>
        query.and(
          query.eq(query.field('status'), 'PENDING'),
          query.lte(query.field('dueAt'), Date.now()),
          query.eq(query.field('reminderSentAt'), undefined),
        ))
      .take(100)
    const now = Date.now()
    for (const followUp of dueFollowUps) {
      await createNotification(ctx, {
        organizationId: followUp.organizationId,
        userId: followUp.assignedTo,
        kind: 'FOLLOW_UP_DUE',
        title: 'Relance à effectuer',
        body: followUp.notes,
        href: '/operations/transporteurs',
      })
      await ctx.db.patch(followUp._id, { reminderSentAt: now })
    }

    return dueFollowUps.length
  },
})
