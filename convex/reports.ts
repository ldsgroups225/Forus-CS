import { v } from 'convex/values'
import { calculateAgentPerformance, estimatePerformanceBonus } from '../shared/performanceScore'
import { query } from './_generated/server'
import { requireOrganizationAccess } from './lib/authz'
import { agentNamespace, availableCallsByOrganization, callsByAgent, callsByOrganization } from './lib/reportAggregates'

function timeBounds(from: number, to: number) {
  return {
    lower: { key: from, inclusive: true },
    upper: { key: to, inclusive: true },
  }
}

export const overview = query({
  args: {
    organizationId: v.id('organizations'),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const from = args.from ?? 0
    const to = args.to ?? Number.MAX_SAFE_INTEGER
    const [needs, missions, incidents, followUps, carriers, memberships, callTotal, answeredCalls, availableCalls] = await Promise.all([
      ctx.db.query('needs').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('missions').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('incidents').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('followUps').withIndex('by_organization_due', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('carriers').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('memberships').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      callsByOrganization.count(ctx, { namespace: args.organizationId, bounds: timeBounds(from, to) }),
      callsByOrganization.sum(ctx, { namespace: args.organizationId, bounds: timeBounds(from, to) }),
      availableCallsByOrganization.sum(ctx, { namespace: args.organizationId, bounds: timeBounds(from, to) }),
    ])
    const inRange = (timestamp: number) => timestamp >= from && timestamp <= to
    const rangedNeeds = needs.filter(need => inRange(need.createdAt))
    const rangedMissions = missions.filter(mission => inRange(mission.createdAt))
    const rangedIncidents = incidents.filter(incident => inRange(incident.createdAt))

    return {
      needs: {
        total: rangedNeeds.length,
        active: rangedNeeds.filter(need =>
          need.status === 'OPEN' || need.status === 'PARTIAL').length,
        satisfied: rangedNeeds.filter(need => need.status === 'SATISFIED').length,
        cancelled: rangedNeeds.filter(need => need.status === 'CANCELLED').length,
        requestedTrucks: rangedNeeds.reduce((total, need) =>
          total + need.requestedTruckCount, 0),
        approvedTrucks: rangedNeeds.reduce((total, need) =>
          total + need.approvedTruckCount, 0),
      },
      missions: {
        total: rangedMissions.length,
        completed: rangedMissions.filter(mission => mission.status === 'COMPLETED').length,
        inProgress: rangedMissions.filter(mission =>
          !['COMPLETED', 'CANCELLED'].includes(mission.status)).length,
        totalValue: rangedMissions.reduce((total, mission) => total + mission.totalPrice, 0),
      },
      incidents: {
        total: rangedIncidents.length,
        open: rangedIncidents.filter(incident =>
          incident.status === 'OPEN' || incident.status === 'IN_PROGRESS').length,
        critical: rangedIncidents.filter(incident => incident.severity === 'CRITICAL').length,
      },
      calls: {
        total: callTotal,
        available: availableCalls,
        answerRate: callTotal === 0
          ? 0
          : Math.round(
              answeredCalls / callTotal * 100,
            ),
      },
      pendingFollowUps: followUps.filter(followUp => followUp.status === 'PENDING').length,
      activeCarriers: carriers.filter(carrier => carrier.isActive).length,
      activeMembers: memberships.filter(membership => membership.isActive).length,
    }
  },
})

function countWorkingDays(from: number, to: number) {
  let count = 0
  const firstDay = new Date(from)
  firstDay.setUTCHours(0, 0, 0, 0)
  const lastDay = new Date(to)
  lastDay.setUTCHours(23, 59, 59, 999)
  let cursor = firstDay.getTime()

  while (cursor <= lastDay.getTime()) {
    const day = new Date(cursor)
    if (day.getUTCDay() !== 0)
      count += 1
    cursor += 24 * 60 * 60 * 1000
  }

  return Math.max(1, count)
}

export const agentPerformance = query({
  args: {
    organizationId: v.id('organizations'),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const [memberships, carriers, options, followUps, settings] = await Promise.all([
      ctx.db.query('memberships').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('carriers').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('carrierOptions').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('followUps').withIndex('by_organization_due', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('organizationSettings').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).unique(),
    ])
    const workingDays = countWorkingDays(args.from, args.to)
    const inRange = (timestamp: number) =>
      timestamp >= args.from && timestamp <= args.to

    return await Promise.all(memberships
      .filter(membership => membership.role === 'AGENT' && membership.isActive)
      .map(async (membership) => {
        const [calls, answeredCalls] = await Promise.all([
          callsByAgent.count(ctx, {
            namespace: agentNamespace(args.organizationId, membership.userId),
            bounds: timeBounds(args.from, args.to),
          }),
          callsByAgent.sum(ctx, {
            namespace: agentNamespace(args.organizationId, membership.userId),
            bounds: timeBounds(args.from, args.to),
          }),
        ])
        const newCarriers = carriers.filter(carrier =>
          carrier.createdBy === membership.userId && inRange(carrier.createdAt)).length
        const submittedOptions = options.filter(option =>
          option.createdBy === membership.userId && inRange(option.createdAt)).length
        const completedFollowUps = followUps.filter(followUp =>
          followUp.assignedTo === membership.userId
          && followUp.status === 'COMPLETED'
          && followUp.completedAt !== undefined
          && inRange(followUp.completedAt)).length
        const responseRate = calls === 0
          ? 0
          : Math.round(answeredCalls / calls * 100)
        const score = calculateAgentPerformance({
          calls,
          workingDays,
          newCarriers,
          submittedOptions,
          completedFollowUps,
          responseRate,
        })

        return {
          userId: membership.userId,
          displayName: membership.displayName ?? membership.email ?? membership.userId,
          calls,
          responseRate,
          newCarriers,
          submittedOptions,
          completedFollowUps,
          score,
          baseStipend: settings?.agentBaseStipend ?? 50_000,
          estimatedBonus: estimatePerformanceBonus(
            score.total,
            settings?.maximumPerformanceBonus ?? 50_000,
          ),
          eligibility: 'TO_VALIDATE' as const,
        }
      }))
      .then(results => results.sort((left, right) => right.score.total - left.score.total))
  },
})
