<script setup lang="ts">
import type { CarrierOptionFormValues } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { carrierOptionStatusLabels } from '~~/shared/domain'
import { buildPhoneUrl, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const route = useRoute()
const { $convex } = useNuxtApp()
const { organization } = useCurrentOrganization()
const optionId = computed(() => route.params.optionId as Id<'carrierOptions'>)
const optionArgs = computed(() => optionId.value ? { optionId: optionId.value } : null)
const { data: option, isPending, error } = useConvexQuery(api.carrierOptions.getById, optionArgs)
const auditArgs = computed(() => organization.value && option.value
  ? {
      organizationId: organization.value._id,
      entityType: 'carrierOption',
      entityId: option.value._id,
    }
  : null,
)
const { data: auditLogs } = useConvexQuery(api.auditLogs.listForEntity, auditArgs)

const acceptOpen = ref(false)
const negotiateOpen = ref(false)
const refuseOpen = ref(false)
const reviseOpen = ref(false)
const acceptedTruckCount = ref(1)
const decisionNote = ref('')
const loadingAction = ref(false)
const actionError = ref('')
const actionSuccess = ref('')

const canDecide = computed(() =>
  organization.value?.role === 'ORGANIZATION_ADMIN'
  || organization.value?.role === 'OPERATIONS_MANAGER',
)
const maximumAcceptedCount = computed(() => option.value
  ? Math.min(option.value.proposedTruckCount, option.value.needRemainingTruckCount)
  : 1,
)
const reviseValues = computed<CarrierOptionFormValues | undefined>(() => {
  if (!option.value)
    return undefined

  return {
    carrierName: option.value.carrierName,
    carrierPhone: option.value.carrierPhone ?? '',
    carrierEmail: option.value.carrierEmail ?? '',
    truckType: option.value.truckType,
    proposedTruckCount: option.value.proposedTruckCount,
    pricePerTruck: option.value.pricePerTruck,
    availableAt: new Date(option.value.availableAt).toISOString().slice(0, 16),
    paymentTerms: option.value.paymentTerms ?? '',
    documentsConfirmed: option.value.documentsConfirmed,
    notes: option.value.notes ?? '',
  }
})
const carrierMessage = computed(() => option.value
  ? [
      `Bonjour ${option.value.carrierName},`,
      '',
      `Nous revenons vers vous concernant l’option ${option.value.reference} pour le besoin ${option.value.needReference}.`,
      `Trajet : ${option.value.loadingLocation} → ${option.value.destination}`,
      `Proposition : ${option.value.proposedTruckCount} camion(s) à ${formatCurrency(option.value.pricePerTruck)} par camion.`,
      '',
      'Merci de confirmer votre disponibilité.',
      'Équipe Forus CS',
    ].join('\n')
  : '',
)

watch(maximumAcceptedCount, (value) => {
  acceptedTruckCount.value = Math.max(1, value)
}, { immediate: true })

function optionInput(values: CarrierOptionFormValues) {
  return {
    optionId: optionId.value,
    carrierName: values.carrierName,
    carrierPhone: values.carrierPhone || undefined,
    carrierEmail: values.carrierEmail || undefined,
    truckType: values.truckType,
    proposedTruckCount: values.proposedTruckCount,
    pricePerTruck: values.pricePerTruck,
    availableAt: new Date(values.availableAt).getTime(),
    paymentTerms: values.paymentTerms || undefined,
    documentsConfirmed: values.documentsConfirmed,
    notes: values.notes || undefined,
  }
}

async function acceptOption() {
  if (!Number.isInteger(Number(acceptedTruckCount.value))
    || Number(acceptedTruckCount.value) <= 0
    || Number(acceptedTruckCount.value) > maximumAcceptedCount.value) {
    actionError.value = `Saisissez entre 1 et ${maximumAcceptedCount.value} camion(s).`
    return
  }

  await runAction(async () => {
    const missionId = await $convex.mutation(api.carrierOptions.accept, {
      optionId: optionId.value,
      acceptedTruckCount: Number(acceptedTruckCount.value),
      decisionNote: decisionNote.value.trim() || undefined,
    })
    acceptOpen.value = false
    actionSuccess.value = 'Option acceptée : la mission est confirmée et le besoin a été mis à jour.'
    return missionId
  })
}

async function negotiateOption() {
  if (decisionNote.value.trim().length < 2) {
    actionError.value = 'Précisez les éléments à négocier.'
    return
  }

  await runAction(async () => {
    await $convex.mutation(api.carrierOptions.negotiate, {
      optionId: optionId.value,
      decisionNote: decisionNote.value,
    })
    negotiateOpen.value = false
    actionSuccess.value = 'Option renvoyée en négociation.'
  })
}

async function refuseOption() {
  if (decisionNote.value.trim().length < 2) {
    actionError.value = 'Précisez le motif du refus.'
    return
  }

  await runAction(async () => {
    await $convex.mutation(api.carrierOptions.refuse, {
      optionId: optionId.value,
      decisionNote: decisionNote.value,
    })
    refuseOpen.value = false
    actionSuccess.value = 'Option refusée et conservée dans l’historique.'
  })
}

async function reviseOption(values: CarrierOptionFormValues) {
  await runAction(async () => {
    await $convex.mutation(api.carrierOptions.revise, optionInput(values))
    reviseOpen.value = false
    actionSuccess.value = 'Option corrigée et soumise de nouveau à la décision.'
  })
}

async function runAction(action: () => Promise<unknown>) {
  loadingAction.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await action()
    decisionNote.value = ''
  }
  catch {
    actionError.value = 'Action impossible. Vérifiez le statut de l’option et la quantité encore requise.'
  }
  finally {
    loadingAction.value = false
  }
}

function auditLabel(action: string) {
  return {
    SUBMIT: 'Option soumise',
    NEGOTIATE: 'Négociation demandée',
    REVISE: 'Option révisée',
    ACCEPT: 'Option acceptée',
    REFUSE: 'Option refusée',
  }[action] ?? action
}
</script>

<template>
  <div class="page-container">
    <div v-if="isPending" class="space-y-5">
      <AppCard><AppSkeleton :lines="4" /></AppCard>
      <AppCard><AppSkeleton :lines="6" /></AppCard>
    </div>
    <AppEmptyState
      v-else-if="error || !option"
      title="Option introuvable"
      description="Cette option n’existe pas ou n’appartient pas à votre organisation."
      icon="i-carbon-warning-alt"
    >
      <AppButton variant="secondary" @click="navigateTo(`/o/${organization?.slug}/operations/options`)">
        Retour aux options
      </AppButton>
    </AppEmptyState>

    <template v-else>
      <button class="text-xs text-[var(--color-text-muted)] font-700 mb-4 inline-flex gap-2 items-center hover:text-[var(--color-accent)]" @click="navigateTo(`/o/${organization?.slug}/operations/options`)">
        <span class="i-carbon-arrow-left" />
        Retour aux options
      </button>

      <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <AppBadge :tone="carrierOptionStatusTone(option.status)" dot>
            {{ carrierOptionStatusLabels[option.status] }}
          </AppBadge>
          <h1 class="text-2xl font-900 m-0 mt-3 sm:text-3xl">
            {{ option.reference }}
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
            {{ option.carrierName }} · {{ option.needReference }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton v-if="option.status === 'NEGOTIATION'" variant="secondary" @click="reviseOpen = true">
            <template #leading>
              <span class="i-carbon-edit" />
            </template>
            Réviser
          </AppButton>
          <template v-if="canDecide && (option.status === 'PENDING' || option.status === 'NEGOTIATION')">
            <AppButton variant="success" @click="acceptOpen = true">
              <template #leading>
                <span class="i-carbon-checkmark" />
              </template>
              Accepter
            </AppButton>
            <AppButton v-if="option.status === 'PENDING'" variant="secondary" @click="negotiateOpen = true">
              Négocier
            </AppButton>
            <AppButton variant="danger" @click="refuseOpen = true">
              Refuser
            </AppButton>
          </template>
        </div>
      </div>

      <p v-if="actionSuccess" class="text-sm text-green-300 mb-5 px-4 py-3 border border-green-500/25 rounded-xl bg-green-500/10" role="status">
        {{ actionSuccess }}
      </p>
      <p v-if="actionError" class="text-sm text-red-300 mb-5 px-4 py-3 border border-red-500/25 rounded-xl bg-red-500/10" role="alert">
        {{ actionError }}
      </p>

      <div class="gap-5 grid xl:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-5">
          <AppCard>
            <h2 class="text-base font-800 m-0">
              Proposition transporteur
            </h2>
            <dl class="mt-5 gap-x-6 gap-y-5 grid sm:grid-cols-2">
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Transporteur
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ option.carrierName }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Contact
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ option.carrierPhone ? formatPhoneNumber(option.carrierPhone) : 'Non renseigné' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Camions proposés
                </dt><dd class="text-lg font-900 m-0 mt-1">
                  {{ option.proposedTruckCount }} · {{ option.truckType }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Prix par camion
                </dt><dd class="text-lg text-[var(--color-accent)] font-900 m-0 mt-1">
                  {{ formatCurrency(option.pricePerTruck) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Disponibilité
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ formatDateTime(option.availableAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Documents
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ option.documentsConfirmed ? 'Confirmés' : 'À vérifier' }}
                </dd>
              </div>
            </dl>
            <div v-if="option.carrierPhone" class="mt-5 gap-2 grid sm:grid-cols-2">
              <a :href="buildPhoneUrl(option.carrierPhone)" class="text-sm font-800 px-4 py-3 border border-[var(--color-border-strong)] rounded-xl flex gap-2 min-h-11 items-center justify-center hover:border-[var(--color-accent)]">
                <span class="i-carbon-phone-filled text-[var(--color-accent)]" /> Appeler
              </a>
              <a :href="buildWhatsAppUrl(option.carrierPhone, carrierMessage)" target="_blank" rel="noopener noreferrer" class="text-sm text-green-300 font-800 px-4 py-3 border border-green-500/30 rounded-xl bg-green-500/8 flex gap-2 min-h-11 items-center justify-center hover:bg-green-500/15">
                <span class="i-carbon-logo-whatsapp" /> WhatsApp
              </a>
            </div>
          </AppCard>

          <AppCard>
            <h2 class="text-base font-800 m-0">
              Besoin concerné
            </h2>
            <NuxtLink :to="`/o/${organization?.slug}/operations/needs/${option.needId}`" class="mt-4 p-4 rounded-xl bg-[var(--color-bg-deep)] block hover:bg-[var(--color-surface-raised)]">
              <strong class="text-sm">{{ option.needReference }} · {{ option.clientName }}</strong>
              <span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ option.loadingLocation }} → {{ option.destination }}</span>
              <span class="text-xs text-orange-300 font-800 mt-2 block">{{ option.needRemainingTruckCount }} camion(s) encore requis</span>
            </NuxtLink>
          </AppCard>

          <AppCard v-if="option.notes || option.decisionNote">
            <h2 class="text-base font-800 m-0">
              Notes de décision
            </h2>
            <p v-if="option.notes" class="text-sm text-[var(--color-text-muted)] leading-6 mb-0 mt-4 whitespace-pre-wrap">
              {{ option.notes }}
            </p>
            <p v-if="option.decisionNote" class="text-sm text-[var(--color-text)] leading-6 mb-0 mt-4 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] whitespace-pre-wrap">
              {{ option.decisionNote }}
            </p>
          </AppCard>

          <AppCard v-if="option.missionId">
            <div class="flex gap-3 items-center justify-between">
              <div>
                <h2 class="text-base font-800 m-0">
                  Mission créée
                </h2>
                <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
                  {{ option.missionReference }}
                </p>
              </div>
              <AppButton size="sm" @click="navigateTo(`/o/${organization?.slug}/operations/missions`)">
                Voir les missions
              </AppButton>
            </div>
          </AppCard>
        </div>

        <AppCard>
          <h2 class="text-base font-800 m-0">
            Historique de l’option
          </h2>
          <div v-if="auditLogs?.length" class="mt-5 relative space-y-5 before:bg-[var(--color-border)] before:w-px before:bottom-2 before:left-3.5 before:top-2 before:absolute">
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
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-[var(--color-text-muted)] mt-4">
            Aucun événement enregistré.
          </p>
        </AppCard>
      </div>

      <AppModal v-model="acceptOpen" title="Accepter l’option" description="La validation crée immédiatement une mission et met à jour la progression du besoin.">
        <div class="space-y-4">
          <AppFormField label="Camions acceptés" for="accepted-count" :hint="`Maximum ${maximumAcceptedCount}`" required>
            <AppInput id="accepted-count" v-model="acceptedTruckCount" type="number" min="1" :max="maximumAcceptedCount" step="1" />
          </AppFormField>
          <AppFormField label="Note de décision" for="accept-note">
            <AppTextarea id="accept-note" v-model="decisionNote" :rows="3" placeholder="Précision facultative…" />
          </AppFormField>
          <div class="flex gap-2 justify-end">
            <AppButton variant="ghost" @click="acceptOpen = false">
              Annuler
            </AppButton>
            <AppButton variant="success" :loading="loadingAction" @click="acceptOption">
              Confirmer et créer la mission
            </AppButton>
          </div>
        </div>
      </AppModal>

      <AppModal v-model="negotiateOpen" title="Demander une négociation" description="L’option pourra être révisée puis soumise de nouveau.">
        <AppFormField label="Éléments à négocier" for="negotiate-note" required>
          <AppTextarea id="negotiate-note" v-model="decisionNote" :rows="4" placeholder="Prix, quantité, disponibilité…" />
        </AppFormField>
        <div class="mt-4 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="negotiateOpen = false">
            Annuler
          </AppButton>
          <AppButton :loading="loadingAction" @click="negotiateOption">
            Envoyer en négociation
          </AppButton>
        </div>
      </AppModal>

      <AppModal v-model="refuseOpen" title="Refuser l’option" description="L’option restera consultable dans l’historique.">
        <AppFormField label="Motif du refus" for="refuse-note" required>
          <AppTextarea id="refuse-note" v-model="decisionNote" :rows="4" placeholder="Motif opérationnel ou tarifaire…" />
        </AppFormField>
        <div class="mt-4 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="refuseOpen = false">
            Annuler
          </AppButton>
          <AppButton variant="danger" :loading="loadingAction" @click="refuseOption">
            Confirmer le refus
          </AppButton>
        </div>
      </AppModal>

      <AppModal v-model="reviseOpen" title="Réviser l’option" description="Les nouvelles valeurs repasseront au statut À décider.">
        <CarrierOptionForm
          v-if="reviseValues"
          :initial-value="reviseValues"
          :maximum-truck-count="option.needRemainingTruckCount"
          submit-label="Soumettre de nouveau"
          :loading="loadingAction"
          @submit="reviseOption"
          @cancel="reviseOpen = false"
        />
      </AppModal>
    </template>
  </div>
</template>
