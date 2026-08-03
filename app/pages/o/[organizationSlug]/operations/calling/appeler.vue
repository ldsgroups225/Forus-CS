<script setup lang="ts">
definePageMeta({ layout: 'operations' })

const route = useRoute()
const { organization } = useCurrentOrganization()
const base = computed(() => `/o/${route.params.organizationSlug}/operations/calling`)
const lastNeedId = shallowRef<string | null>(null)

onMounted(() => {
  if (organization.value)
    lastNeedId.value = localStorage.getItem(`forus-calling-active-need:${organization.value._id}`)
})

function openLastNeed() {
  if (lastNeedId.value)
    return navigateTo(`${base.value}/${lastNeedId.value}`)
  return navigateTo(base.value)
}
</script>

<template>
  <div class="page-container pb-28 lg:pb-8">
    <header class="mt-4">
      <h1 class="text-2xl tracking-tight font-800 m-0">
        Appeler
      </h1>
      <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
        Reprenez le besoin actif ou choisissez le prochain besoin à couvrir.
      </p>
    </header>
    <AppEmptyState class="mt-6" title="Choisissez un besoin à couvrir" :description="lastNeedId ? 'Votre dernier besoin est prêt à reprendre.' : 'Sélectionnez d’abord un besoin : la liste d’appels restera alors contextualisée.'" icon="i-carbon-phone-filled">
      <AppButton @click="openLastNeed">
        {{ lastNeedId ? 'Reprendre le besoin actif' : 'Voir les besoins' }}
      </AppButton>
    </AppEmptyState>
  </div>
</template>
