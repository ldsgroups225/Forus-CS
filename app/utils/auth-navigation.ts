import type { ConvexClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

export async function destinationAfterAuthentication(convex: ConvexClient) {
  const organizations = await convex.query(api.organizations.listForCurrentUser, {})
  const firstOrganization = organizations[0]

  return firstOrganization
    ? `/o/${firstOrganization.slug}/operations`
    : '/onboarding/organization'
}
