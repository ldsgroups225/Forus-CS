export function buildInvitationUrl(siteUrl: string | undefined, origin: string | undefined, code: string) {
  const encodedCode = encodeURIComponent(code)
  const baseUrl = siteUrl?.trim() || origin?.trim()

  if (!baseUrl)
    return `/invite/${encodedCode}`

  return new URL(`/invite/${encodedCode}`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}
