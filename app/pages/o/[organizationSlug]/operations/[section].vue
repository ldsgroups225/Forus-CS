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
    <AppPageHeader :title="label" description="Ce module sera bientôt disponible dans le parcours opérationnel." />
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
