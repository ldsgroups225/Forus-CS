<script setup lang="ts">
import type { CallOutcome, CarrierFormValues } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { callOutcomeLabels, carrierAvailabilityStatusLabels } from '~~/shared/domain'
import { splitNormalizedList } from '~~/shared/normalization'
import { buildPhoneUrl, formatDateTime, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

type Action = 'edit' | 'vehicle' | 'document' | 'availability' | 'call' | 'assign' | null

const route = useRoute()
const { $convex } = useNuxtApp()
const { enqueue } = useOfflineMutationQueue()
const { organization } = useCurrentOrganization()
const carrierId = computed(() => route.params.carrierId as Id<'carriers'>)
const carrierArgs = computed(() => carrierId.value ? { carrierId: carrierId.value } : null)
const organizationArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null)
const { data: carrier, isPending, error } = useConvexQuery(api.carriers.getById, carrierArgs)
const { data: vehicles } = useConvexQuery(api.vehicles.listForCarrier, carrierArgs)
const { data: documents } = useConvexQuery(api.carrierAssets.listDocuments, carrierArgs)
const { data: availabilities } = useConvexQuery(api.carrierAssets.listAvailabilities, carrierArgs)
const { data: drivers } = useConvexQuery(api.drivers.listForCarrier, carrierArgs)
const { data: needs } = useConvexQuery(api.needs.listActive, organizationArgs)
const { data: calls } = useConvexQuery(api.calls.listRecent, computed(() =>
  organization.value ? { organizationId: organization.value._id, limit: 100 } : null))
const { data: followUps } = useConvexQuery(api.calls.listFollowUps, organizationArgs)
const canManageTeam = computed(() =>
  organization.value?.role === 'ORGANIZATION_ADMIN'
  || organization.value?.role === 'OPERATIONS_MANAGER'
  || organization.value?.role === 'SUPERVISOR')
const { data: members } = useConvexQuery(api.memberships.list, computed(() =>
  organization.value && canManageTeam.value
    ? { organizationId: organization.value._id }
    : null))

const action = shallowRef<Action>(null)
const modalOpen = computed({
  get: () => action.value !== null,
  set: (open) => {
    if (!open)
      action.value = null
  },
})
const submitting = shallowRef(false)
const feedback = shallowRef('')

const editForm = reactive<CarrierFormValues>({
  name: '',
  contactName: '',
  phone: '',
  email: '',
  segment: 'C',
  truckTypes: '',
  destinations: '',
  notes: '',
})
const vehicleForm = reactive({
  registration: '',
  truckType: '',
  capacityTons: 1,
})
const documentForm = reactive({
  vehicleId: '',
  type: '',
  label: '',
  expiresAt: '',
  isVerified: false,
})
const availabilityForm = reactive({
  vehicleId: '',
  status: 'AVAILABLE',
  location: '',
  availableFrom: localDateTime(Date.now()),
  availableUntil: '',
  notes: '',
})
const callForm = reactive({
  needId: '',
  outcome: 'AVAILABLE' as CallOutcome,
  notes: '',
  followUpAt: '',
})
const assignmentAgentId = shallowRef('')

const modalTitle = computed(() => ({
  edit: 'Modifier le transporteur',
  vehicle: 'Ajouter un véhicule',
  document: 'Ajouter un document',
  availability: 'Mettre à jour la disponibilité',
  call: 'Enregistrer le résultat d’appel',
  assign: 'Attribuer le portefeuille',
}[action.value ?? 'edit']))
const vehicleOptions = computed(() => [
  { value: '', label: 'Ensemble de la flotte' },
  ...(vehicles.value ?? []).map(vehicle => ({
    value: vehicle._id,
    label: `${vehicle.registration} · ${vehicle.truckType}`,
  })),
])
const needOptions = computed(() => [
  { value: '', label: 'Aucun besoin lié' },
  ...(needs.value ?? []).map(need => ({
    value: need._id,
    label: `${need.reference} · ${need.destination}`,
  })),
])
const agentOptions = computed(() =>
  (members.value ?? [])
    .filter(member => member.isActive && member.role === 'AGENT')
    .map(member => ({
      value: member.userId,
      label: member.displayName ?? member.email ?? member.userId,
    })))
const carrierCalls = computed(() =>
  (calls.value ?? []).filter(call => call.carrierId === carrierId.value))
const carrierFollowUps = computed(() =>
  (followUps.value ?? []).filter(followUp => followUp.carrierId === carrierId.value))

function localDateTime(timestamp: number) {
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000)
  return date.toISOString().slice(0, 16)
}

function openEdit() {
  if (!carrier.value)
    return
  Object.assign(editForm, {
    name: carrier.value.name,
    contactName: carrier.value.contactName ?? '',
    phone: carrier.value.phone,
    email: carrier.value.email ?? '',
    segment: carrier.value.segment,
    truckTypes: carrier.value.truckTypes.join(', '),
    destinations: carrier.value.destinations.join(', '),
    notes: carrier.value.notes ?? '',
  })
  action.value = 'edit'
}

async function submitAction() {
  if (!organization.value || !carrier.value || !action.value)
    return

  submitting.value = true
  feedback.value = ''
  try {
    if (action.value === 'edit') {
      await $convex.mutation(api.carriers.update, {
        carrierId: carrierId.value,
        name: editForm.name,
        contactName: editForm.contactName || undefined,
        phone: editForm.phone,
        email: editForm.email || undefined,
        segment: editForm.segment,
        truckTypes: splitNormalizedList(editForm.truckTypes),
        destinations: splitNormalizedList(editForm.destinations),
        notes: editForm.notes || undefined,
      })
    }
    else if (action.value === 'vehicle') {
      await $convex.mutation(api.vehicles.create, {
        carrierId: carrierId.value,
        registration: vehicleForm.registration,
        truckType: vehicleForm.truckType,
        capacityTons: Number(vehicleForm.capacityTons),
      })
    }
    else if (action.value === 'document') {
      await $convex.mutation(api.carrierAssets.addDocument, {
        carrierId: carrierId.value,
        vehicleId: documentForm.vehicleId
          ? documentForm.vehicleId as Id<'vehicles'>
          : undefined,
        type: documentForm.type,
        label: documentForm.label,
        expiresAt: documentForm.expiresAt
          ? new Date(documentForm.expiresAt).getTime()
          : undefined,
        isVerified: documentForm.isVerified,
      })
    }
    else if (action.value === 'availability') {
      await $convex.mutation(api.carrierAssets.setAvailability, {
        carrierId: carrierId.value,
        vehicleId: availabilityForm.vehicleId
          ? availabilityForm.vehicleId as Id<'vehicles'>
          : undefined,
        status: availabilityForm.status as 'AVAILABLE' | 'RESERVED' | 'UNAVAILABLE',
        location: availabilityForm.location,
        availableFrom: new Date(availabilityForm.availableFrom).getTime(),
        availableUntil: availabilityForm.availableUntil
          ? new Date(availabilityForm.availableUntil).getTime()
          : undefined,
        notes: availabilityForm.notes || undefined,
      })
    }
    else if (action.value === 'call') {
      const idempotencyKey = crypto.randomUUID()
      const callValues = {
        organizationId: organization.value._id,
        carrierId: carrierId.value,
        needId: callForm.needId ? callForm.needId as Id<'needs'> : undefined,
        direction: 'OUTBOUND' as const,
        outcome: callForm.outcome,
        phone: carrier.value.phone,
        notes: callForm.notes || undefined,
        idempotencyKey,
      }
      if (navigator.onLine)
        await $convex.mutation(api.calls.log, callValues)
      else
        await enqueue(organization.value._id, 'calls.log', callValues)
      if (callForm.followUpAt) {
        const followUpValues = {
          organizationId: organization.value._id,
          carrierId: carrierId.value,
          needId: callForm.needId ? callForm.needId as Id<'needs'> : undefined,
          dueAt: new Date(callForm.followUpAt).getTime(),
          notes: callForm.notes || 'Relancer le transporteur',
          idempotencyKey: `${idempotencyKey}-follow-up`,
        }
        if (navigator.onLine)
          await $convex.mutation(api.calls.createFollowUp, followUpValues)
        else
          await enqueue(organization.value._id, 'calls.createFollowUp', followUpValues)
      }
    }
    else if (action.value === 'assign') {
      if (assignmentAgentId.value) {
        await $convex.mutation(api.portfolios.assign, {
          carrierId: carrierId.value,
          agentId: assignmentAgentId.value,
        })
      }
      else {
        await $convex.mutation(api.portfolios.unassign, { carrierId: carrierId.value })
      }
    }
    feedback.value = 'Modification enregistrée et auditée.'
    action.value = null
  }
  catch {
    feedback.value = 'Action impossible. Vérifiez les champs et vos autorisations.'
  }
  finally {
    submitting.value = false
  }
}

async function completeFollowUp(followUpId: Id<'followUps'>) {
  await $convex.mutation(api.calls.completeFollowUp, {
    followUpId,
    status: 'COMPLETED',
  })
  feedback.value = 'Relance terminée.'
}
</script>

<template>
  <div class="page-container">
    <div v-if="isPending" class="space-y-5">
      <AppCard><AppSkeleton :lines="5" /></AppCard>
      <AppCard><AppSkeleton :lines="6" /></AppCard>
    </div>
    <AppEmptyState
      v-else-if="error || !carrier"
      title="Transporteur introuvable"
      description="Ce transporteur n’existe pas ou n’appartient pas à cette organisation."
      icon="i-carbon-warning-alt"
    />
    <template v-else>
      <button class="text-xs text-[var(--color-text-muted)] font-700 mb-4 flex gap-2 items-center hover:text-[var(--color-accent)]" @click="navigateTo(`/o/${organization?.slug}/operations/transporteurs`)">
        <span class="i-carbon-arrow-left" /> Retour aux transporteurs
      </button>

      <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="flex gap-3 items-start">
          <span class="text-lg text-[var(--color-bg-deep)] font-900 rounded-xl bg-[var(--color-accent)] flex h-11 w-11 items-center justify-center">
            {{ carrier.segment }}
          </span>
          <div>
            <h1 class="text-2xl font-900 m-0 sm:text-3xl">
              {{ carrier.name }}
            </h1>
            <p class="text-sm text-[var(--color-text-muted)] m-0 mt-1">
              {{ carrier.contactName || 'Contact non renseigné' }} · {{ formatPhoneNumber(carrier.phone) }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton variant="secondary" @click="openEdit">
            Modifier
          </AppButton>
          <AppButton variant="secondary" @click="action = 'call'">
            <template #leading>
              <span class="i-carbon-phone" />
            </template>
            Journaliser un appel
          </AppButton>
          <AppButton v-if="canManageTeam" variant="secondary" @click="action = 'assign'">
            Portefeuille
          </AppButton>
        </div>
      </div>

      <p v-if="feedback" class="text-sm mb-5 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]" role="status">
        {{ feedback }}
      </p>

      <div class="gap-5 grid xl:grid-cols-[1.25fr_0.75fr]">
        <div class="space-y-5">
          <AppCard>
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-base font-900 m-0">
                  Fiche transporteur
                </h2>
                <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
                  Qualification, axes et communication rapide.
                </p>
              </div>
              <AppBadge :tone="carrier.documentsValid ? 'success' : 'warning'" dot>
                {{ carrier.documentsValid ? 'Conforme' : 'À vérifier' }}
              </AppBadge>
            </div>
            <dl class="mt-5 gap-4 grid sm:grid-cols-2">
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Camions
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ carrier.truckTypes.join(', ') || 'Non renseigné' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Destinations
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ carrier.destinations.join(', ') || 'Non renseigné' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Portefeuille
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ carrier.assignedAgentId || carrier.sourcePortfolio || 'Non attribué' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  E-mail
                </dt><dd class="text-sm font-700 m-0 mt-1">
                  {{ carrier.email || 'Non renseigné' }}
                </dd>
              </div>
            </dl>
            <div class="mt-5 gap-2 grid sm:grid-cols-2">
              <a :href="buildPhoneUrl(carrier.phone)" class="text-sm font-800 px-4 py-3 border border-[var(--color-border-strong)] rounded-xl flex gap-2 min-h-11 items-center justify-center">
                <span class="i-carbon-phone-filled text-[var(--color-accent)]" /> Appeler maintenant
              </a>
              <a :href="buildWhatsAppUrl(carrier.phone, `Bonjour ${carrier.contactName || carrier.name},\\n\\nFORUS souhaite mettre à jour vos disponibilités, positions et destinations.`)" target="_blank" rel="noopener noreferrer" class="text-sm text-green-300 font-800 px-4 py-3 border border-green-500/30 rounded-xl flex gap-2 min-h-11 items-center justify-center">
                <span class="i-carbon-logo-whatsapp" /> Conversation WhatsApp
              </a>
            </div>
          </AppCard>

          <AppCard>
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 class="text-base font-900 m-0">
                  Véhicules
                </h2><p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
                  Déduplication par immatriculation dans le tenant.
                </p>
              </div>
              <AppButton size="sm" variant="secondary" @click="action = 'vehicle'">
                Ajouter
              </AppButton>
            </div>
            <AppEmptyState v-if="!vehicles?.length" title="Aucun véhicule" description="Ajoutez la flotte connue de ce transporteur." icon="i-carbon-delivery-truck" />
            <div v-else class="space-y-2">
              <div v-for="vehicle in vehicles" :key="vehicle._id" class="text-sm p-3 rounded-xl bg-[var(--color-bg-deep)] flex gap-3 items-center justify-between">
                <div><strong>{{ vehicle.registration }}</strong><span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ vehicle.truckType }} · {{ formatNumber(vehicle.capacityTons) }} t</span></div>
                <AppBadge :tone="vehicle.isActive ? 'success' : 'neutral'" dot>
                  {{ vehicle.isActive ? 'Actif' : 'Inactif' }}
                </AppBadge>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div class="mb-4">
              <h2 class="text-base font-900 m-0">
                Chauffeurs
              </h2>
              <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
                Registre importé et rattaché au transporteur.
              </p>
            </div>
            <p v-if="!drivers?.length" class="text-sm text-[var(--color-text-muted)] m-0">
              Aucun chauffeur rattaché.
            </p>
            <div v-else class="space-y-2">
              <div v-for="driver in drivers.slice(0, 10)" :key="driver._id" class="text-sm p-3 rounded-xl bg-[var(--color-bg-deep)] flex gap-3 items-center justify-between">
                <div><strong>{{ driver.name }}</strong><span v-if="driver.phone" class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ formatPhoneNumber(driver.phone) }}</span></div>
                <AppBadge :tone="driver.isActive && !driver.isArchived ? 'success' : 'neutral'" dot>
                  {{ driver.isActive && !driver.isArchived ? 'Actif' : 'Archivé' }}
                </AppBadge>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 class="text-base font-900 m-0">
                  Documents
                </h2><p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
                  Assurance, carte grise, visite technique et autorisations.
                </p>
              </div>
              <AppButton size="sm" variant="secondary" @click="action = 'document'">
                Ajouter
              </AppButton>
            </div>
            <AppEmptyState v-if="!documents?.length" title="Aucun document" description="Les documents doivent être vérifiés par un responsable." icon="i-carbon-document" />
            <div v-else class="space-y-2">
              <div v-for="document in documents" :key="document._id" class="text-sm p-3 rounded-xl bg-[var(--color-bg-deep)] flex gap-3 items-center justify-between">
                <div><strong>{{ document.label }}</strong><span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ document.type }}<template v-if="document.expiresAt"> · expire {{ formatDateTime(document.expiresAt) }}</template></span></div>
                <AppBadge :tone="document.isVerified ? 'success' : 'warning'" dot>
                  {{ document.isVerified ? 'Vérifié' : 'À vérifier' }}
                </AppBadge>
              </div>
            </div>
          </AppCard>
        </div>

        <div class="space-y-5">
          <AppCard>
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-base font-900 m-0">
                Disponibilités
              </h2>
              <AppButton size="sm" variant="secondary" @click="action = 'availability'">
                Mettre à jour
              </AppButton>
            </div>
            <p v-if="!availabilities?.length" class="text-sm text-[var(--color-text-muted)] m-0">
              Aucune disponibilité enregistrée.
            </p>
            <div v-else class="space-y-2">
              <div v-for="availability in availabilities.slice(0, 5)" :key="availability._id" class="text-xs p-3 rounded-xl bg-[var(--color-bg-deep)]">
                <div class="flex gap-2 justify-between">
                  <strong>{{ carrierAvailabilityStatusLabels[availability.status] }}</strong><span>{{ availability.location }}</span>
                </div>
                <span class="text-[var(--color-text-muted)] mt-1 block">{{ formatDateTime(availability.availableFrom) }}</span>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <h2 class="text-base font-900 m-0">
              Relances à faire
            </h2>
            <p v-if="!carrierFollowUps.length" class="text-sm text-[var(--color-text-muted)] mb-0 mt-3">
              Aucune relance en attente.
            </p>
            <div v-else class="mt-3 space-y-2">
              <div v-for="followUp in carrierFollowUps" :key="followUp._id" class="text-xs p-3 border border-orange-500/20 rounded-xl bg-orange-500/8">
                <strong>{{ formatDateTime(followUp.dueAt) }}</strong>
                <p class="text-[var(--color-text-muted)] my-2">
                  {{ followUp.notes }}
                </p>
                <AppButton size="sm" variant="success" @click="completeFollowUp(followUp._id)">
                  Terminée
                </AppButton>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <h2 class="text-base font-900 m-0">
              Derniers appels
            </h2>
            <p v-if="!carrierCalls.length" class="text-sm text-[var(--color-text-muted)] mb-0 mt-3">
              Aucun appel journalisé.
            </p>
            <div v-else class="mt-3 space-y-2">
              <div v-for="call in carrierCalls.slice(0, 8)" :key="call._id" class="text-xs p-3 rounded-xl bg-[var(--color-bg-deep)]">
                <div class="flex gap-2 justify-between">
                  <strong>{{ callOutcomeLabels[call.outcome] }}</strong><span class="text-[var(--color-text-muted)]">{{ formatDateTime(call.calledAt) }}</span>
                </div>
                <p v-if="call.notes" class="text-[var(--color-text-muted)] mb-0 mt-2">
                  {{ call.notes }}
                </p>
              </div>
            </div>
          </AppCard>
        </div>
      </div>

      <AppModal v-model="modalOpen" :title="modalTitle">
        <form class="space-y-4" @submit.prevent="submitAction">
          <template v-if="action === 'edit'">
            <div class="gap-4 grid sm:grid-cols-2">
              <AppFormField label="Nom / société" for="edit-carrier-name">
                <AppInput id="edit-carrier-name" v-model="editForm.name" required />
              </AppFormField>
              <AppFormField label="Contact" for="edit-carrier-contact">
                <AppInput id="edit-carrier-contact" v-model="editForm.contactName" />
              </AppFormField>
              <AppFormField label="Téléphone" for="edit-carrier-phone">
                <AppInput id="edit-carrier-phone" v-model="editForm.phone" type="tel" required />
              </AppFormField>
              <AppFormField label="E-mail" for="edit-carrier-email">
                <AppInput id="edit-carrier-email" v-model="editForm.email" type="email" />
              </AppFormField>
              <AppFormField label="Segment" for="edit-carrier-segment">
                <AppSelect id="edit-carrier-segment" v-model="editForm.segment" :options="[{ value: 'A', label: 'A · Actif et fiable' }, { value: 'B', label: 'B · À développer' }, { value: 'C', label: 'C · Prospect' }, { value: 'D', label: 'D · Suspendu' }]" />
              </AppFormField>
              <AppFormField label="Types de camions" for="edit-carrier-trucks">
                <AppInput id="edit-carrier-trucks" v-model="editForm.truckTypes" />
              </AppFormField>
            </div>
            <AppFormField label="Destinations" for="edit-carrier-destinations">
              <AppInput id="edit-carrier-destinations" v-model="editForm.destinations" />
            </AppFormField>
            <AppFormField label="Notes" for="edit-carrier-notes">
              <AppTextarea id="edit-carrier-notes" v-model="editForm.notes" :rows="3" />
            </AppFormField>
          </template>
          <template v-else-if="action === 'vehicle'">
            <AppFormField label="Immatriculation" for="vehicle-registration" required>
              <AppInput id="vehicle-registration" v-model="vehicleForm.registration" placeholder="AB-123-CD-01" required />
            </AppFormField>
            <div class="gap-4 grid sm:grid-cols-2">
              <AppFormField label="Type" for="vehicle-type" required>
                <AppInput id="vehicle-type" v-model="vehicleForm.truckType" required />
              </AppFormField>
              <AppFormField label="Capacité (t)" for="vehicle-capacity" required>
                <AppInput id="vehicle-capacity" v-model="vehicleForm.capacityTons" type="number" min="0.1" step="0.1" required />
              </AppFormField>
            </div>
          </template>
          <template v-else-if="action === 'document'">
            <AppFormField label="Véhicule concerné" for="document-vehicle">
              <AppSelect id="document-vehicle" v-model="documentForm.vehicleId" :options="vehicleOptions" />
            </AppFormField>
            <div class="gap-4 grid sm:grid-cols-2">
              <AppFormField label="Type" for="document-type" required>
                <AppInput id="document-type" v-model="documentForm.type" placeholder="Assurance" required />
              </AppFormField>
              <AppFormField label="Libellé" for="document-label" required>
                <AppInput id="document-label" v-model="documentForm.label" placeholder="Assurance 2026" required />
              </AppFormField>
              <AppFormField label="Expiration" for="document-expiry">
                <AppInput id="document-expiry" v-model="documentForm.expiresAt" type="date" />
              </AppFormField>
              <AppFormField label="Contrôle">
                <label class="text-sm px-3 py-2 border border-[var(--color-border)] rounded-xl flex gap-2 min-h-11 items-center"><input v-model="documentForm.isVerified" type="checkbox"> Document vérifié</label>
              </AppFormField>
            </div>
          </template>
          <template v-else-if="action === 'availability'">
            <AppFormField label="Véhicule" for="availability-vehicle">
              <AppSelect id="availability-vehicle" v-model="availabilityForm.vehicleId" :options="vehicleOptions" />
            </AppFormField>
            <div class="gap-4 grid sm:grid-cols-2">
              <AppFormField label="Statut" for="availability-status">
                <AppSelect id="availability-status" v-model="availabilityForm.status" :options="[{ value: 'AVAILABLE', label: 'Disponible' }, { value: 'RESERVED', label: 'Réservé' }, { value: 'UNAVAILABLE', label: 'Indisponible' }]" />
              </AppFormField>
              <AppFormField label="Position" for="availability-location">
                <AppInput id="availability-location" v-model="availabilityForm.location" required />
              </AppFormField>
              <AppFormField label="Disponible à partir de" for="availability-from">
                <AppInput id="availability-from" v-model="availabilityForm.availableFrom" type="datetime-local" required />
              </AppFormField>
              <AppFormField label="Jusqu’au" for="availability-until">
                <AppInput id="availability-until" v-model="availabilityForm.availableUntil" type="datetime-local" />
              </AppFormField>
            </div>
            <AppFormField label="Notes" for="availability-notes">
              <AppTextarea id="availability-notes" v-model="availabilityForm.notes" :rows="3" />
            </AppFormField>
          </template>
          <template v-else-if="action === 'call'">
            <AppFormField label="Besoin concerné" for="call-need">
              <AppSelect id="call-need" v-model="callForm.needId" :options="needOptions" />
            </AppFormField>
            <AppFormField label="Résultat" for="call-outcome">
              <AppSelect id="call-outcome" v-model="callForm.outcome" :options="Object.entries(callOutcomeLabels).map(([value, label]) => ({ value, label }))" />
            </AppFormField>
            <AppFormField label="Compte rendu" for="call-notes">
              <AppTextarea id="call-notes" v-model="callForm.notes" :rows="4" />
            </AppFormField>
            <AppFormField label="Créer une relance" for="call-follow-up">
              <AppInput id="call-follow-up" v-model="callForm.followUpAt" type="datetime-local" />
            </AppFormField>
          </template>
          <template v-else-if="action === 'assign'">
            <AppFormField label="Agent responsable" for="assignment-agent" hint="Laissez vide pour retirer l’attribution.">
              <AppSelect id="assignment-agent" v-model="assignmentAgentId" :options="[{ value: '', label: 'Non attribué' }, ...agentOptions]" />
            </AppFormField>
            <p class="text-xs text-[var(--color-text-muted)]">
              Un transporteur ne peut appartenir qu’à un seul portefeuille. La capacité maximale est de 100 transporteurs par agent.
            </p>
          </template>
          <div class="pt-2 flex gap-2 justify-end">
            <AppButton variant="ghost" @click="action = null">
              Annuler
            </AppButton>
            <AppButton type="submit" :loading="submitting">
              Enregistrer
            </AppButton>
          </div>
        </form>
      </AppModal>
    </template>
  </div>
</template>
