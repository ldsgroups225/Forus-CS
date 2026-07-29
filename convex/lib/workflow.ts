import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  formatIncidentReference,
  formatMissionReference,
  formatOptionReference,
} from '../../shared/reference'

type WorkflowCounterKind = 'OPTION' | 'MISSION' | 'INCIDENT'

function utcDateKey(now: Date) {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export async function generateWorkflowReference(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  kind: WorkflowCounterKind,
  now: Date,
) {
  const dateKey = utcDateKey(now)
  const counter = await ctx.db
    .query('workflowCounters')
    .withIndex('by_organization_kind_date', query =>
      query
        .eq('organizationId', organizationId)
        .eq('kind', kind)
        .eq('dateKey', dateKey))
    .unique()

  const sequence = (counter?.sequence ?? 0) + 1
  const reference = {
    OPTION: formatOptionReference,
    MISSION: formatMissionReference,
    INCIDENT: formatIncidentReference,
  }[kind](now, sequence)

  const duplicate = kind === 'OPTION'
    ? await ctx.db
        .query('carrierOptions')
        .withIndex('by_organization_reference', query =>
          query.eq('organizationId', organizationId).eq('reference', reference))
        .unique()
    : kind === 'MISSION'
      ? await ctx.db
          .query('missions')
          .withIndex('by_organization_reference', query =>
            query.eq('organizationId', organizationId).eq('reference', reference))
          .unique()
      : await ctx.db
          .query('incidents')
          .withIndex('by_organization_reference', query =>
            query.eq('organizationId', organizationId).eq('reference', reference))
          .unique()

  if (duplicate)
    throw new Error('WORKFLOW_REFERENCE_CONFLICT')

  if (counter)
    await ctx.db.patch(counter._id, { sequence })
  else
    await ctx.db.insert('workflowCounters', { organizationId, kind, dateKey, sequence })

  return reference
}
