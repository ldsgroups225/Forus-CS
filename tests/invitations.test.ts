import { describe, expect, it } from 'vitest'
import { buildInvitationUrl } from '../shared/invitations'

describe('buildInvitationUrl', () => {
  it('uses the configured public site URL first', () => {
    expect(buildInvitationUrl('https://forus-cs.vercel.app', 'http://localhost:3000', 'abc123'))
      .toBe('https://forus-cs.vercel.app/invite/abc123')
  })

  it('falls back to the current browser origin', () => {
    expect(buildInvitationUrl('', 'http://localhost:3000', 'abc123'))
      .toBe('http://localhost:3000/invite/abc123')
  })

  it('returns an internal path when no base URL is known', () => {
    expect(buildInvitationUrl('', '', 'abc123'))
      .toBe('/invite/abc123')
  })
})
