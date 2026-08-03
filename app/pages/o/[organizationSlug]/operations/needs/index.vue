<script setup lang="ts">
import { needStatuses, needStatusLabels, needUrgencies, needUrgencyLabels } from '~~/shared/domain'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { organization } = useCurrentOrganization()
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null,
)
const { data: needs, isPending, error } = useConvexQuery(api.needs.listAll, queryArgs)

const search = ref('')
const status = ref('')
const urgency = ref('')
const destination = ref('')
const truckType = ref('')

const statusOptions = [
  { value: '', label: 'Besoins actifs' },
  ...needStatuses.map(value => ({ value, label: needStatusLabels[value] })),
]
const urgencyOptions = [
  { value: '', label: 'Toutes les urgences' },
  ...needUrgencies.map(value => ({ value, label: needUrgencyLabels[value] })),
]
const destinations = computed(() => [
  { value: '', label: 'Toutes les destinations' },
  ...Array.from(new Set((needs.value ?? []).map(need => need.destination)))
    .sort()
    .map(value => ({ value, label: value })),
])
const truckTypes = computed(() => [
  { value: '', label: 'Tous les camions' },
  ...Array.from(new Set((needs.value ?? []).map(need => need.truckType)))
    .sort()
    .map(value => ({ value, label: value })),
])

const filteredNeeds = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  return (needs.value ?? []).filter((need) => {
    const matchesSearch = !needle
      || need.reference.toLocaleLowerCase('fr').includes(needle)
      || need.clientName.toLocaleLowerCase('fr').includes(needle)
    const matchesStatus = status.value
      ? need.status === status.value
      : need.status === 'OPEN' || need.status === 'PARTIAL'

    return matchesSearch
      && matchesStatus
      && (!urgency.value || need.urgency === urgency.value)
      && (!destination.value || need.destination === destination.value)
      && (!truckType.value || need.truckType === truckType.value)
  })
})
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Besoins" description="Les besoins actifs restent visibles jusqu’à satisfaction ou annulation.">
      <template #actions>
        <AppButton @click="navigateTo(`/o/${organization?.slug}/operations/needs/new`)">
          <template #leading>
            <span class="i-carbon-add" />
          </template>
          Nouveau besoin
        </AppButton>
      </template>
    </AppPageHeader>

    <AppCard class="mb-5 p-3 sm:p-4">
      <div class="gap-3 grid xl:grid-cols-[1.4fr_repeat(4,1fr)] sm:grid-cols-2">
        <div class="relative">
          <span class="i-carbon-search text-[var(--color-text-subtle)] pointer-events-none left-3.5 top-1/2 absolute -translate-y-1/2" />
          <AppInput id="needs-search" v-model="search" aria-label="Rechercher un besoin par référence ou client" placeholder="Référence ou client…" class="pl-10" />
        </div>
        <AppSelect id="needs-status" v-model="status" aria-label="Filtrer par statut" :options="statusOptions" />
        <AppSelect id="needs-urgency" v-model="urgency" aria-label="Filtrer par urgence" :options="urgencyOptions" />
        <AppSelect id="needs-destination" v-model="destination" aria-label="Filtrer par destination" :options="destinations" />
        <AppSelect id="needs-truck-type" v-model="truckType" aria-label="Filtrer par type de camion" :options="truckTypes" />
      </div>
    </AppCard>

    <div v-if="isPending" class="space-y-3">
      <AppCard v-for="index in 4" :key="index">
        <AppSkeleton :lines="2" />
      </AppCard>
    </div>
    <div v-else-if="error" class="text-sm text-red-300 p-4 border border-red-500/25 rounded-2xl bg-red-500/10">
      Impossible de charger les besoins.
    </div>
    <AppEmptyState
      v-else-if="filteredNeeds.length === 0"
      title="Aucun besoin trouvé"
      description="Ajustez les filtres ou créez un nouveau besoin opérationnel."
      icon="i-carbon-search-locate"
    >
      <AppButton size="sm" @click="navigateTo(`/o/${organization?.slug}/operations/needs/new`)">
        Créer un besoin
      </AppButton>
    </AppEmptyState>

    <template v-else>
      <div class="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] hidden overflow-hidden md:block">
        <div class="overflow-x-auto">
          <table class="text-xs text-left w-full border-collapse">
            <thead class="text-[10px] text-[var(--color-text-subtle)] tracking-wider bg-[var(--color-bg-deep)] uppercase">
              <tr>
                <th class="font-800 px-4 py-3">
                  Référence / Client
                </th>
                <th class="font-800 px-4 py-3">
                  Urgence
                </th>
                <th class="font-800 px-4 py-3">
                  Trajet
                </th>
                <th class="font-800 px-4 py-3">
                  Camion / Tonnage
                </th>
                <th class="font-800 px-4 py-3 text-center">
                  Demandés
                </th>
                <th class="font-800 px-4 py-3 text-center">
                  OK
                </th>
                <th class="font-800 px-4 py-3 text-center">
                  Reste
                </th>
                <th class="font-800 px-4 py-3">
                  Statut
                </th>
                <th class="font-800 px-4 py-3">
                  Mise à jour
                </th>
              </tr>
            </thead>
            <tbody class="divide-[var(--color-border)] divide-y">
              <tr
                v-for="need in filteredNeeds"
                :key="need._id"
                class="cursor-pointer transition hover:bg-[var(--color-surface-raised)]"
                tabindex="0"
                @click="navigateTo(`/o/${organization?.slug}/operations/needs/${need._id}`)"
                @keydown.enter="navigateTo(`/o/${organization?.slug}/operations/needs/${need._id}`)"
              >
                <td class="px-4 py-3.5">
                  <div class="text-[var(--color-text)] font-800">
                    {{ need.reference }}
                  </div>
                  <div class="text-[var(--color-text-muted)] mt-1">
                    {{ need.clientName }}
                  </div>
                </td>
                <td class="px-4 py-3.5">
                  <AppBadge :tone="needUrgencyTone(need.urgency)">
                    {{ needUrgencyLabels[need.urgency] }}
                  </AppBadge>
                </td>
                <td class="px-4 py-3.5 max-w-56">
                  <div class="truncate">
                    {{ need.loadingLocation }} → {{ need.destination }}
                  </div>
                  <div class="text-[var(--color-text-muted)] mt-1 truncate">
                    {{ need.cargoType }}
                  </div>
                </td>
                <td class="px-4 py-3.5">
                  <div>{{ need.truckType }}</div>
                  <div class="text-[var(--color-text-muted)] mt-1">
                    {{ need.tonnageTons }} T
                  </div>
                </td>
                <td class="font-800 px-4 py-3.5 text-center">
                  {{ need.requestedTruckCount }}
                </td>
                <td class="text-green-300 font-800 px-4 py-3.5 text-center">
                  {{ need.approvedTruckCount }}
                </td>
                <td class="text-orange-300 font-800 px-4 py-3.5 text-center">
                  {{ need.remainingTruckCount }}
                </td>
                <td class="px-4 py-3.5">
                  <AppBadge :tone="needStatusTone(need.status)">
                    {{ needStatusLabels[need.status] }}
                  </AppBadge>
                </td>
                <td class="text-[var(--color-text-muted)] px-4 py-3.5 whitespace-nowrap">
                  {{ formatDateTime(need.lastUpdatedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="space-y-3 md:hidden">
        <NuxtLink
          v-for="need in filteredNeeds"
          :key="need._id"
          :to="`/o/${organization?.slug}/operations/needs/${need._id}`"
          class="p-4 surface-panel block transition active:scale-[0.99]"
        >
          <div class="mb-3 flex gap-3 items-start justify-between">
            <div>
              <div class="font-900">
                {{ need.reference }}
              </div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">
                {{ need.clientName }}
              </div>
            </div>
            <AppBadge :tone="needStatusTone(need.status)">
              {{ needStatusLabels[need.status] }}
            </AppBadge>
          </div>
          <div class="text-xs mb-3 p-3 rounded-xl bg-[var(--color-bg-deep)]">
            <div class="flex gap-2 items-center">
              <span class="i-carbon-location text-[var(--color-accent)]" />{{ need.loadingLocation }} → {{ need.destination }}
            </div>
            <div class="text-[var(--color-text-muted)] mt-2 flex gap-2 items-center">
              <span class="i-carbon-delivery-truck" />{{ need.truckType }} · {{ need.tonnageTons }} T
            </div>
          </div>
          <div class="text-center grid grid-cols-3 divide-[var(--color-border)] divide-x">
            <div><strong class="text-base block">{{ need.requestedTruckCount }}</strong><span class="text-[10px] text-[var(--color-text-subtle)]">Demandés</span></div>
            <div><strong class="text-base text-green-300 block">{{ need.approvedTruckCount }}</strong><span class="text-[10px] text-[var(--color-text-subtle)]">Camions OK</span></div>
            <div><strong class="text-base text-orange-300 block">{{ need.remainingTruckCount }}</strong><span class="text-[10px] text-[var(--color-text-subtle)]">Reste</span></div>
          </div>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
