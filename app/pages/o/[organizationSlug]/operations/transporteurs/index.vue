<script setup lang="ts">
import type { CarrierFormValues, CarrierSegment } from '~~/shared/domain'
import { splitNormalizedList } from '~~/shared/normalization'
import { buildPhoneUrl, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const { enqueue } = useOfflineMutationQueue()
const { organization } = useCurrentOrganization()
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id, includeInactive: true }
  : null)
const { data: carriers, isPending, error } = useConvexQuery(api.carriers.list, queryArgs)
const search = shallowRef('')
const segment = shallowRef('')
const formOpen = shallowRef(false)
const submitting = shallowRef(false)
const feedback = shallowRef('')
const form = reactive<CarrierFormValues>({
  name: '',
  contactName: '',
  phone: '',
  email: '',
  segment: 'C',
  truckTypes: '',
  destinations: '',
  notes: '',
})

const segmentOptions = [
  { value: '', label: 'Tous les segments' },
  { value: 'A', label: 'A · Actif et fiable' },
  { value: 'B', label: 'B · Actif à développer' },
  { value: 'C', label: 'C · Prospect' },
  { value: 'D', label: 'D · Inactif / suspendu' },
]
const formSegmentOptions = segmentOptions.slice(1)
const filteredCarriers = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  return (carriers.value ?? []).filter(carrier =>
    (!segment.value || carrier.segment === segment.value)
    && (
      !needle
      || [
        carrier.name,
        carrier.contactName,
        carrier.phone,
        ...carrier.truckTypes,
        ...carrier.destinations,
      ].filter(Boolean).some(value => value?.toLocaleLowerCase('fr').includes(needle))
    ))
})
const activeCount = computed(() =>
  (carriers.value ?? []).filter(carrier => carrier.isActive).length)
const availableCount = computed(() =>
  (carriers.value ?? []).reduce((total, carrier) =>
    total + carrier.availableVehicleCount, 0))

async function createCarrier() {
  if (!organization.value || form.name.trim().length < 2 || form.phone.trim().length < 8)
    return

  submitting.value = true
  feedback.value = ''
  try {
    const values = {
      organizationId: organization.value._id,
      idempotencyKey: crypto.randomUUID(),
      name: form.name,
      contactName: form.contactName || undefined,
      phone: form.phone,
      email: form.email || undefined,
      segment: form.segment,
      truckTypes: splitNormalizedList(form.truckTypes),
      destinations: splitNormalizedList(form.destinations),
      notes: form.notes || undefined,
    }
    if (navigator.onLine)
      await $convex.mutation(api.carriers.create, values)
    else
      await enqueue(organization.value._id, 'carriers.create', values)
    feedback.value = navigator.onLine
      ? 'Transporteur ajouté et dédupliqué par téléphone.'
      : 'Transporteur conservé hors ligne et prêt à synchroniser.'
    formOpen.value = false
    Object.assign(form, {
      name: '',
      contactName: '',
      phone: '',
      email: '',
      segment: 'C' as CarrierSegment,
      truckTypes: '',
      destinations: '',
      notes: '',
    })
  }
  catch {
    feedback.value = 'Création impossible : vérifiez le téléphone et les doublons.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p class="text-xs text-[var(--color-accent)] tracking-[0.16em] font-800 mb-1 uppercase">
          CRM réseau transporteurs
        </p>
        <h1 class="text-2xl font-900 m-0 sm:text-3xl">
          Transporteurs
        </h1>
        <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
          Portefeuilles, flotte, conformité, disponibilité et historique d’appels.
        </p>
      </div>
      <AppButton @click="formOpen = true">
        <template #leading>
          <span class="i-carbon-add" />
        </template>
        Ajouter un transporteur
      </AppButton>
    </div>

    <div class="mb-5 gap-3 grid grid-cols-2 lg:grid-cols-4">
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Transporteurs actifs
        </p>
        <strong class="text-2xl font-900 mt-2 block">{{ activeCount }}</strong>
      </AppCard>
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Véhicules disponibles
        </p>
        <strong class="text-2xl text-green-300 font-900 mt-2 block">{{ availableCount }}</strong>
      </AppCard>
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Portefeuille attribué
        </p>
        <strong class="text-2xl font-900 mt-2 block">{{ carriers?.filter(item => item.assignedAgentId).length ?? 0 }}</strong>
      </AppCard>
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Documents conformes
        </p>
        <strong class="text-2xl font-900 mt-2 block">{{ carriers?.filter(item => item.documentsValid).length ?? 0 }}</strong>
      </AppCard>
    </div>

    <p v-if="feedback" class="text-sm mb-4 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]" role="status">
      {{ feedback }}
    </p>

    <AppCard class="mb-5 p-3 sm:p-4">
      <div class="gap-3 grid sm:grid-cols-[1fr_14rem]">
        <div class="relative">
          <span class="i-carbon-search text-[var(--color-text-subtle)] left-3.5 top-1/2 absolute -translate-y-1/2" />
          <AppInput id="carrier-search" v-model="search" class="pl-10" aria-label="Rechercher un transporteur" placeholder="Nom, téléphone, camion ou destination…" />
        </div>
        <AppSelect id="carrier-segment" v-model="segment" :options="segmentOptions" aria-label="Filtrer par segment" />
      </div>
    </AppCard>

    <div v-if="isPending" class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="index in 6" :key="index">
        <AppSkeleton :lines="5" />
      </AppCard>
    </div>
    <p v-else-if="error" class="text-sm text-red-300" role="alert">
      Impossible de charger le CRM transporteurs.
    </p>
    <AppEmptyState
      v-else-if="filteredCarriers.length === 0"
      title="Aucun transporteur"
      description="Ajoutez un transporteur. Le téléphone sert de clé de déduplication dans cette organisation."
      icon="i-carbon-delivery-truck"
    />
    <div v-else class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="carrier in filteredCarriers" :key="carrier._id" :interactive="true">
        <div class="flex gap-3 items-start justify-between">
          <div class="min-w-0">
            <div class="flex gap-2 items-center">
              <span class="text-sm text-[var(--color-bg-deep)] font-900 rounded-lg bg-[var(--color-accent)] flex shrink-0 h-8 w-8 items-center justify-center">
                {{ carrier.segment }}
              </span>
              <div class="min-w-0">
                <h2 class="text-base font-900 m-0 truncate">
                  {{ carrier.name }}
                </h2>
                <p class="text-xs text-[var(--color-text-muted)] m-0 mt-0.5 truncate">
                  {{ carrier.contactName || 'Contact non renseigné' }}
                </p>
              </div>
            </div>
          </div>
          <AppBadge :tone="carrier.isActive ? 'success' : 'danger'" dot>
            {{ carrier.isActive ? 'Actif' : 'Suspendu' }}
          </AppBadge>
        </div>

        <a :href="buildPhoneUrl(carrier.phone)" class="text-sm mt-4 flex gap-2 items-center hover:text-[var(--color-accent)]">
          <span class="i-carbon-phone" /> {{ formatPhoneNumber(carrier.phone) }}
        </a>
        <div class="text-xs text-[var(--color-text-muted)] mt-4 gap-2 grid grid-cols-2">
          <span class="p-2 rounded-lg bg-[var(--color-bg-deep)]">{{ carrier.activeVehicleCount }} véhicule(s)</span>
          <span class="p-2 rounded-lg bg-[var(--color-bg-deep)]">{{ carrier.availableVehicleCount }} disponible(s)</span>
          <span class="p-2 rounded-lg bg-[var(--color-bg-deep)]">{{ carrier.documentsValid ? 'Documents conformes' : 'Documents à revoir' }}</span>
          <span class="p-2 rounded-lg bg-[var(--color-bg-deep)]">{{ carrier.assignedAgentId ? 'Portefeuille attribué' : 'Non attribué' }}</span>
        </div>
        <p v-if="carrier.truckTypes.length" class="text-xs text-[var(--color-text-muted)] mb-0 mt-4 line-clamp-2">
          <strong class="text-[var(--color-text)]">Camions :</strong> {{ carrier.truckTypes.join(', ') }}
        </p>
        <div class="mt-5 gap-2 grid grid-cols-3">
          <NuxtLink :to="`/o/${organization?.slug}/operations/transporteurs/${carrier._id}`" class="text-xs font-800 px-3 py-2 border border-[var(--color-border-strong)] rounded-xl flex min-h-10 items-center justify-center hover:border-[var(--color-accent)]">
            Ouvrir
          </NuxtLink>
          <a :href="buildPhoneUrl(carrier.phone)" class="text-xs font-800 px-3 py-2 border border-[var(--color-border-strong)] rounded-xl flex min-h-10 items-center justify-center">
            Appeler
          </a>
          <a :href="buildWhatsAppUrl(carrier.phone, `Bonjour ${carrier.contactName || carrier.name},\\n\\nFORUS souhaite mettre à jour votre disponibilité.`)" target="_blank" rel="noopener noreferrer" class="text-xs text-green-300 font-800 px-3 py-2 border border-green-500/30 rounded-xl flex min-h-10 items-center justify-center">
            WhatsApp
          </a>
        </div>
      </AppCard>
    </div>

    <AppModal v-model="formOpen" title="Ajouter un transporteur" description="Le numéro est contrôlé pour éviter les doublons dans l’organisation.">
      <form class="space-y-4" @submit.prevent="createCarrier">
        <div class="gap-4 grid sm:grid-cols-2">
          <AppFormField label="Nom / société" for="carrier-name" required>
            <AppInput id="carrier-name" v-model="form.name" autocomplete="organization" required />
          </AppFormField>
          <AppFormField label="Contact" for="carrier-contact">
            <AppInput id="carrier-contact" v-model="form.contactName" autocomplete="name" />
          </AppFormField>
          <AppFormField label="Téléphone" for="carrier-phone" required>
            <AppInput id="carrier-phone" v-model="form.phone" type="tel" autocomplete="tel" placeholder="+225…" required />
          </AppFormField>
          <AppFormField label="E-mail" for="carrier-email">
            <AppInput id="carrier-email" v-model="form.email" type="email" />
          </AppFormField>
          <AppFormField label="Segment" for="carrier-segment-form">
            <AppSelect id="carrier-segment-form" v-model="form.segment" :options="formSegmentOptions" />
          </AppFormField>
          <AppFormField label="Types de camions" for="carrier-trucks" hint="Séparés par des virgules">
            <AppInput id="carrier-trucks" v-model="form.truckTypes" placeholder="Porteur, Semi-remorque" />
          </AppFormField>
        </div>
        <AppFormField label="Destinations habituelles" for="carrier-destinations" hint="Séparées par des virgules">
          <AppInput id="carrier-destinations" v-model="form.destinations" placeholder="Bouaké, Korhogo, San-Pédro" />
        </AppFormField>
        <AppFormField label="Notes" for="carrier-notes">
          <AppTextarea id="carrier-notes" v-model="form.notes" :rows="3" />
        </AppFormField>
        <div class="pt-2 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="formOpen = false">
            Annuler
          </AppButton>
          <AppButton type="submit" :loading="submitting">
            Ajouter
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
