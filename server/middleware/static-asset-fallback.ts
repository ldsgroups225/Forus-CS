import { createError, getRequestURL } from 'h3'

export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event)

  if (!pathname.startsWith('/_nuxt/'))
    return

  throw createError({
    statusCode: 404,
    statusMessage: 'Static asset not found',
  })
})
