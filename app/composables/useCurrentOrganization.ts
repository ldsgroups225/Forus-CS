import { api } from '../../convex/_generated/api'

export function useCurrentOrganization() {
  const route = useRoute()
  const slug = computed(() => {
    const params = route.params as Record<string, string | string[] | undefined>
    return typeof params.organizationSlug === 'string' ? params.organizationSlug : null
  })

  const queryArgs = computed(() => slug.value ? { slug: slug.value } : null)
  const result = useConvexQuery(api.organizations.getBySlug, queryArgs)

  return {
    slug,
    organization: result.data,
    isPending: result.isPending,
    error: result.error,
  }
}
