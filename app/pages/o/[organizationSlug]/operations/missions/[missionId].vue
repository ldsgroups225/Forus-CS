<script setup lang="ts">
import type { MissionStatus } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { missionStatusLabels } from '~~/shared/domain'
import { nextMissionStatuses } from '~~/shared/missionWorkflow'
import { buildPhoneUrl, formatDateTime, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const route = useRoute()
const { $convex } = useNuxtApp()
const { organization } = useCurrentOrganization()
const missionId = computed(() => route.params.missionId as Id<'missions'>)
const { data: mission, isPending, error } = useConvexQuery(
  api.missions.getById,
  computed(() => missionId.value ? { missionId: missionId.value } : null),
)
const canManage = computed(() => organization.value?.role !== 'AGENT')
const { data: members } = useConvexQuery(api.memberships.list, computed(() =>
  organization.value && canManage.value
    ? { organizationId: organization.value._id }
    : null))
const actionOpen = shallowRef(false)
const assignOpen = shallowRef(false)
const submitting = shallowRef(false)
const feedback = shallowRef('')
const statusForm = reactive({
  status: '' as MissionStatus | '',
  note: '',
  location: '',
})
const assignedTo = shallowRef('')
const nextStatuses = computed(() =>
  mission.value ? nextMissionStatuses(mission.value.status) : [])
const statusOptions = computed(() => nextStatuses.value.map(status => ({
  value: status,
  label: missionStatusLabels[status],
})))
const memberOptions = computed(() => [
  { value: '', label: 'Non affectée' },
  ...(members.value ?? []).filter(member => member.isActive).map(member => ({
    value: member.userId,
    label: member.displayName ?? member.email ?? member.userId,
  })),
])
const message = computed(() => mission.value
  ? [
      `Bonjour ${mission.value.carrierName},`,
      '',
      `Suivi de la mission ${mission.value.reference}.`,
      `Statut : ${missionStatusLabels[mission.value.status]}.`,
      `Trajet : ${mission.value.loadingLocation} → ${mission.value.destination}.`,
      '',
      'Merci de nous confirmer la situation actuelle.',
      'Équipe Forus CS',
    ].join('\n')
  : '')

function openStatus() {
  const next = nextStatuses.value[0]
  if (!next)
    return
  Object.assign(statusForm, { status: next, note: '', location: '' })
  actionOpen.value = true
}

async function updateStatus() {
  if (!statusForm.status)
    return
  submitting.value = true
  try {
    await $convex.mutation(api.missions.updateStatus, {
      missionId: missionId.value,
      status: statusForm.status,
      note: statusForm.note || undefined,
      location: statusForm.location || undefined,
    })
    feedback.value = 'Statut de mission mis à jour et notifié.'
    actionOpen.value = false
  }
  catch {
    feedback.value = 'Transition de statut refusée.'
  }
  finally {
    submitting.value = false
  }
}

async function assignMission() {
  submitting.value = true
  try {
    await $convex.mutation(api.missions.assignAgent, {
      missionId: missionId.value,
      agentId: assignedTo.value || undefined,
    })
    feedback.value = 'Affectation mise à jour.'
    assignOpen.value = false
  }
  catch {
    feedback.value = 'Affectation impossible.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div v-if="isPending" class="space-y-5">
      <AppCard><AppSkeleton :lines="5" /></AppCard><AppCard><AppSkeleton :lines="6" /></AppCard>
    </div>
    <AppEmptyState v-else-if="error || !mission" title="Mission introuvable" description="Cette mission n’existe pas ou n’appartient pas à l’organisation." icon="i-carbon-warning-alt" />
    <template v-else>
      <button class="text-xs text-[var(--color-text-muted)] font-700 mb-4 flex gap-2 items-center hover:text-[var(--color-accent)]" @click="navigateTo(`/o/${organization?.slug}/operations/missions`)">
        <span class="i-carbon-arrow-left" /> Retour aux missions
      </button>
      <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <AppBadge :tone="missionStatusTone(mission.status)" dot>
            {{ missionStatusLabels[mission.status] }}
          </AppBadge>
          <h1 class="text-2xl font-900 m-0 mt-3 sm:text-3xl">
            {{ mission.reference }}
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] m-0 mt-2">
            {{ mission.carrierName }} · {{ mission.needReference }}
          </p>
        </div>
        <div v-if="canManage" class="flex flex-wrap gap-2">
          <AppButton v-if="nextStatuses.length" @click="openStatus">
            Mettre à jour le statut
          </AppButton>
          <AppButton variant="secondary" @click="assignedTo = mission.assignedTo || ''; assignOpen = true">
            Affecter
          </AppButton>
          <AppButton variant="secondary" @click="navigateTo(`/o/${organization?.slug}/operations/incidents`)">
            Déclarer un incident
          </AppButton>
        </div>
      </div>
      <p v-if="feedback" class="text-sm mb-5 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]" role="status">
        {{ feedback }}
      </p>

      <div class="gap-5 grid xl:grid-cols-[1.1fr_0.9fr]">
        <div class="space-y-5">
          <AppCard>
            <h2 class="text-base font-900 m-0">
              Exécution
            </h2>
            <div class="mt-5">
              <div class="text-xs text-[var(--color-text-muted)] mb-2 flex justify-between">
                <span>Progression</span><strong>{{ mission.progress }} %</strong>
              </div>
              <div class="rounded-full bg-[var(--color-bg-deep)] h-3 overflow-hidden">
                <span class="rounded-full bg-[var(--color-accent)] h-full block transition-all" :style="{ width: `${mission.progress}%` }" />
              </div>
            </div>
            <dl class="mt-6 gap-5 grid sm:grid-cols-2">
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Trajet
                </dt><dd class="text-sm font-800 m-0 mt-1">
                  {{ mission.loadingLocation }} → {{ mission.destination }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Mobilisation
                </dt><dd class="text-sm font-800 m-0 mt-1">
                  {{ formatDateTime(mission.mobilizationAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Camions
                </dt><dd class="text-sm font-800 m-0 mt-1">
                  {{ mission.truckCount }} · {{ mission.truckType }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-subtle)]">
                  Responsable
                </dt><dd class="text-sm font-800 m-0 mt-1">
                  {{ mission.assignedTo || 'Non affectée' }}
                </dd>
              </div>
            </dl>
          </AppCard>
          <AppCard>
            <h2 class="text-base font-900 m-0">
              Transporteur
            </h2>
            <p class="text-sm text-[var(--color-text-muted)]">
              {{ mission.carrierName }}<template v-if="mission.carrierPhone">
                · {{ formatPhoneNumber(mission.carrierPhone) }}
              </template>
            </p>
            <div v-if="mission.carrierPhone" class="gap-2 grid sm:grid-cols-2">
              <a :href="buildPhoneUrl(mission.carrierPhone)" class="text-sm font-800 px-4 py-3 border border-[var(--color-border-strong)] rounded-xl flex gap-2 min-h-11 items-center justify-center"><span class="i-carbon-phone-filled" /> Appeler</a>
              <a :href="buildWhatsAppUrl(mission.carrierPhone, message)" target="_blank" rel="noopener noreferrer" class="text-sm text-green-300 font-800 px-4 py-3 border border-green-500/30 rounded-xl flex gap-2 min-h-11 items-center justify-center"><span class="i-carbon-logo-whatsapp" /> WhatsApp</a>
            </div>
          </AppCard>
        </div>
        <AppCard>
          <h2 class="text-base font-900 m-0">
            Timeline
          </h2>
          <ol class="mt-5 pl-0 list-none space-y-4">
            <li v-for="event in mission.events" :key="event._id" class="pl-5 border-l border-[var(--color-border-strong)] relative">
              <span class="rounded-full bg-[var(--color-accent)] h-2 w-2 left-[-4.5px] top-1 absolute" />
              <strong class="text-sm">{{ missionStatusLabels[event.status] }}</strong>
              <p v-if="event.note" class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
                {{ event.note }}
              </p>
              <p v-if="event.location" class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
                Position : {{ event.location }}
              </p>
              <time class="text-[10px] text-[var(--color-text-subtle)] mt-1 block">{{ formatDateTime(event.createdAt) }}</time>
            </li>
          </ol>
        </AppCard>
      </div>

      <AppModal v-model="actionOpen" title="Mettre à jour la mission">
        <form class="space-y-4" @submit.prevent="updateStatus">
          <AppFormField label="Nouveau statut" for="mission-status">
            <AppSelect id="mission-status" v-model="statusForm.status" :options="statusOptions" />
          </AppFormField>
          <AppFormField label="Position" for="mission-location">
            <AppInput id="mission-location" v-model="statusForm.location" placeholder="Ville, site ou point de contrôle" />
          </AppFormField>
          <AppFormField label="Note" for="mission-note">
            <AppTextarea id="mission-note" v-model="statusForm.note" :rows="4" />
          </AppFormField>
          <div class="flex gap-2 justify-end">
            <AppButton variant="ghost" @click="actionOpen = false">
              Annuler
            </AppButton><AppButton type="submit" :loading="submitting">
              Confirmer
            </AppButton>
          </div>
        </form>
      </AppModal>
      <AppModal v-model="assignOpen" title="Affecter la mission">
        <form class="space-y-4" @submit.prevent="assignMission">
          <AppFormField label="Membre" for="mission-assignee">
            <AppSelect id="mission-assignee" v-model="assignedTo" :options="memberOptions" />
          </AppFormField>
          <div class="flex gap-2 justify-end">
            <AppButton variant="ghost" @click="assignOpen = false">
              Annuler
            </AppButton><AppButton type="submit" :loading="submitting">
              Affecter
            </AppButton>
          </div>
        </form>
      </AppModal>
    </template>
  </div>
</template>
