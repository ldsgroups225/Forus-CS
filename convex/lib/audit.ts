import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

interface AuditInput {
  organizationId: Id<'organizations'>
  actorId: string
  entityType: string
  entityId: string
  action: string
  previousValue?: unknown
  newValue?: unknown
}

export async function writeAuditLog(ctx: MutationCtx, input: AuditInput) {
  await ctx.db.insert('auditLogs', {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    previousValue: input.previousValue === undefined ? undefined : JSON.stringify(input.previousValue),
    newValue: input.newValue === undefined ? undefined : JSON.stringify(input.newValue),
    createdAt: Date.now(),
  })
}
