import { v } from 'convex/values'
import { calculateAgentPerformance, estimatePerformanceBonus } from '../shared/performanceScore'
import { query } from './_generated/server'
import { requireOrganizationAccess } from './lib/authz'

export const overview = query({
  args: {
    organizationId: v.id('organizations'),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId)
    const [needs, missions, incidents, calls, followUps, carriers, memberships] = await Promise.all([
      ctx.db.query('needs').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('missions').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('incidents').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('callLogs').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('followUps').withIndex('by_organization_due', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('carriers').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('memberships').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
    ])
    const from = args.from ?? 0
    const to = args.to ?? Number.POSITIVE_INFINITY
    const inRange = (timestamp: number) => timestamp >= from && timestamp <= to
    const rangedNeeds = needs.filter(need => inRange(need.createdAt))
    const rangedMissions = missions.filter(mission => inRange(mission.createdAt))
    const rangedIncidents = incidents.filter(incident => inRange(incident.createdAt))
    const rangedCalls = calls.filter(call => inRange(call.calledAt))

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
        total: rangedCalls.length,
        available: rangedCalls.filter(call => call.outcome === 'AVAILABLE').length,
        answerRate: rangedCalls.length === 0
          ? 0
          : Math.round(
              rangedCalls.filter(call =>
                call.outcome !== 'NO_ANSWER').length / rangedCalls.length * 100,
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
    const [memberships, calls, carriers, options, followUps, settings] = await Promise.all([
      ctx.db.query('memberships').withIndex('by_organization', query =>
        query.eq('organizationId', args.organizationId)).collect(),
      ctx.db.query('callLogs').withIndex('by_organization', query =>
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

    return memberships
      .filter(membership => membership.role === 'AGENT' && membership.isActive)
      .map((membership) => {
        const agentCalls = calls.filter(call =>
          call.createdBy === membership.userId && inRange(call.calledAt))
        const answeredCalls = agentCalls.filter(call => call.outcome !== 'NO_ANSWER')
        const newCarriers = carriers.filter(carrier =>
          carrier.createdBy === membership.userId && inRange(carrier.createdAt)).length
        const submittedOptions = options.filter(option =>
          option.createdBy === membership.userId && inRange(option.createdAt)).length
        const completedFollowUps = followUps.filter(followUp =>
          followUp.assignedTo === membership.userId
          && followUp.status === 'COMPLETED'
          && followUp.completedAt !== undefined
          && inRange(followUp.completedAt)).length
        const responseRate = agentCalls.length === 0
          ? 0
          : Math.round(answeredCalls.length / agentCalls.length * 100)
        const score = calculateAgentPerformance({
          calls: agentCalls.length,
          workingDays,
          newCarriers,
          submittedOptions,
          completedFollowUps,
          responseRate,
        })

        return {
          userId: membership.userId,
          displayName: membership.displayName ?? membership.email ?? membership.userId,
          calls: agentCalls.length,
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
      })
      .sort((left, right) => right.score.total - left.score.total)
  },
})
