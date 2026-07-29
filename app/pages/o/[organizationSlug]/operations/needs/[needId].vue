<script setup lang="ts">
import type { NeedFormValues } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { needStatusLabels, needUrgencyLabels } from '~~/shared/domain'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const route = useRoute()
const { $convex } = useNuxtApp()
const { organization } = useCurrentOrganization()
const needId = computed(() => route.params.needId as Id<'needs'>)
const needArgs = computed(() => needId.value ? { needId: needId.value } : null)
const { data: need, isPending, error } = useConvexQuery(api.needs.getById, needArgs)
const clientArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null,
)
const { data: clients } = useConvexQuery(api.clients.list, clientArgs)
const auditArgs = computed(() => organization.value && need.value
  ? {
      organizationId: organization.value._id,
      entityType: 'need',
      entityId: need.value._id,
    }
  : null,
)
const { data: auditLogs } = useConvexQuery(api.auditLogs.listForEntity, auditArgs)

const editOpen = ref(false)
const cancelOpen = ref(false)
const loadingAction = ref(false)
const actionError = ref('')

const canWrite = computed(() =>
  organization.value?.role === 'ORGANIZATION_ADMIN'
  || organization.value?.role === 'OPERATIONS_MANAGER',
)
const progressPercent = computed(() => {
  if (!need.value)
    return 0
  return Math.min(100, Math.round((need.value.approvedTruckCount / need.value.requestedTruckCount) * 100))
})
const editValues = computed<NeedFormValues | undefined>(() => {
  if (!need.value)
    return undefined

  return {
    clientId: need.value.clientId,
    projectName: need.value.projectName ?? '',
    urgency: need.value.urgency,
    truckType: need.value.truckType,
    requestedTruckCount: need.value.requestedTruckCount,
    tonnageTons: need.value.tonnageTons,
    cargoType: need.value.cargoType,
    packaging: need.value.packaging ?? '',
    loadingLocation: need.value.loadingLocation,
    destination: need.value.destination,
    mobilizationAt: new Date(need.value.mobilizationAt).toISOString().slice(0, 16),
    rotations: need.value.rotations,
    estimatedDuration: need.value.estimatedDuration ?? '',
    targetCarrierPrice: need.value.targetCarrierPrice,
    maximumCarrierPrice: need.value.maximumCarrierPrice,
    paymentTerms: need.value.paymentTerms ?? '',
    negotiationAllowed: need.value.negotiationAllowed,
    constraints: need.value.constraints,
  }
})

function updateInput(values: NeedFormValues) {
  return {
    needId: needId.value,
    clientId: values.clientId as Id<'clients'>,
    projectName: values.projectName || undefined,
    urgency: values.urgency,
    truckType: values.truckType,
    requestedTruckCount: values.requestedTruckCount,
    tonnageTons: values.tonnageTons,
    cargoType: values.cargoType,
    packaging: values.packaging || undefined,
    loadingLocation: values.loadingLocation,
    destination: values.destination,
    mobilizationAt: new Date(values.mobilizationAt).getTime(),
    rotations: values.rotations,
    estimatedDuration: values.estimatedDuration || undefined,
    targetCarrierPrice: values.targetCarrierPrice,
    maximumCarrierPrice: values.maximumCarrierPrice,
    paymentTerms: values.paymentTerms || undefined,
    negotiationAllowed: values.negotiationAllowed,
    constraints: values.constraints,
  }
}

async function updateNeed(values: NeedFormValues) {
  loadingAction.value = true
  actionError.value = ''
  try {
    await $convex.mutation(api.needs.updateDraft, updateInput(values))
    editOpen.value = false
  }
  catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Modification impossible.'
  }
  finally {
    loadingAction.value = false
  }
}

async function publishNeed() {
  loadingAction.value = true
  actionError.value = ''
  try {
    await $convex.mutation(api.needs.publish, { needId: needId.value })
  }
  catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Publication impossible.'
  }
  finally {
    loadingAction.value = false
  }
}

async function cancelNeed() {
  loadingAction.value = true
  actionError.value = ''
  try {
    await $convex.mutation(api.needs.cancel, { needId: needId.value })
    cancelOpen.value = false
  }
  catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Annulation impossible.'
  }
  finally {
    loadingAction.value = false
  }
}

function auditLabel(action: string) {
  return {
    CREATE_DRAFT: 'Brouillon créé',
    UPDATE: 'Besoin modifié',
    PUBLISH: 'Besoin publié',
    CANCEL: 'Besoin annulé',
    DEVELOPMENT_SEED: 'Donnée de démonstration créée',
  }[action] ?? action
}
</script>

<template>
  <div class="page-container">
    <div v-if="isPending" class="space-y-5">
      <AppCard><AppSkeleton :lines="3" /></AppCard>
      <div class="gap-5 grid lg:grid-cols-3">
        <AppCard v-for="index in 3" :key="index">
          <AppSkeleton :lines="5" />
        </AppCard>
      </div>
    </div>
    <AppEmptyState
      v-else-if="error || !need"
      title="Besoin introuvable"
      description="Ce besoin n’existe pas ou vous n’avez pas accès à son organisation."
      icon="i-carbon-warning-alt"
    >
      <AppButton variant="secondary" @click="navigateTo(`/o/${organization?.slug}/operations/needs`)">
        Retour à la liste
      </AppButton>
    </AppEmptyState>

    <template v-else>
      <button class="text-xs text-[var(--color-text-muted)] font-700 mb-4 inline-flex gap-2 items-center hover:text-[var(--color-accent)]" @click="navigateTo(`/o/${organization?.slug}/operations/needs`)">
        <span class="i-carbon-arrow-left" />
        Retour aux besoins
      </button>

      <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div class="mb-2 flex flex-wrap gap-2 items-center">
            <AppBadge :tone="needStatusTone(need.status)" dot>
              {{ needStatusLabels[need.status] }}
            </AppBadge>
            <AppBadge :tone="needUrgencyTone(need.urgency)">
              {{ needUrgencyLabels[need.urgency] }}
            </AppBadge>
          </div>
          <h1 class="text-2xl font-900 m-0 sm:text-3xl">
            {{ need.reference }}
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
            {{ need.clientName }}<span v-if="need.projectName"> · {{ need.projectName }}</span>
          </p>
        </div>
        <div v-if="canWrite" class="flex flex-wrap gap-2">
          <AppButton
            v-if="need.status !== 'SATISFIED' && need.status !== 'CANCELLED'"
            variant="secondary"
            @click="editOpen = true"
          >
            <template #leading>
              <span class="i-carbon-edit" />
            </template>
            Modifier
          </AppButton>
          <AppButton v-if="need.status === 'DRAFT'" variant="success" :loading="loadingAction" @click="publishNeed">
            <template #leading>
              <span class="i-carbon-send" />
            </template>
            Publier
          </AppButton>
          <AppButton
            v-if="need.status !== 'SATISFIED' && need.status !== 'CANCELLED'"
            variant="danger"
            @click="cancelOpen = true"
          >
            <template #leading>
              <span class="i-carbon-close" />
            </template>
            Annuler
          </AppButton>
        </div>
      </div>

      <p v-if="actionError" class="text-sm text-red-300 mb-5 px-4 py-3 border border-red-500/25 rounded-xl bg-red-500/10" role="alert">
        {{ actionError }}
      </p>

      <div class="gap-5 grid xl:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-5">
          <AppCard>
            <div class="mb-5 flex items-center justify-between">
              <h2 class="text-base font-800 m-0">
                Résumé opérationnel
              </h2>
              <span class="text-xs text-[var(--color-text-subtle)]">MAJ {{ formatDateTime(need.lastUpdatedAt) }}</span>
            </div>
            <dl class="gap-x-6 gap-y-5 grid lg:grid-cols-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Trajet
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ need.loadingLocation }} → {{ need.destination }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Camion
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ need.truckType }} · {{ need.tonnageTons }} T
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Marchandise
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ need.cargoType }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Mobilisation
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ formatDateTime(need.mobilizationAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Prix cible
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ formatCurrency(need.targetCarrierPrice) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Prix plafond
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ formatCurrency(need.maximumCarrierPrice) }}
                </dd>
              </div>
            </dl>
          </AppCard>

          <AppCard>
            <h2 class="text-base font-800 m-0">
              Progression
            </h2>
            <div class="mt-5 gap-5 grid sm:grid-cols-[auto_1fr] sm:items-center">
              <div class="mx-auto rounded-full flex h-30 w-30 items-center justify-center relative" :style="{ background: `conic-gradient(var(--color-accent) ${progressPercent}%, var(--color-surface-raised) 0)` }">
                <div class="rounded-full bg-[var(--color-surface)] flex flex-col h-23 w-23 items-center justify-center">
                  <strong class="text-2xl">{{ progressPercent }}%</strong>
                  <span class="text-[10px] text-[var(--color-text-subtle)]">couvert</span>
                </div>
              </div>
              <div class="gap-2 grid grid-cols-3">
                <div class="p-3 text-center rounded-xl bg-[var(--color-bg-deep)]">
                  <strong class="text-xl block">{{ need.requestedTruckCount }}</strong><span class="text-[10px] text-[var(--color-text-subtle)]">Demandés</span>
                </div>
                <div class="p-3 text-center rounded-xl bg-green-500/8">
                  <strong class="text-xl text-green-300 block">{{ need.approvedTruckCount }}</strong><span class="text-[10px] text-[var(--color-text-subtle)]">Camions OK</span>
                </div>
                <div class="p-3 text-center rounded-xl bg-orange-500/8">
                  <strong class="text-xl text-orange-300 block">{{ need.remainingTruckCount }}</strong><span class="text-[10px] text-[var(--color-text-subtle)]">Reste</span>
                </div>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <NeedQuickActions
              :need="{
                reference: need.reference,
                clientName: need.clientName,
                contactName: need.clientContactName,
                loadingLocation: need.loadingLocation,
                destination: need.destination,
                truckType: need.truckType,
                requestedTruckCount: need.requestedTruckCount,
                remainingTruckCount: need.remainingTruckCount,
                tonnageTons: need.tonnageTons,
                cargoType: need.cargoType,
                mobilizationAt: need.mobilizationAt,
              }"
              :phone="need.clientPhone"
            />
          </AppCard>

          <AppCard>
            <h2 class="text-base font-800 m-0">
              Notes et contraintes
            </h2>
            <p class="text-sm text-[var(--color-text-muted)] leading-6 mb-0 mt-4 whitespace-pre-wrap">
              {{ need.constraints || 'Aucune contrainte particulière renseignée.' }}
            </p>
          </AppCard>
        </div>

        <AppCard>
          <h2 class="text-base font-800 m-0">
            Historique d’activité
          </h2>
          <p class="text-xs text-[var(--color-text-muted)] mb-5 mt-1">
            Traçabilité serveur des actions importantes.
          </p>
          <div v-if="auditLogs?.length" class="relative space-y-5 before:bg-[var(--color-border)] before:w-px before:bottom-2 before:left-3.5 before:top-2 before:absolute">
            <div v-for="log in auditLogs" :key="log._id" class="flex gap-3 relative">
              <div class="text-xs text-[var(--color-accent)] border border-[var(--color-border-strong)] rounded-full bg-[var(--color-surface)] flex shrink-0 h-7 w-7 items-center justify-center z-1">
                <span class="i-carbon-checkmark" />
              </div>
              <div>
                <div class="text-sm font-700">
                  {{ auditLabel(log.action) }}
                </div>
                <div class="text-xs text-[var(--color-text-subtle)] mt-1">
                  {{ formatDateTime(log.createdAt) }}
                </div>
                <div class="text-[10px] text-[var(--color-text-subtle)] mt-1 max-w-64 truncate">
                  Acteur : {{ log.actorId }}
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-[var(--color-text-muted)]">
            Aucun événement enregistré.
          </p>
        </AppCard>
      </div>

      <AppModal v-model="editOpen" title="Modifier le besoin" description="Les validations métier seront réappliquées côté Convex.">
        <NeedForm
          v-if="editValues"
          :initial-value="editValues"
          :clients="clients ?? []"
          :loading="loadingAction"
          :show-publish="false"
          @submit="updateNeed"
          @cancel="editOpen = false"
        />
      </AppModal>

      <AppModal v-model="cancelOpen" title="Annuler ce besoin ?" description="Le besoin quittera la liste active, mais restera dans l’historique.">
        <div class="flex gap-2 justify-end">
          <AppButton variant="ghost" @click="cancelOpen = false">
            Conserver
          </AppButton>
          <AppButton variant="danger" :loading="loadingAction" @click="cancelNeed">
            Confirmer l’annulation
          </AppButton>
        </div>
      </AppModal>
    </template>
  </div>
</template>
