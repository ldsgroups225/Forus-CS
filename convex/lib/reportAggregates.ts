import type { DataModel, Id } from '../_generated/dataModel'
import { TableAggregate } from '@convex-dev/aggregate'
import { components } from '../_generated/api'

export const callsByOrganization = new TableAggregate<{
  Namespace: Id<'organizations'>
  Key: number
  DataModel: DataModel
  TableName: 'callLogs'
}>(components.callsByOrganization, {
  namespace: call => call.organizationId,
  sortKey: call => call.calledAt,
  sumValue: call => call.outcome === 'NO_ANSWER' ? 0 : 1,
})

export const availableCallsByOrganization = new TableAggregate<{
  Namespace: Id<'organizations'>
  Key: number
  DataModel: DataModel
  TableName: 'callLogs'
}>(components.availableCallsByOrganization, {
  namespace: call => call.organizationId,
  sortKey: call => call.calledAt,
  sumValue: call => call.outcome === 'AVAILABLE' ? 1 : 0,
})

export const callsByAgent = new TableAggregate<{
  Namespace: string
  Key: number
  DataModel: DataModel
  TableName: 'callLogs'
}>(components.callsByAgent, {
  namespace: call => `${call.organizationId}:${call.createdBy}`,
  sortKey: call => call.calledAt,
  sumValue: call => call.outcome === 'NO_ANSWER' ? 0 : 1,
})

export function agentNamespace(organizationId: Id<'organizations'>, userId: string) {
  return `${organizationId}:${userId}`
}

export async function insertCallIntoReports(ctx: Parameters<typeof callsByOrganization.insertIfDoesNotExist>[0], call: DataModel['callLogs']['document']) {
  await Promise.all([
    callsByOrganization.insertIfDoesNotExist(ctx, call),
    availableCallsByOrganization.insertIfDoesNotExist(ctx, call),
    callsByAgent.insertIfDoesNotExist(ctx, call),
  ])
}
