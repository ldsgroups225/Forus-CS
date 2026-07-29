import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { assertIncidentTransition } from '../shared/incidentWorkflow'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser, requireOrganizationAccess, requireRole } from './lib/authz'
import { findIdempotentResult, recordIdempotentResult } from './lib/idempotency'
import { createNotification, notifyOrganizationRoles } from './lib/notifications'
import { generateWorkflowReference } from './lib/workflow'

const incidentSeverity = v.union(
  v.literal('LOW'),
  v.literal('MEDIUM'),
  v.literal('HIGH'),
  v.literal('CRITICAL'),
)

const incidentStatus = v.union(
  v.literal('OPEN'),
  v.literal('IN_PROGRESS'),
  v.literal('RESOLVED'),
  v.literal('CLOSED'),
)

const managementRoles = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPERVISOR',
] as const

async function enrichIncident(
  ctx: Pick<QueryCtx, 'db'>,
  incident: Doc<'incidents'>,
) {
  const [need, mission] = await Promise.all([
    incident.needId ? ctx.db.get(incident.needId) : null,
    incident.missionId ? ctx.db.get(incident.missionId) : null,
  ])

  return {
    ...incident,
    needReference: need?.reference,
    missionReference: mission?.reference,
  }
}

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    needId: v.optional(v.id('needs')),
    missionId: v.optional(v.id('missions')),
    title: v.string(),
    description: v.string(),
    severity: incidentSeverity,
    assignedTo: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    const receipt = await findIdempotentResult(ctx, args.organizationId, args.idempotencyKey)
    if (receipt?.resultId)
      return receipt.resultId

    const title = args.title.trim()
    const description = args.description.trim()
    if (title.length < 3)
      throw new Error('INCIDENT_TITLE_INVALID')
    if (description.length < 5)
      throw new Error('INCIDENT_DESCRIPTION_INVALID')

    if (args.needId) {
      const need = await ctx.db.get(args.needId)
      if (!need || need.organizationId !== args.organizationId)
        throw new Error('INCIDENT_NEED_INVALID')
    }
    if (args.missionId) {
      const mission = await ctx.db.get(args.missionId)
      if (!mission || mission.organizationId !== args.organizationId)
        throw new Error('INCIDENT_MISSION_INVALID')
      if (args.needId && mission.needId !== args.needId)
        throw new Error('INCIDENT_RELATION_MISMATCH')
    }
    const assignedTo = args.assignedTo
    if (assignedTo) {
      const assignee = await ctx.db
        .query('memberships')
        .withIndex('by_organization_user', query =>
          query.eq('organizationId', args.organizationId).eq('userId', assignedTo))
        .unique()
      if (!assignee?.isActive)
        throw new Error('INCIDENT_ASSIGNEE_INVALID')
    }

    const now = Date.now()
    const reference = await generateWorkflowReference(
      ctx,
      args.organizationId,
      'INCIDENT',
      new Date(now),
    )
    const incidentId = await ctx.db.insert('incidents', {
      organizationId: args.organizationId,
      reference,
      needId: args.needId,
      missionId: args.missionId,
      title,
      description,
      severity: args.severity,
      status: 'OPEN',
      assignedTo,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    })
    await recordIdempotentResult(ctx, {
      organizationId: args.organizationId,
      key: args.idempotencyKey,
      operation: 'incidents.create',
      resultId: incidentId,
    })
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      entityType: 'incident',
      entityId: incidentId,
      action: 'CREATE',
      newValue: { reference, title, severity: args.severity },
    })
    await notifyOrganizationRoles(ctx, {
      organizationId: args.organizationId,
      roles: ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER', 'SUPERVISOR'],
      excludeUserId: userId,
      kind: 'INCIDENT_CREATED',
      title: `${reference} · ${title}`,
      body: `Un incident ${args.severity.toLocaleLowerCase()} a été déclaré.`,
      href: '/operations/incidents',
    })
    if (assignedTo && assignedTo !== userId) {
      await createNotification(ctx, {
        organizationId: args.organizationId,
        userId: assignedTo,
        kind: 'INCIDENT_ASSIGNED',
        title: `${reference} vous est affecté`,
        body: title,
        href: '/operations/incidents',
      })
    }

    return incidentId
  },
})

export const updateStatus = mutation({
  args: {
    incidentId: v.id('incidents'),
    status: incidentStatus,
    resolution: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const incident = await ctx.db.get(args.incidentId)
    if (!incident)
      throw new Error('INCIDENT_NOT_FOUND')

    await requireRole(ctx, incident.organizationId, managementRoles)
    assertIncidentTransition(incident.status, args.status)
    const resolution = args.resolution?.trim() || undefined
    if ((args.status === 'RESOLVED' || args.status === 'CLOSED') && !resolution)
      throw new Error('INCIDENT_RESOLUTION_REQUIRED')

    const assignedTo = args.assignedTo ?? incident.assignedTo
    if (assignedTo) {
      const assignee = await ctx.db
        .query('memberships')
        .withIndex('by_organization_user', query =>
          query.eq('organizationId', incident.organizationId).eq('userId', assignedTo))
        .unique()
      if (!assignee?.isActive)
        throw new Error('INCIDENT_ASSIGNEE_INVALID')
    }

    const now = Date.now()
    await ctx.db.patch(args.incidentId, {
      status: args.status,
      assignedTo,
      resolution,
      resolvedAt: args.status === 'RESOLVED' || args.status === 'CLOSED'
        ? now
        : undefined,
      updatedAt: now,
      updatedBy: userId,
    })
    await writeAuditLog(ctx, {
      organizationId: incident.organizationId,
      actorId: userId,
      entityType: 'incident',
      entityId: args.incidentId,
      action: 'UPDATE_STATUS',
      previousValue: { status: incident.status, assignedTo: incident.assignedTo },
      newValue: { status: args.status, assignedTo, resolution },
    })
    if (assignedTo && assignedTo !== userId) {
      await createNotification(ctx, {
        organizationId: incident.organizationId,
        userId: assignedTo,
        kind: 'INCIDENT_STATUS',
        title: `Incident ${incident.reference}`,
        body: 'Le statut de l’incident a été mis à jour.',
        href: '/operations/incidents',
      })
    }

    return args.incidentId
  },
})

export const getById = query({
  args: {
    incidentId: v.id('incidents'),
  },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId)
    if (!incident)
      return null

    await requireOrganizationAccess(ctx, incident.organizationId)
    return await enrichIncident(ctx, incident)
  },
})

export const list = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const incidents = await ctx.db
      .query('incidents')
      .withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId))
      .order('desc')
      .collect()

    return await Promise.all(incidents.map(incident => enrichIncident(ctx, incident)))
  },
})
