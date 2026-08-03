<script setup lang="ts">
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { organization } = useCurrentOrganization()
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null,
)
const { data: missions, isPending, error } = useConvexQuery(
  api.missions.listForOrganization,
  queryArgs,
)
const search = ref('')
const filteredMissions = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  if (!needle)
    return missions.value ?? []

  return (missions.value ?? []).filter(mission =>
    mission.reference.toLocaleLowerCase('fr').includes(needle)
    || mission.needReference.toLocaleLowerCase('fr').includes(needle)
    || mission.carrierName.toLocaleLowerCase('fr').includes(needle)
    || mission.clientName.toLocaleLowerCase('fr').includes(needle)
    || mission.destination.toLocaleLowerCase('fr').includes(needle),
  )
})
const totalTrucks = computed(() =>
  (missions.value ?? []).reduce((total, mission) => total + mission.truckCount, 0),
)
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Missions confirmées" description="Une mission est créée automatiquement pour chaque option acceptée.">
      <template #actions>
        <AppBadge tone="success" dot>
          {{ missions?.length ?? 0 }} mission(s)
        </AppBadge>
        <AppBadge tone="accent">
          {{ totalTrucks }} camion(s)
        </AppBadge>
      </template>
    </AppPageHeader>

    <AppCard class="mb-5 p-3 sm:p-4">
      <div class="relative">
        <span class="i-carbon-search text-[var(--color-text-subtle)] pointer-events-none left-3.5 top-1/2 absolute -translate-y-1/2" />
        <AppInput
          id="missions-search"
          v-model="search"
          aria-label="Rechercher une mission"
          placeholder="Mission, besoin, transporteur, client ou destination…"
          class="pl-10"
        />
      </div>
    </AppCard>

    <div v-if="isPending" class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="index in 6" :key="index">
        <AppSkeleton :lines="5" />
      </AppCard>
    </div>
    <div v-else-if="error" class="text-sm text-red-300 p-4 border border-red-500/25 rounded-2xl bg-red-500/10">
      Impossible de charger les missions.
    </div>
    <AppEmptyState
      v-else-if="filteredMissions.length === 0"
      title="Aucune mission confirmée"
      description="Acceptez une option transporteur pour créer automatiquement la première mission."
      icon="i-carbon-delivery"
    >
      <AppButton variant="secondary" @click="navigateTo(`/o/${organization?.slug}/operations/options`)">
        Décider des options
      </AppButton>
    </AppEmptyState>
    <div v-else class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <MissionCard
        v-for="mission in filteredMissions"
        :key="mission._id"
        :mission="mission"
        :organization-slug="organization?.slug ?? ''"
      />
    </div>
  </div>
</template>
