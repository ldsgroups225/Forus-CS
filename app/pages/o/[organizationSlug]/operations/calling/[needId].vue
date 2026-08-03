<script setup lang="ts">
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { buildPhoneUrl, formatDateTime, formatPhoneNumber } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const route = useRoute()
const { organization } = useCurrentOrganization()
const needId = computed(() => route.params.needId as Id<'needs'>)
const needArgs = computed(() => needId.value ? { needId: needId.value } : null)
const queueArgs = computed(() => organization.value && needId.value
  ? { organizationId: organization.value._id, needId: needId.value }
  : null)
const { data: need, isPending: isNeedPending, error: needError } = useConvexQuery(api.needs.getById, needArgs)
const { data: queue, isPending, error } = useConvexQuery(api.carriers.listCallingQueue, queueArgs)
const selectedCarrierId = ref<string | null>(null)
const pendingCarrierId = ref<string | null>(null)
const sheetOpen = ref(false)
const search = ref('')
const selectedCarrier = computed(() => queue.value?.find(carrier => carrier._id === selectedCarrierId.value) ?? null)
const filteredQueue = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase()
  return (queue.value ?? []).filter(carrier => !needle || `${carrier.name} ${carrier.phone} ${carrier.truckTypes.join(' ')}`.toLocaleLowerCase().includes(needle))
})
const base = computed(() => `/o/${route.params.organizationSlug}/operations/calling`)
const { start: startPostCallRecap } = usePostCallRecap({
  onReturn: () => {
    if (pendingCarrierId.value)
      beginResult(pendingCarrierId.value)
    pendingCarrierId.value = null
  },
})

function beginResult(carrierId: string) {
  selectedCarrierId.value = carrierId
  sheetOpen.value = true
}

function startDial(carrierId: string) {
  pendingCarrierId.value = carrierId
  if (import.meta.client && organization.value)
    localStorage.setItem(`forus-calling-draft:${organization.value._id}:${needId.value}:${carrierId}`, JSON.stringify({}))
  startPostCallRecap()
}

watch([needId, () => organization.value?._id], ([activeNeedId, organizationId]) => {
  if (import.meta.client && activeNeedId && organizationId)
    localStorage.setItem(`forus-calling-active-need:${organizationId}`, activeNeedId)
}, { immediate: true })
</script>

<template>
  <div class="page-container pb-28 lg:pb-8">
    <NuxtLink :to="base" class="text-sm text-[var(--color-accent)] font-700 inline-flex gap-2 items-center focus-ring">
      <span class="i-carbon-arrow-left" /> Besoins
    </NuxtLink>
    <div v-if="isNeedPending" class="mt-5 space-y-3" aria-busy="true">
      <AppSkeleton :lines="4" />
    </div>
    <div v-else-if="needError || !need" class="mt-5">
      <AppEmptyState title="Besoin introuvable" description="Retournez aux besoins actifs pour poursuivre le Calling." icon="i-carbon-warning" />
    </div>
    <template v-else>
      <header class="mt-4 p-4 border border-[var(--color-accent)]/35 rounded-2xl bg-[var(--color-accent-soft)]">
        <div class="flex gap-3 items-start justify-between">
          <div>
            <p class="text-xs text-[var(--color-accent)] tracking-wider font-800 mb-2">
              {{ need.reference }} · BESOIN ACTIF
            </p><h1 class="text-xl tracking-tight font-800 m-0">
              {{ need.loadingLocation }} → {{ need.destination }}
            </h1>
          </div><AppBadge tone="warning">
            {{ need.remainingTruckCount }} à trouver
          </AppBadge>
        </div>
        <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-3">
          {{ need.truckType }} · {{ need.tonnageTons }} t · mobilisation {{ formatDateTime(need.mobilizationAt) }}
        </p>
        <div class="mt-4 flex gap-2 items-center">
          <strong class="text-sm">{{ need.approvedTruckCount }} / {{ need.requestedTruckCount }} confirmés</strong><span class="text-xs text-[var(--color-text-muted)]">Le contexte reste visible pendant les appels.</span>
        </div>
      </header>

      <section class="mt-6" aria-labelledby="call-targets-title">
        <div class="mb-3 flex gap-3 items-center justify-between">
          <div>
            <h2 id="call-targets-title" class="text-lg font-800 m-0">
              Appeler
            </h2><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-1">
              Triés selon le type, la destination et la disponibilité connue.
            </p>
          </div><NuxtLink :to="`${base}/portfolio`" class="text-sm text-[var(--color-accent)] font-700 focus-ring">
            Portefeuille
          </NuxtLink>
        </div>
        <AppInput v-model="search" aria-label="Rechercher dans le portefeuille" placeholder="Rechercher un transporteur…" />
      </section>
      <div v-if="isPending" class="mt-4 space-y-3" aria-busy="true">
        <AppSkeleton :lines="4" /><AppSkeleton :lines="4" />
      </div>
      <p v-else-if="error" class="text-sm text-[var(--color-danger)] mt-4" role="alert">
        Le portefeuille n’est pas disponible pour ce besoin.
      </p>
      <AppEmptyState v-else-if="!filteredQueue.length" class="mt-5" title="Aucun transporteur correspondant" description="Ne cherchez pas hors portefeuille : remontez plutôt un prospect au superviseur." icon="i-carbon-phone-off" />
      <section v-else class="mt-4 gap-3 grid" aria-label="Transporteurs appelables">
        <article v-for="carrier in filteredQueue" :key="carrier._id" class="p-4 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <p class="text-xs text-[var(--color-accent)] tracking-wider font-800 mb-1">
                COMPATIBILITÉ {{ carrier.matchScore }}/7
              </p><h2 class="text-base font-800 m-0">
                {{ carrier.name }}
              </h2><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-1">
                {{ carrier.truckTypes.join(', ') || 'Type à confirmer' }} · {{ carrier.availableVehicleCount ? `${carrier.availableVehicleCount} disponibilité(s) connue(s)` : 'Disponibilité à confirmer' }}
              </p>
            </div><AppBadge :tone="carrier.documentsValid ? 'success' : 'warning'">
              {{ carrier.documentsValid ? 'Docs OK' : 'Docs à vérifier' }}
            </AppBadge>
          </div>
          <p class="text-sm font-700 mb-0 mt-3">
            {{ formatPhoneNumber(carrier.phone) }}
          </p>
          <div class="mt-4 gap-2 grid grid-cols-2">
            <a :href="buildPhoneUrl(carrier.phone)" class="text-sm text-[var(--color-button-text)] font-700 px-4 py-2.5 border border-[var(--color-accent)] rounded-xl bg-[var(--color-accent)] flex gap-2 min-h-11 items-center justify-center focus-ring" @click="startDial(carrier._id)"><span class="i-carbon-phone-filled" /> Appeler</a><AppButton variant="secondary" @click="beginResult(carrier._id)">
              Saisir retour
            </AppButton>
          </div>
        </article>
      </section>
      <CallingResultSheet v-model="sheetOpen" :organization-id="organization!._id" :need="need" :carrier="selectedCarrier" @submitted="selectedCarrierId = null" />
    </template>
  </div>
</template>
