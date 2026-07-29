<script setup lang="ts">
import { roleLabels } from '~~/shared/domain'
import { api } from '../../../convex/_generated/api'

definePageMeta({ layout: false })

const route = useRoute()
const { $convex } = useNuxtApp()
const code = computed(() => String(route.params.code ?? ''))
const { data: invitation, isPending } = useConvexQuery(
  api.invitations.preview,
  computed(() => code.value ? { code: code.value } : null),
)
const accepting = shallowRef(false)
const error = shallowRef('')

async function acceptInvitation() {
  accepting.value = true
  error.value = ''
  try {
    const result = await $convex.mutation(api.invitations.accept, { code: code.value })
    await navigateTo(`/o/${result.slug}/operations`)
  }
  catch {
    error.value = 'Impossible d’accepter cette invitation. Vérifiez l’adresse e-mail du compte et la date d’expiration.'
  }
  finally {
    accepting.value = false
  }
}
</script>

<template>
  <main class="p-4 bg-[var(--color-bg)] flex min-h-screen items-center justify-center">
    <AppCard class="max-w-lg w-full">
      <AppBrand />
      <div v-if="isPending" class="mt-8">
        <AppSkeleton :lines="5" />
      </div>
      <AppEmptyState v-else-if="!invitation" class="mt-8" title="Invitation introuvable" description="Le lien est invalide ou a été supprimé." icon="i-carbon-warning-alt" />
      <div v-else class="mt-8">
        <AppBadge :tone="invitation.status === 'PENDING' ? 'warning' : 'neutral'" dot>
          {{ invitation.status }}
        </AppBadge>
        <h1 class="text-2xl font-900 mb-0 mt-4">
          Rejoindre {{ invitation.organizationName }}
        </h1>
        <p class="text-sm text-[var(--color-text-muted)] mt-3">
          Invitation pour <strong class="text-[var(--color-text)]">{{ invitation.email }}</strong> avec le rôle <strong class="text-[var(--color-text)]">{{ roleLabels[invitation.role] }}</strong>.
        </p>
        <p v-if="error" class="text-sm text-red-300 p-3 border border-red-500/25 rounded-xl bg-red-500/8" role="alert">
          {{ error }}
        </p>
        <AppButton v-if="invitation.status === 'PENDING'" class="mt-4" block :loading="accepting" @click="acceptInvitation">
          Accepter l’invitation
        </AppButton>
        <p v-else class="text-sm text-orange-300 mt-4">
          Cette invitation n’est plus active.
        </p>
      </div>
    </AppCard>
  </main>
</template>
