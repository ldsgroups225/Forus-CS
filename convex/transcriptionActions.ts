'use node'

import process from 'node:process'
import { ActionCache } from '@convex-dev/action-cache'
import { NonRetryableError } from '@convex-dev/workpool'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { internalAction } from './_generated/server'

const allowedMimeTypes = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
])

const transcriptionCache = new ActionCache(components.actionCache, {
  action: internal.transcriptionActions.invokeGroq,
  name: 'forus-transcription-v1',
  ttl: 1000 * 60 * 60 * 24 * 30,
})

export const processTranscription = internalAction({
  args: {
    jobId: v.id('transcriptionJobs'),
    organizationId: v.id('organizations'),
    audioHash: v.string(),
    model: v.string(),
    language: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.transcriptions.markProcessing, { jobId: args.jobId })
    const result = await transcriptionCache.fetch(ctx, {
      organizationId: args.organizationId,
      audioHash: args.audioHash,
      model: args.model,
      language: args.language,
    })
    await ctx.runMutation(internal.transcriptions.markCompleted, {
      jobId: args.jobId,
      text: result.text,
      duration: result.duration,
    })
    return null
  },
})

export const invokeGroq = internalAction({
  args: {
    organizationId: v.id('organizations'),
    audioHash: v.string(),
    model: v.string(),
    language: v.string(),
  },
  returns: v.object({
    text: v.string(),
    duration: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(internal.transcriptions.getSourceForHash, {
      organizationId: args.organizationId,
      audioHash: args.audioHash,
    })
    if (!source?.storageId)
      throw new NonRetryableError('TRANSCRIPTION_SOURCE_NOT_FOUND')
    if (!allowedMimeTypes.has(source.mimeType))
      throw new NonRetryableError('TRANSCRIPTION_MIME_UNSUPPORTED')

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey)
      throw new NonRetryableError('GROQ_API_KEY_MISSING')
    const url = await ctx.storage.getUrl(source.storageId)
    if (!url)
      throw new NonRetryableError('TRANSCRIPTION_SOURCE_MISSING')

    const response = await fetch(url)
    if (!response.ok)
      throw new Error('TRANSCRIPTION_STORAGE_FETCH_FAILED')
    const audio = await response.blob()
    const form = new FormData()
    form.append('file', audio, `calling-note.${source.mimeType.includes('mp4') ? 'mp4' : 'webm'}`)
    form.append('model', args.model)
    form.append('response_format', 'verbose_json')
    form.append('temperature', '0')
    form.append('language', args.language)

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!groqResponse.ok) {
      if (groqResponse.status >= 400 && groqResponse.status < 500 && groqResponse.status !== 429)
        throw new NonRetryableError('GROQ_TRANSCRIPTION_REJECTED')
      throw new Error('GROQ_TRANSCRIPTION_FAILED')
    }

    const result = await groqResponse.json() as { text?: string, duration?: number }
    return {
      text: result.text?.trim() ?? '',
      duration: result.duration,
    }
  },
})
