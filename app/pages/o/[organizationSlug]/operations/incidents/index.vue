<script setup lang="ts">
import type { IncidentFormValues, IncidentSeverity } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import {
  incidentSeverityLabels,
  incidentStatusLabels,
} from '~~/shared/domain'
import { formatDateTime } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const { enqueue } = useOfflineMutationQueue()
const { organization } = useCurrentOrganization()
const organizationArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null)
const { data: incidents, isPending, error } = useConvexQuery(api.incidents.list, organizationArgs)
const { data: needs } = useConvexQuery(api.needs.listAll, organizationArgs)
const { data: missions } = useConvexQuery(api.missions.listForOrganization, organizationArgs)
const canManage = computed(() =>
  organization.value?.role !== 'AGENT')
const { data: members } = useConvexQuery(api.memberships.list, computed(() =>
  organization.value && canManage.value
    ? { organizationId: organization.value._id }
    : null))
const formOpen = shallowRef(false)
const actionOpen = shallowRef(false)
const selectedIncident = shallowRef<NonNullable<typeof incidents.value>[number]>()
const submitting = shallowRef(false)
const feedback = shallowRef('')
const search = shallowRef('')
const status = shallowRef('')
const form = reactive<IncidentFormValues>({
  title: '',
  description: '',
  severity: 'MEDIUM',
  missionId: '',
  needId: '',
  assignedTo: '',
})
const actionForm = reactive({
  status: 'IN_PROGRESS',
  resolution: '',
  assignedTo: '',
})

const severityOptions = Object.entries(incidentSeverityLabels)
  .map(([value, label]) => ({ value, label }))
const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  ...Object.entries(incidentStatusLabels).map(([value, label]) => ({ value, label })),
]
const missionOptions = computed(() => [
  { value: '', label: 'Aucune mission liée' },
  ...(missions.value ?? []).map(mission => ({
    value: mission._id,
    label: `${mission.reference} · ${mission.destination}`,
  })),
])
const needOptions = computed(() => [
  { value: '', label: 'Aucun besoin lié' },
  ...(needs.value ?? []).map(need => ({
    value: need._id,
    label: `${need.reference} · ${need.destination}`,
  })),
])
const memberOptions = computed(() => [
  { value: '', label: 'Non affecté' },
  ...(members.value ?? []).filter(member => member.isActive).map(member => ({
    value: member.userId,
    label: member.displayName ?? member.email ?? member.userId,
  })),
])
const filteredIncidents = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  return (incidents.value ?? []).filter(incident =>
    (!status.value || incident.status === status.value)
    && (
      !needle
      || incident.reference.toLocaleLowerCase('fr').includes(needle)
      || incident.title.toLocaleLowerCase('fr').includes(needle)
      || incident.needReference?.toLocaleLowerCase('fr').includes(needle)
      || incident.missionReference?.toLocaleLowerCase('fr').includes(needle)
    ))
})
const openCount = computed(() =>
  (incidents.value ?? []).filter(incident =>
    incident.status === 'OPEN' || incident.status === 'IN_PROGRESS').length)
const criticalCount = computed(() =>
  (incidents.value ?? []).filter(incident =>
    incident.severity === 'CRITICAL'
    && incident.status !== 'CLOSED').length)

watch(
  () => form.missionId,
  (missionId) => {
    if (!missionId)
      return
    const mission = missions.value?.find(item => item._id === missionId)
    if (mission)
      form.needId = mission.needId
  },
)

function severityTone(severity: IncidentSeverity) {
  return {
    LOW: 'neutral',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'danger',
  }[severity] as 'neutral' | 'info' | 'warning' | 'danger'
}

async function createIncident() {
  if (!organization.value)
    return

  submitting.value = true
  feedback.value = ''
  try {
    const values = {
      organizationId: organization.value._id,
      needId: form.needId ? form.needId as Id<'needs'> : undefined,
      missionId: form.missionId ? form.missionId as Id<'missions'> : undefined,
      title: form.title,
      description: form.description,
      severity: form.severity,
      assignedTo: form.assignedTo || undefined,
      idempotencyKey: crypto.randomUUID(),
    }
    if (navigator.onLine)
      await $convex.mutation(api.incidents.create, values)
    else
      await enqueue(organization.value._id, 'incidents.create', values)
    feedback.value = navigator.onLine
      ? 'Incident créé, notifié et inscrit dans l’audit.'
      : 'Incident conservé hors ligne et prêt à synchroniser.'
    formOpen.value = false
    Object.assign(form, {
      title: '',
      description: '',
      severity: 'MEDIUM',
      missionId: '',
      needId: '',
      assignedTo: '',
    })
  }
  catch {
    feedback.value = 'Création impossible. Vérifiez la mission, le besoin et les champs requis.'
  }
  finally {
    submitting.value = false
  }
}

function openAction(incident: NonNullable<typeof incidents.value>[number]) {
  selectedIncident.value = incident
  Object.assign(actionForm, {
    status: incident.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED',
    resolution: incident.resolution ?? '',
    assignedTo: incident.assignedTo ?? '',
  })
  actionOpen.value = true
}

async function updateIncident() {
  if (!selectedIncident.value)
    return

  submitting.value = true
  try {
    await $convex.mutation(api.incidents.updateStatus, {
      incidentId: selectedIncident.value._id,
      status: actionForm.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      resolution: actionForm.resolution || undefined,
      assignedTo: actionForm.assignedTo || undefined,
    })
    feedback.value = 'Incident mis à jour.'
    actionOpen.value = false
  }
  catch {
    feedback.value = 'Transition refusée ou résolution manquante.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Incidents" description="Déclaration, affectation, résolution et traçabilité des aléas opérationnels.">
      <template #actions>
        <AppButton @click="formOpen = true">
          <template #leading>
            <span class="i-carbon-warning-alt" />
          </template>
          Déclarer un incident
        </AppButton>
      </template>
    </AppPageHeader>

    <div class="mb-5 gap-3 grid grid-cols-2 lg:grid-cols-4">
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Ouverts
        </p><strong class="text-2xl font-900 mt-2 block">{{ openCount }}</strong>
      </AppCard>
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Critiques
        </p><strong class="text-2xl text-red-300 font-900 mt-2 block">{{ criticalCount }}</strong>
      </AppCard>
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Résolus
        </p><strong class="text-2xl text-green-300 font-900 mt-2 block">{{ incidents?.filter(item => item.status === 'RESOLVED').length ?? 0 }}</strong>
      </AppCard>
      <AppCard>
        <p class="text-xs text-[var(--color-text-muted)] m-0">
          Total historique
        </p><strong class="text-2xl font-900 mt-2 block">{{ incidents?.length ?? 0 }}</strong>
      </AppCard>
    </div>

    <p v-if="feedback" class="text-sm mb-4 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]" role="status">
      {{ feedback }}
    </p>

    <AppCard class="mb-5 p-3 sm:p-4">
      <div class="gap-3 grid sm:grid-cols-[1fr_14rem]">
        <AppInput id="incident-search" v-model="search" aria-label="Rechercher un incident" placeholder="Référence, titre, besoin ou mission…" />
        <AppSelect id="incident-status" v-model="status" :options="statusOptions" aria-label="Filtrer par statut" />
      </div>
    </AppCard>

    <div v-if="isPending" class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="index in 6" :key="index">
        <AppSkeleton :lines="5" />
      </AppCard>
    </div>
    <p v-else-if="error" class="text-sm text-red-300" role="alert">
      Impossible de charger les incidents.
    </p>
    <AppEmptyState v-else-if="filteredIncidents.length === 0" title="Aucun incident" description="Les incidents déclarés resteront dans l’historique et l’audit." icon="i-carbon-checkmark-outline" />
    <div v-else class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="incident in filteredIncidents" :key="incident._id" :interactive="true">
        <div class="flex gap-3 items-start justify-between">
          <div>
            <strong class="text-sm">{{ incident.reference }}</strong>
            <h2 class="text-base font-900 m-0 mt-2">
              {{ incident.title }}
            </h2>
          </div>
          <AppBadge :tone="severityTone(incident.severity)" dot>
            {{ incidentSeverityLabels[incident.severity] }}
          </AppBadge>
        </div>
        <p class="text-sm text-[var(--color-text-muted)] mt-4 line-clamp-3">
          {{ incident.description }}
        </p>
        <div class="text-xs mt-4 p-3 rounded-xl bg-[var(--color-bg-deep)] space-y-1">
          <p class="m-0">
            <strong>Statut :</strong> {{ incidentStatusLabels[incident.status] }}
          </p>
          <p v-if="incident.missionReference" class="m-0">
            <strong>Mission :</strong> {{ incident.missionReference }}
          </p>
          <p v-if="incident.needReference" class="m-0">
            <strong>Besoin :</strong> {{ incident.needReference }}
          </p>
          <p class="text-[var(--color-text-muted)] m-0">
            {{ formatDateTime(incident.updatedAt) }}
          </p>
        </div>
        <AppButton v-if="canManage && incident.status !== 'CLOSED'" class="mt-4" size="sm" variant="secondary" @click="openAction(incident)">
          Traiter
        </AppButton>
      </AppCard>
    </div>

    <AppModal v-model="formOpen" title="Déclarer un incident" description="Le superviseur et les responsables Opérations seront notifiés.">
      <form class="space-y-4" @submit.prevent="createIncident">
        <AppFormField label="Titre" for="incident-title" required>
          <AppInput id="incident-title" v-model="form.title" required />
        </AppFormField>
        <AppFormField label="Description" for="incident-description" required>
          <AppTextarea id="incident-description" v-model="form.description" :rows="5" required />
        </AppFormField>
        <div class="gap-4 grid sm:grid-cols-2">
          <AppFormField label="Gravité" for="incident-severity">
            <AppSelect id="incident-severity" v-model="form.severity" :options="severityOptions" />
          </AppFormField>
          <AppFormField label="Mission" for="incident-mission">
            <AppSelect id="incident-mission" v-model="form.missionId" :options="missionOptions" />
          </AppFormField>
          <AppFormField label="Besoin" for="incident-need">
            <AppSelect id="incident-need" v-model="form.needId" :options="needOptions" />
          </AppFormField>
          <AppFormField v-if="canManage" label="Responsable" for="incident-assignee">
            <AppSelect id="incident-assignee" v-model="form.assignedTo" :options="memberOptions" />
          </AppFormField>
        </div>
        <div class="pt-2 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="formOpen = false">
            Annuler
          </AppButton><AppButton type="submit" :loading="submitting">
            Déclarer
          </AppButton>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="actionOpen" :title="`Traiter ${selectedIncident?.reference ?? ''}`">
      <form class="space-y-4" @submit.prevent="updateIncident">
        <AppFormField label="Nouveau statut" for="incident-action-status">
          <AppSelect id="incident-action-status" v-model="actionForm.status" :options="statusOptions.slice(1)" />
        </AppFormField>
        <AppFormField label="Responsable" for="incident-action-assignee">
          <AppSelect id="incident-action-assignee" v-model="actionForm.assignedTo" :options="memberOptions" />
        </AppFormField>
        <AppFormField label="Résolution" for="incident-resolution" hint="Obligatoire pour Résolu ou Clos.">
          <AppTextarea id="incident-resolution" v-model="actionForm.resolution" :rows="4" />
        </AppFormField>
        <div class="pt-2 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="actionOpen = false">
            Annuler
          </AppButton><AppButton type="submit" :loading="submitting">
            Mettre à jour
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
