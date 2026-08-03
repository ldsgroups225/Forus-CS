<script setup lang="ts">
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { carrierOptionStatusLabels, needUrgencyLabels } from '~~/shared/domain'
import { formatDateTime } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const route = useRoute()
const { organization } = useCurrentOrganization()
const args = computed(() => organization.value ? { organizationId: organization.value._id } : null)
const needsQuery = useConvexQuery(api.needs.listActive, args)
const optionsQuery = useConvexQuery(api.carrierOptions.listForOrganization, args)
const escalationsQuery = useConvexQuery(api.callingEscalations.listPending, args)
const needs = needsQuery.data
const options = optionsQuery.data
const escalations = escalationsQuery.data
const actionFeedback = ref('')
const busyOptionId = ref<string | null>(null)
const selectedVehicleIds = ref<Record<string, string[]>>({})
const optionToAccept = shallowRef<NonNullable<typeof options.value>[number] | null>(null)
const acceptOpen = ref(false)
const base = computed(() => `/o/${route.params.organizationSlug}/operations/calling`)
const isOperations = computed(() => ['ORGANIZATION_ADMIN', 'OPERATIONS_MANAGER'].includes(organization.value?.role ?? ''))
const loading = computed(() => needsQuery.isPending.value || optionsQuery.isPending.value || escalationsQuery.isPending.value)
const loadError = computed(() => needsQuery.error.value || optionsQuery.error.value || escalationsQuery.error.value)
const coverage = computed(() => (needs.value ?? []).map((need) => {
  const needOptions = (options.value ?? []).filter(option => option.needId === need._id)
  return { need, pending: needOptions.filter(option => option.status === 'PENDING'), options: needOptions }
}))
const acceptanceVehicles = computed(() => optionToAccept.value
  ? optionToAccept.value.vehicles.filter(vehicle => selectedFor(optionToAccept.value!).includes(vehicle._id))
  : [])
const acceptanceTotal = computed(() => optionToAccept.value
  ? optionToAccept.value.pricePerTruck * acceptanceVehicles.value.length
  : 0)

function reloadPage() {
  if (import.meta.client)
    window.location.reload()
}

function tone(status: string) {
  return status === 'VALIDATED' || status === 'ACCEPTED' ? 'success' : status === 'PENDING' || status === 'NEGOTIATION' ? 'warning' : 'danger'
}

async function validate(optionId: string) {
  busyOptionId.value = optionId
  actionFeedback.value = ''
  try {
    await $convex.mutation(api.carrierOptions.validate, { optionId: optionId as Id<'carrierOptions'> })
  }
  catch {
    actionFeedback.value = 'Validation impossible : vérifiez les documents et les camions nommés.'
  }
  finally {
    busyOptionId.value = null
  }
}

async function requestRevision(optionId: string) {
  busyOptionId.value = optionId
  actionFeedback.value = ''
  try {
    await $convex.mutation(api.carrierOptions.negotiate, {
      optionId: optionId as Id<'carrierOptions'>,
      decisionNote: 'Informations complémentaires ou négociation requises.',
    })
  }
  catch {
    actionFeedback.value = 'La demande de correction est impossible.'
  }
  finally {
    busyOptionId.value = null
  }
}

function openAcceptance(option: NonNullable<typeof options.value>[number]) {
  const acceptedOptionVehicleIds = selectedFor(option)
  if (!acceptedOptionVehicleIds.length) {
    actionFeedback.value = 'Sélectionnez au moins un camion à accepter.'
    return
  }
  optionToAccept.value = option
  acceptOpen.value = true
}

async function accept() {
  const option = optionToAccept.value
  if (!option)
    return
  const acceptedOptionVehicleIds = selectedFor(option)
  busyOptionId.value = option._id
  actionFeedback.value = ''
  try {
    await $convex.mutation(api.carrierOptions.accept, {
      optionId: option._id,
      acceptedTruckCount: acceptedOptionVehicleIds.length,
      acceptedOptionVehicleIds: acceptedOptionVehicleIds as Id<'carrierOptionVehicles'>[],
    })
    acceptOpen.value = false
    optionToAccept.value = null
  }
  catch {
    actionFeedback.value = 'Acceptation impossible : un véhicule est peut-être déjà réservé.'
  }
  finally {
    busyOptionId.value = null
  }
}

function selectedFor(option: NonNullable<typeof options.value>[number]) {
  return selectedVehicleIds.value[option._id] ?? option.vehicles.map(vehicle => vehicle._id)
}

function toggleVehicle(optionId: string, vehicleId: string, checked: boolean, defaultIds: string[]) {
  const current = selectedVehicleIds.value[optionId] ?? defaultIds
  selectedVehicleIds.value = {
    ...selectedVehicleIds.value,
    [optionId]: checked
      ? [...new Set([...current, vehicleId])]
      : current.filter(id => id !== vehicleId),
  }
}

function eventIsChecked(event: Event) {
  return (event.target as HTMLInputElement).checked
}

async function refuse(optionId: string) {
  busyOptionId.value = optionId
  actionFeedback.value = ''
  try {
    await $convex.mutation(api.carrierOptions.refuse, {
      optionId: optionId as Id<'carrierOptions'>,
      decisionNote: 'Retour rejeté : informations ou documents incomplets.',
    })
  }
  catch {
    actionFeedback.value = 'Le retour ne peut pas être rejeté dans son état actuel.'
  }
  finally {
    busyOptionId.value = null
  }
}

async function resolveEscalation(escalationId: string) {
  await $convex.mutation(api.callingEscalations.resolve, { escalationId: escalationId as Id<'callingEscalations'> })
}
</script>

<template>
  <div class="page-container pb-24">
    <NuxtLink :to="base" class="text-sm text-[var(--color-accent)] font-700 inline-flex gap-2 items-center focus-ring">
      <span class="i-carbon-arrow-left" /> Calling
    </NuxtLink>
    <header class="mt-4">
      <p class="text-xs text-[var(--color-accent)] tracking-[.14em] font-800 mb-2 uppercase">
        Supervision
      </p><h1 class="text-2xl tracking-tight font-800 m-0">
        Couverture des besoins
      </h1><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
        Contrôlez les retours avant la décision finale des Opérations.
      </p>
    </header>
    <p v-if="actionFeedback" class="text-sm mt-4 p-3 border border-[var(--color-danger)]/40 rounded-xl" role="alert">
      {{ actionFeedback }}
    </p>
    <div v-if="loading" class="mt-6 space-y-3" aria-busy="true">
      <AppSkeleton :lines="5" />
      <AppSkeleton :lines="5" />
    </div>
    <AppEmptyState v-else-if="loadError" class="mt-6" title="La supervision est indisponible" description="Rechargez cette page pour récupérer les besoins et les retours à contrôler." icon="i-carbon-warning">
      <AppButton variant="secondary" @click="reloadPage">
        Réessayer
      </AppButton>
    </AppEmptyState>
    <AppEmptyState v-else-if="!coverage.length" class="mt-6" title="Aucun besoin actif" description="Les besoins ouverts ou partiels apparaîtront ici." icon="i-carbon-task" />
    <section v-else class="mt-6 space-y-4 lg:hidden" aria-label="Couverture des besoins">
      <article v-for="row in coverage" :key="row.need._id" class="p-4 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]">
        <div class="flex gap-3 items-start justify-between">
          <div>
            <h2 class="text-base font-800 m-0">
              {{ row.need.reference }}
            </h2>
            <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
              {{ row.need.loadingLocation }} → {{ row.need.destination }}
            </p>
          </div>
          <AppBadge :tone="row.need.urgency === 'CRITICAL' ? 'danger' : 'warning'">
            {{ needUrgencyLabels[row.need.urgency] }}
          </AppBadge>
        </div>
        <p class="text-sm mb-0 mt-4">
          <strong>{{ row.need.approvedTruckCount }} / {{ row.need.requestedTruckCount }}</strong> camions OK · <strong>{{ row.need.remainingTruckCount }}</strong> à trouver
        </p>
        <div v-for="option in row.options" :key="option._id" class="mt-4 pt-4 border-t border-[var(--color-border)]">
          <div class="flex gap-2 items-center justify-between">
            <strong class="text-sm">{{ option.carrierName }}</strong>
            <AppBadge :tone="tone(option.status)">
              {{ carrierOptionStatusLabels[option.status] }}
            </AppBadge>
          </div>
          <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
            {{ option.proposedTruckCount }} camion(s) · {{ option.pricePerTruck.toLocaleString('fr-FR') }} FCFA
          </p>
          <label v-for="vehicle in option.vehicles" :key="vehicle._id" class="text-xs mt-2 flex gap-2 items-center">
            <input type="checkbox" :checked="selectedFor(option).includes(vehicle._id)" :disabled="option.status !== 'VALIDATED' || !vehicle.documentsConfirmed" class="accent-[var(--color-accent)]" @change="toggleVehicle(option._id, vehicle._id, eventIsChecked($event), option.vehicles.map(item => item._id))">
            {{ vehicle.registration }} · {{ vehicle.capacityTons }} t · {{ vehicle.documentsConfirmed ? 'docs OK' : 'docs à vérifier' }}
          </label>
          <div class="mt-3 gap-2 grid grid-cols-2">
            <AppButton v-if="option.status === 'PENDING'" size="sm" :loading="busyOptionId === option._id" @click="validate(option._id)">
              Valider
            </AppButton>
            <AppButton v-if="option.status === 'PENDING'" size="sm" variant="secondary" :disabled="busyOptionId === option._id" @click="requestRevision(option._id)">
              À négocier
            </AppButton>
            <AppButton v-if="option.status === 'PENDING'" size="sm" variant="danger" :disabled="busyOptionId === option._id" @click="refuse(option._id)">
              Rejeter
            </AppButton>
            <AppButton v-if="isOperations && option.status === 'VALIDATED'" size="sm" variant="success" :loading="busyOptionId === option._id" @click="openAcceptance(option)">
              Accepter
            </AppButton>
          </div>
        </div>
      </article>
    </section>
    <section v-if="!loading && !loadError && coverage.length" class="mt-6 hidden overflow-x-auto lg:block">
      <table class="text-sm min-w-[760px] w-full">
        <thead class="text-xs text-[var(--color-text-muted)] text-left">
          <tr>
            <th class="p-3">
              Besoin
            </th><th class="p-3">
              Demandés
            </th><th class="p-3">
              Camions OK
            </th><th class="p-3">
              Reste
            </th><th class="p-3">
              À contrôler
            </th><th class="p-3">
              Risque
            </th>
          </tr>
        </thead><tbody>
          <template v-for="row in coverage" :key="row.need._id">
            <tr class="border-t border-[var(--color-border)]">
              <td class="p-3">
                <strong>{{ row.need.reference }}</strong><span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ row.need.loadingLocation }} → {{ row.need.destination }}</span>
              </td><td class="p-3">
                {{ row.need.requestedTruckCount }}
              </td><td class="text-[var(--color-success)] font-800 p-3">
                {{ row.need.approvedTruckCount }}
              </td><td class="font-800 p-3">
                {{ row.need.remainingTruckCount }}
              </td><td class="p-3">
                <AppBadge :tone="row.pending.length ? 'warning' : 'neutral'">
                  {{ row.pending.length }}
                </AppBadge>
              </td><td class="p-3">
                <AppBadge :tone="row.need.urgency === 'CRITICAL' ? 'danger' : 'warning'">
                  {{ needUrgencyLabels[row.need.urgency] }}
                </AppBadge>
              </td>
            </tr><tr v-for="option in row.options" :key="option._id" class="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              <td colspan="6" class="p-4">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div class="flex gap-2 items-center">
                      <strong>{{ option.carrierName }}</strong><AppBadge :tone="tone(option.status)">
                        {{ carrierOptionStatusLabels[option.status] }}
                      </AppBadge>
                    </div><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-1">
                      {{ option.proposedTruckCount }} camion(s) · {{ option.pricePerTruck.toLocaleString('fr-FR') }} FCFA · disponible {{ formatDateTime(option.availableAt) }}
                    </p><ul class="text-xs text-[var(--color-text-muted)] mb-0 mt-2 pl-0">
                      <li v-for="vehicle in option.vehicles" :key="vehicle._id" class="mb-1 list-none">
                        <label class="flex gap-2 items-center"><input type="checkbox" :checked="selectedFor(option).includes(vehicle._id)" :disabled="option.status !== 'VALIDATED' || !vehicle.documentsConfirmed" class="accent-[var(--color-accent)]" @change="toggleVehicle(option._id, vehicle._id, eventIsChecked($event), option.vehicles.map(item => item._id))">{{ vehicle.registration }} · {{ vehicle.truckType }} · {{ vehicle.capacityTons }} t · {{ vehicle.location }} · {{ vehicle.documentsConfirmed ? 'documents confirmés' : 'documents à vérifier' }}</label>
                      </li><li v-if="!option.vehicles.length">
                        Aucun camion nommé — retour non validable.
                      </li>
                    </ul>
                  </div><div class="flex shrink-0 gap-2">
                    <AppButton v-if="option.status === 'PENDING'" size="sm" :loading="busyOptionId === option._id" @click="validate(option._id)">
                      Valider
                    </AppButton><AppButton v-if="option.status === 'PENDING'" size="sm" variant="secondary" :disabled="busyOptionId === option._id" @click="requestRevision(option._id)">
                      À négocier
                    </AppButton><AppButton v-if="option.status === 'PENDING'" size="sm" variant="danger" :disabled="busyOptionId === option._id" @click="refuse(option._id)">
                      Rejeter
                    </AppButton><AppButton v-if="isOperations && option.status === 'VALIDATED'" size="sm" variant="success" :loading="busyOptionId === option._id" @click="openAcceptance(option)">
                      Accepter
                    </AppButton>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
    <section v-if="!loading && !loadError && escalations?.length" class="mt-6 p-4 border border-[var(--color-warning)]/40 rounded-2xl bg-[var(--color-warning)]/8">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-800 m-0">
            Prospects remontés
          </h2><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-1">
            Hors portefeuille, à qualifier avant affectation.
          </p>
        </div><AppBadge tone="warning">
          {{ escalations.length }}
        </AppBadge>
      </div><div v-for="escalation in escalations" :key="escalation._id" class="py-3 border-t border-[var(--color-border)] flex gap-3 items-center justify-between first:mt-3">
        <p class="text-sm m-0">
          <strong>{{ escalation.carrierName }}</strong> · {{ escalation.source }}<span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ escalation.note }}</span>
        </p><AppButton size="sm" variant="secondary" @click="resolveEscalation(escalation._id)">
          Traité
        </AppButton>
      </div>
    </section>
    <AppModal v-model="acceptOpen" title="Confirmer l’acceptation" :description="optionToAccept ? `La mission sera créée à partir des véhicules retenus pour ${optionToAccept.carrierName}.` : ''">
      <div class="space-y-4">
        <div class="p-3 rounded-xl bg-[var(--color-accent-soft)]">
          <p class="text-sm font-800 m-0">
            {{ acceptanceVehicles.length }} camion(s) · {{ acceptanceTotal.toLocaleString('fr-FR') }} FCFA
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
            Les immatriculations sélectionnées seront réservées par la mission. Ce total est calculé, non modifiable.
          </p>
        </div>
        <ul class="text-sm m-0 pl-5">
          <li v-for="vehicle in acceptanceVehicles" :key="vehicle._id">
            {{ vehicle.registration }} · {{ vehicle.capacityTons }} t
          </li>
        </ul>
        <div class="gap-3 grid grid-cols-2">
          <AppButton variant="secondary" @click="acceptOpen = false">
            Retour
          </AppButton>
          <AppButton variant="success" :loading="busyOptionId === optionToAccept?._id" @click="accept">
            Créer la mission
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
