export function useAuth() {
  const { $authClient } = useNuxtApp()
  const session = $authClient.useSession()

  const user = computed(() => session.value.data?.user ?? null)
  const isAuthenticated = computed(() => Boolean(user.value))
  const isPending = computed(() => session.value.isPending)
  const error = computed(() => session.value.error)

  async function signOut() {
    await $authClient.signOut()
    await session.value.refetch()
    await navigateTo('/login')
  }

  return {
    authClient: $authClient,
    session,
    user,
    isAuthenticated,
    isPending,
    error,
    signOut,
  }
}
