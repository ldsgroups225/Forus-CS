<script setup lang="ts">
definePageMeta({ layout: 'operations' })

const route = useRoute()
const labels: Record<string, string> = {
  options: 'Options',
  missions: 'Missions',
  incidents: 'Incidents',
  clients: 'Clients',
  transporteurs: 'Transporteurs',
  rapports: 'Rapports',
  parametres: 'Paramètres',
}
const section = computed(() => String(route.params.section))
const label = computed(() => labels[section.value] ?? 'Module')
</script>

<template>
  <div class="page-container">
    <div class="mb-6">
      <p class="text-xs text-[var(--color-accent)] tracking-[0.16em] font-800 mb-1 uppercase">
        Forus Call Center
      </p>
      <h1 class="text-2xl font-900 m-0 sm:text-3xl">
        {{ label }}
      </h1>
    </div>
    <AppEmptyState
      :title="`${label} — À venir`"
      description="Ce module est identifié dans l’architecture produit, mais il ne fait pas partie du premier parcours vertical."
      icon="i-carbon-construction"
    >
      <AppButton variant="secondary" @click="navigateTo(`/o/${route.params.organizationSlug}/operations`)">
        Retour au dashboard
      </AppButton>
    </AppEmptyState>
  </div>
</template>
