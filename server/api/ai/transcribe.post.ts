import { ConvexHttpClient } from 'convex/browser'
import { createError, defineEventHandler, getHeader, readMultipartFormData } from 'h3'
import { api } from '../../../convex/_generated/api'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10
const allowedMimeTypes = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
])
const requestsByUser = new Map<string, number[]>()

function bearerToken(event: Parameters<typeof getHeader>[0]) {
  const header = getHeader(event, 'authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export default defineEventHandler(async (event) => {
  const token = bearerToken(event)
  const config = useRuntimeConfig()
  if (!token || !config.public.convexUrl)
    throw createError({ statusCode: 401, statusMessage: 'Authentification requise.' })

  const convex = new ConvexHttpClient(config.public.convexUrl)
  convex.setAuth(token)
  let user: Awaited<ReturnType<typeof convex.query<typeof api.auth.getCurrentUser>>>
  try {
    user = await convex.query(api.auth.getCurrentUser, {})
  }
  catch {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide.' })
  }
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Session invalide.' })

  const now = Date.now()
  const recentRequests = (requestsByUser.get(user._id) ?? []).filter(timestamp => timestamp > now - WINDOW_MS)
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW)
    throw createError({ statusCode: 429, statusMessage: 'Trop de transcriptions. Réessayez dans une minute.' })
  requestsByUser.set(user._id, [...recentRequests, now])

  if (!config.groqApiKey)
    throw createError({ statusCode: 503, statusMessage: 'La transcription audio n’est pas configurée.' })

  const parts = await readMultipartFormData(event)
  const audio = parts?.find(part => part.name === 'file' && part.data)
  if (!audio?.data)
    throw createError({ statusCode: 400, statusMessage: 'Fichier audio requis.' })
  if (audio.data.byteLength > MAX_AUDIO_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'Le fichier audio dépasse 25 Mo.' })

  const mimeType = audio.type?.toLowerCase() || 'audio/webm'
  if (!allowedMimeTypes.has(mimeType))
    throw createError({ statusCode: 415, statusMessage: 'Format audio non accepté.' })

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audio.data)], { type: mimeType }), audio.filename || 'calling-note.webm')
  form.append('model', 'whisper-large-v3')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  form.append('language', 'fr')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqApiKey}` },
    body: form,
  })
  if (!response.ok)
    throw createError({ statusCode: 502, statusMessage: 'La transcription audio a échoué.' })

  const transcription = await response.json() as { text?: string, duration?: number, language?: string }
  return {
    text: transcription.text?.trim() ?? '',
    duration: transcription.duration,
    language: transcription.language ?? 'fr',
  }
})
