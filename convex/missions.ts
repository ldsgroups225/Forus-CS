import type { MissionStatus } from '../shared/domain'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { assertMissionTransition, missionProgress } from '../shared/missionWorkflow'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { createNotification, notifyOrganizationRoles } from './lib/notifications'

const missionStatus = v.union(
  v.literal('CONFIRMED'),
  v.literal('MOBILIZING'),
  v.literal('LOADING'),
  v.literal('IN_TRANSIT'),
  v.literal('DELIVERED'),
  v.literal('COMPLETED'),
  v.literal('CANCELLED'),
)

const managementRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
] as const

async function enrichMission(
  ctx: Pick<QueryCtx, 'db'>,
  mission: Doc<'missions'>,
) {
  const need = await ctx.db.get(mission.needId)
  if (!need)
    throw new Error('NEED_NOT_FOUND')

  const client = await ctx.db.get(need.clientId)
  const [events, incidents] = await Promise.all([
    ctx.db
      .query('missionEvents')
      .withIndex('by_mission', query => query.eq('missionId', mission._id))
      .collect(),
    ctx.db
      .query('incidents')
      .withIndex('by_mission', query => query.eq('missionId', mission._id))
      .collect(),
  ])

  return {
    ...mission,
    needReference: need.reference,
    needStatus: need.status,
    clientName: client?.name ?? 'Client inconnu',
    progress: missionProgress(mission.status),
    events: events.sort((left, right) => right.createdAt - left.createdAt),
    incidentCount: incidents.filter(incident =>
      incident.status === 'OPEN' || incident.status === 'IN_PROGRESS').length,
  }
}

async function appendMissionEvent(
  ctx: MutationCtx,
  input: {
    organizationId: Parameters<typeof requireOrganizationAccess>[1]
    missionId: Id<'missions'>
    status: MissionStatus
    userId: string
    note?: string
    location?: string
  },
) {
  return await ctx.db.insert('missionEvents', {
    organizationId: input.organizationId,
    missionId: input.missionId,
    status: input.status,
    note: input.note,
    location: input.location,
    createdAt: Date.now(),
    createdBy: input.userId,
  })
}

export const getById = query({
  args: {
    missionId: v.id('missions'),
  },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get(args.missionId)
    if (!mission)
      return null

    await requireOrganizationAccess(ctx, mission.organizationId)
    return await enrichMission(ctx, mission)
  },
})

export const listForOrganization = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const missions = await ctx.db
      .query('missions')
      .withIndex('by_organization', query => query.eq('organizationId', args.organizationId))
      .collect()

    return await Promise.all(
      missions
        .sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt)
        .map(mission => enrichMission(ctx, mission)),
    )
  },
})

export const updateStatus = mutation({
  args: {
    missionId: v.id('missions'),
    status: missionStatus,
    note: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const mission = await ctx.db.get(args.missionId)
    if (!mission)
      throw new Error('MISSION_NOT_FOUND')

    await requireRole(ctx, mission.organizationId, managementRoles)
    assertMissionTransition(mission.status, args.status)
    const note = args.note?.trim() || undefined
    const location = args.location?.trim() || undefined
    const now = Date.now()
    const lifecycle = {
      startedAt: args.status === 'MOBILIZING' ? now : mission.startedAt,
      deliveredAt: args.status === 'DELIVERED' ? now : mission.deliveredAt,
      completedAt: args.status === 'COMPLETED' ? now : mission.completedAt,
      cancelledAt: args.status === 'CANCELLED' ? now : mission.cancelledAt,
    }

    await ctx.db.patch(args.missionId, {
      status: args.status,
      lastUpdatedAt: now,
      ...lifecycle,
    })
    await appendMissionEvent(ctx, {
      organizationId: mission.organizationId,
      missionId: args.missionId,
      status: args.status,
      userId,
      note,
      location,
    })
    await writeAuditLog(ctx, {
      organizationId: mission.organizationId,
      actorId: userId,
      entityType: 'mission',
      entityId: args.missionId,
      action: 'UPDATE_STATUS',
      previousValue: { status: mission.status },
      newValue: { status: args.status, note, location },
    })

    if (mission.assignedTo && mission.assignedTo !== userId) {
      await createNotification(ctx, {
        organizationId: mission.organizationId,
        userId: mission.assignedTo,
        kind: 'MISSION_STATUS',
        title: `Mission ${mission.reference}`,
        body: `Le statut de la mission a été mis à jour.`,
        href: `/operations/missions`,
      })
    }
    if (args.status === 'DELIVERED' || args.status === 'CANCELLED') {
      await notifyOrganizationRoles(ctx, {
        organizationId: mission.organizationId,
        roles: ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'],
        excludeUserId: userId,
        kind: 'MISSION_ALERT',
        title: `Mission ${mission.reference}`,
        body: args.status === 'DELIVERED'
          ? 'La livraison est déclarée effectuée.'
          : 'La mission a été annulée.',
        href: `/operations/missions`,
      })
    }

    return args.missionId
  },
})

export const assignAgent = mutation({
  args: {
    missionId: v.id('missions'),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const mission = await ctx.db.get(args.missionId)
    if (!mission)
      throw new Error('MISSION_NOT_FOUND')

    await requireRole(ctx, mission.organizationId, managementRoles)
    const agentId = args.agentId
    if (agentId) {
      const assignee = await ctx.db
        .query('memberships')
        .withIndex('by_organization_user', query =>
          query.eq('organizationId', mission.organizationId).eq('userId', agentId))
        .unique()
      if (!assignee?.isActive)
        throw new Error('MISSION_ASSIGNEE_INVALID')
    }

    await ctx.db.patch(args.missionId, {
      assignedTo: args.agentId,
      lastUpdatedAt: Date.now(),
    })
    await writeAuditLog(ctx, {
      organizationId: mission.organizationId,
      actorId: userId,
      entityType: 'mission',
      entityId: args.missionId,
      action: 'ASSIGN',
      previousValue: { assignedTo: mission.assignedTo },
      newValue: { assignedTo: args.agentId },
    })
    if (agentId) {
      await createNotification(ctx, {
        organizationId: mission.organizationId,
        userId: agentId,
        kind: 'MISSION_ASSIGNED',
        title: `Mission ${mission.reference}`,
        body: 'Cette mission vous a été affectée.',
        href: `/operations/missions`,
      })
    }

    return args.missionId
  },
})
