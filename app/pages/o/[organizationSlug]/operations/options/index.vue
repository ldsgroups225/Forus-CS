<script setup lang="ts">
import { carrierOptionStatuses, carrierOptionStatusLabels } from '~~/shared/domain'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { organization } = useCurrentOrganization()
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null,
)
const { data: options, isPending, error } = useConvexQuery(
  api.carrierOptions.listForOrganization,
  queryArgs,
)
const search = ref('')
const status = ref('')
const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  ...carrierOptionStatuses.map(value => ({ value, label: carrierOptionStatusLabels[value] })),
]
const filteredOptions = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  return (options.value ?? []).filter(option =>
    (!status.value || option.status === status.value)
    && (
      !needle
      || option.reference.toLocaleLowerCase('fr').includes(needle)
      || option.carrierName.toLocaleLowerCase('fr').includes(needle)
      || option.needReference.toLocaleLowerCase('fr').includes(needle)
      || option.clientName.toLocaleLowerCase('fr').includes(needle)
    ),
  )
})
const pendingCount = computed(() =>
  (options.value ?? []).filter(option => option.status === 'PENDING').length,
)
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Options transporteurs" description="Comparez, négociez et transformez les propositions retenues en missions.">
      <template #actions>
        <AppBadge :tone="pendingCount ? 'warning' : 'success'" dot>
          {{ pendingCount }} à décider
        </AppBadge>
      </template>
    </AppPageHeader>

    <AppCard class="mb-5 p-3 sm:p-4">
      <div class="gap-3 grid sm:grid-cols-2">
        <div class="relative">
          <span class="i-carbon-search text-[var(--color-text-subtle)] pointer-events-none left-3.5 top-1/2 absolute -translate-y-1/2" />
          <AppInput
            id="options-search"
            v-model="search"
            aria-label="Rechercher une option"
            placeholder="Option, transporteur, besoin ou client…"
            class="pl-10"
          />
        </div>
        <AppSelect id="options-status" v-model="status" aria-label="Filtrer par statut" :options="statusOptions" />
      </div>
    </AppCard>

    <div v-if="isPending" class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="index in 6" :key="index">
        <AppSkeleton :lines="4" />
      </AppCard>
    </div>
    <div v-else-if="error" class="text-sm text-red-300 p-4 border border-red-500/25 rounded-2xl bg-red-500/10">
      Impossible de charger les options.
    </div>
    <AppEmptyState
      v-else-if="filteredOptions.length === 0"
      title="Aucune option transporteur"
      description="Ouvrez un besoin actif pour soumettre la première proposition transporteur."
      icon="i-carbon-list-checked"
    >
      <AppButton variant="secondary" @click="navigateTo(`/o/${organization?.slug}/operations/needs`)">
        Voir les besoins actifs
      </AppButton>
    </AppEmptyState>
    <div v-else class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <CarrierOptionCard
        v-for="option in filteredOptions"
        :key="option._id"
        :option="option"
        :organization-slug="organization?.slug ?? ''"
      />
    </div>
  </div>
</template>
