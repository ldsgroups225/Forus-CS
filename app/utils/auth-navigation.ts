import type { ConvexClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

export async function destinationAfterAuthentication(convex: ConvexClient) {
  const organizations = await convex.query(api.organizations.listForCurrentUser, {})
  const cachedSlug = getCachedOrganizationSlug()
  const firstOrganization = organizations.find(organization => organization.slug === cachedSlug)
    ?? organizations[0]

  return firstOrganization
    ? `/o/${firstOrganization.slug}/operations${firstOrganization.role === 'AGENT' ? '/calling' : ''}`
    : '/onboarding/organization'
}
