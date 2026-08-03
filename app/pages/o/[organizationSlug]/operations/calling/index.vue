<script setup lang="ts">
import { needUrgencyLabels } from '~~/shared/domain'
import { formatDateTime } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { organization } = useCurrentOrganization()
const args = computed(() => organization.value ? { organizationId: organization.value._id } : null)
const { data: needs, isPending, error } = useConvexQuery(api.needs.listCallingNeeds, args)
const route = useRoute()
const base = computed(() => `/o/${route.params.organizationSlug}/operations/calling`)

function urgencyTone(urgency: string) {
  return urgency === 'CRITICAL' ? 'danger' : urgency === 'HIGH' ? 'warning' : urgency === 'MEDIUM' ? 'info' : 'neutral'
}
</script>

<template>
  <div class="page-container pb-28 lg:pb-8">
    <header class="mb-5 flex gap-4 items-end justify-between">
      <div>
        <p class="text-xs text-[var(--color-accent)] tracking-[.14em] font-800 mb-2 uppercase">
          Calling
        </p>
        <h1 class="text-2xl tracking-tight font-800 m-0">
          Couvrir les besoins actifs
        </h1>
        <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
          Choisissez un besoin, puis appelez les transporteurs les plus pertinents de votre portefeuille.
        </p>
      </div>
      <NuxtLink :to="`${base}/portfolio`" class="text-sm text-[var(--color-accent)] font-700 hidden sm:inline-flex focus-ring">
        Portefeuille
      </NuxtLink>
    </header>

    <div v-if="isPending" class="space-y-3" aria-busy="true">
      <AppSkeleton :lines="4" /><AppSkeleton :lines="4" />
    </div>
    <p v-else-if="error" class="text-sm p-4 border border-[var(--color-danger)]/40 rounded-xl" role="alert">
      Impossible de charger les besoins actifs.
    </p>
    <AppEmptyState v-else-if="!needs?.length" title="Aucun besoin actif" description="Vos relances et votre portefeuille restent accessibles depuis l’onglet Portefeuille." icon="i-carbon-task" />
    <section v-else class="gap-3 grid" aria-label="Besoins prioritaires">
      <NuxtLink v-for="need in needs" :key="need._id" :to="`${base}/${need._id}`" class="p-4 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] block transition hover:border-[var(--color-accent)] focus-ring">
        <div class="flex gap-3 items-center justify-between">
          <span class="text-xs text-[var(--color-accent)] tracking-wider font-800">{{ need.reference }}</span>
          <AppBadge :tone="urgencyTone(need.urgency)">
            {{ needUrgencyLabels[need.urgency] }}
          </AppBadge>
        </div>
        <h2 class="text-base font-800 mb-1 mt-3">
          {{ need.loadingLocation }} <span class="text-[var(--color-accent)]">→</span> {{ need.destination }}
        </h2>
        <p class="text-sm text-[var(--color-text-muted)] m-0">
          {{ need.truckType }} · {{ need.tonnageTons }} t · {{ need.clientName }}
        </p>
        <p v-if="need.maximumCarrierPrice" class="text-xs text-[var(--color-text-muted)] mb-0 mt-2">
          Prix plafond : {{ need.maximumCarrierPrice.toLocaleString('fr-FR') }} FCFA / camion
        </p>
        <div class="mt-4 pt-3 border-t border-[var(--color-border)] flex gap-3 items-center justify-between">
          <strong class="text-sm">{{ need.approvedTruckCount }} / {{ need.requestedTruckCount }} camions confirmés</strong>
          <span class="text-xs text-[var(--color-text-muted)]">{{ need.remainingTruckCount }} restant(s) · {{ formatDateTime(need.mobilizationAt) }}</span>
        </div>
      </NuxtLink>
    </section>
  </div>
</template>
