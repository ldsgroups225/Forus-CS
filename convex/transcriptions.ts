import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { vOnCompleteArgs, Workpool } from '@convex-dev/workpool'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { requireAuthenticatedUser, requireOrganizationAccess } from './lib/authz'

const transcriptionPool = new Workpool(components.transcriptionWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
})

const rateLimiter = new RateLimiter(components.rateLimiter, {
  transcriptionPerUser: { kind: 'token bucket', rate: 6, period: MINUTE, capacity: 2 },
  transcriptionPerOrganization: { kind: 'fixed window', rate: 120, period: HOUR },
})

const jobStatus = v.union(
  v.literal('UPLOADING'),
  v.literal('QUEUED'),
  v.literal('PROCESSING'),
  v.literal('COMPLETED'),
  v.literal('FAILED'),
  v.literal('RATE_LIMITED'),
)

export const requestUpload = mutation({
  args: {
    organizationId: v.id('organizations'),
    audioHash: v.string(),
    mimeType: v.string(),
  },
  returns: v.object({
    jobId: v.optional(v.id('transcriptionJobs')),
    uploadUrl: v.optional(v.string()),
    retryAfter: v.optional(v.number()),
    text: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    await requireOrganizationAccess(ctx, args.organizationId)
    if (!/^[a-f0-9]{64}$/.test(args.audioHash))
      throw new Error('TRANSCRIPTION_HASH_INVALID')

    const existing = await ctx.db
      .query('transcriptionJobs')
      .withIndex('by_organization_hash', q => q.eq('organizationId', args.organizationId).eq('audioHash', args.audioHash))
      .order('desc')
      .first()
    if (existing?.status === 'COMPLETED')
      return { jobId: existing._id, text: existing.text }

    const [userLimit, organizationLimit] = await Promise.all([
      rateLimiter.limit(ctx, 'transcriptionPerUser', { key: userId }),
      rateLimiter.limit(ctx, 'transcriptionPerOrganization', { key: args.organizationId }),
    ])
    const retryAfter = Math.max(userLimit.retryAfter ?? 0, organizationLimit.retryAfter ?? 0)
    if (!userLimit.ok || !organizationLimit.ok)
      return { retryAfter }

    const now = Date.now()
    const jobId = await ctx.db.insert('transcriptionJobs', {
      organizationId: args.organizationId,
      createdBy: userId,
      audioHash: args.audioHash,
      mimeType: args.mimeType,
      model: 'whisper-large-v3',
      language: 'fr',
      status: 'UPLOADING',
      createdAt: now,
      updatedAt: now,
    })
    return { jobId, uploadUrl: await ctx.storage.generateUploadUrl() }
  },
})

export const finalizeUpload = mutation({
  args: { jobId: v.id('transcriptionJobs'), storageId: v.id('_storage') },
  returns: v.id('transcriptionJobs'),
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx)
    const job = await ctx.db.get(args.jobId)
    if (!job || job.createdBy !== userId)
      throw new Error('TRANSCRIPTION_JOB_NOT_FOUND')
    await requireOrganizationAccess(ctx, job.organizationId)
    if (job.status !== 'UPLOADING')
      return job._id

    const workId = await transcriptionPool.enqueueAction(ctx, internal.transcriptionActions.processTranscription, {
      jobId: job._id,
      organizationId: job.organizationId,
      audioHash: job.audioHash,
      model: job.model,
      language: job.language,
    }, {
      onComplete: internal.transcriptions.onTranscriptionComplete,
      context: { jobId: job._id },
    })
    await ctx.db.patch(job._id, {
      storageId: args.storageId,
      workId,
      status: 'QUEUED',
      updatedAt: Date.now(),
    })
    return job._id
  },
})

export const get = query({
  args: { jobId: v.id('transcriptionJobs') },
  returns: v.union(v.null(), v.object({
    _id: v.id('transcriptionJobs'),
    status: jobStatus,
    text: v.optional(v.string()),
    duration: v.optional(v.number()),
    retryAfter: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    updatedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job)
      return null
    await requireOrganizationAccess(ctx, job.organizationId)
    return {
      _id: job._id,
      status: job.status,
      text: job.text,
      duration: job.duration,
      retryAfter: job.retryAfter,
      errorCode: job.errorCode,
      updatedAt: job.updatedAt,
    }
  },
})

export const getSourceForHash = internalQuery({
  args: { organizationId: v.id('organizations'), audioHash: v.string() },
  returns: v.union(v.null(), v.object({ storageId: v.optional(v.id('_storage')), mimeType: v.string() })),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query('transcriptionJobs')
      .withIndex('by_organization_hash', q => q.eq('organizationId', args.organizationId).eq('audioHash', args.audioHash))
      .order('desc')
      .take(10)
    const job = jobs.find(candidate => candidate.storageId && candidate.status !== 'COMPLETED')
      ?? jobs.find(candidate => candidate.storageId)
    return job ? { storageId: job.storageId, mimeType: job.mimeType } : null
  },
})

export const markProcessing = internalMutation({
  args: { jobId: v.id('transcriptionJobs') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (job && job.status === 'QUEUED')
      await ctx.db.patch(job._id, { status: 'PROCESSING', updatedAt: Date.now() })
    return null
  },
})

export const markCompleted = internalMutation({
  args: { jobId: v.id('transcriptionJobs'), text: v.string(), duration: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status === 'COMPLETED')
      return null
    if (job.storageId)
      await ctx.storage.delete(job.storageId)
    await ctx.db.patch(job._id, {
      storageId: undefined,
      status: 'COMPLETED',
      text: args.text,
      duration: args.duration,
      errorCode: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const onTranscriptionComplete = internalMutation({
  args: vOnCompleteArgs(v.object({ jobId: v.id('transcriptionJobs') })),
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind !== 'failed')
      return null
    const job = await ctx.db.get(args.context.jobId)
    if (!job || job.status === 'COMPLETED')
      return null
    if (job.storageId)
      await ctx.storage.delete(job.storageId)
    await ctx.db.patch(job._id, {
      storageId: undefined,
      status: 'FAILED',
      errorCode: 'TRANSCRIPTION_FAILED',
      updatedAt: Date.now(),
    })
    return null
  },
})
