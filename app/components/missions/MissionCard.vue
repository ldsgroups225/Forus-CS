<script setup lang="ts">
import type { MissionStatus } from '~~/shared/domain'
import { missionStatusLabels } from '~~/shared/domain'
import { buildPhoneUrl, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'

const props = defineProps<{
  mission: {
    _id: string
    reference: string
    status: MissionStatus
    needId: string
    needReference: string
    clientName: string
    carrierName: string
    carrierPhone?: string
    truckType: string
    truckCount: number
    pricePerTruck: number
    totalPrice: number
    loadingLocation: string
    destination: string
    mobilizationAt: number
    progress: number
    incidentCount: number
  }
  organizationSlug: string
}>()

const message = computed(() => [
  `Bonjour ${props.mission.carrierName},`,
  '',
  `La mission ${props.mission.reference} est confirmée pour le besoin ${props.mission.needReference}.`,
  `Trajet : ${props.mission.loadingLocation} → ${props.mission.destination}`,
  `Camion : ${props.mission.truckType}`,
  `Quantité : ${props.mission.truckCount} camion(s)`,
  `Mobilisation : ${formatDateTime(props.mission.mobilizationAt)}`,
  '',
  'Merci de confirmer la mobilisation.',
  'Équipe Forus CS',
].join('\n'))
</script>

<template>
  <AppCard>
    <div class="mb-4 flex gap-3 items-start justify-between">
      <div>
        <div class="font-900">
          {{ mission.reference }}
        </div>
        <div class="text-xs text-[var(--color-text-muted)] mt-1">
          {{ mission.carrierName }}
          <template v-if="mission.carrierPhone">
            · {{ formatPhoneNumber(mission.carrierPhone) }}
          </template>
        </div>
      </div>
      <AppBadge :tone="missionStatusTone(mission.status)" dot>
        {{ missionStatusLabels[mission.status] }}
      </AppBadge>
    </div>

    <NuxtLink
      :to="`/o/${organizationSlug}/operations/needs/${mission.needId}`"
      class="text-xs p-3 rounded-xl bg-[var(--color-bg-deep)] block hover:bg-[var(--color-surface-raised)]"
    >
      <strong>{{ mission.needReference }} · {{ mission.clientName }}</strong>
      <span class="text-[var(--color-text-muted)] mt-1 block">{{ mission.loadingLocation }} → {{ mission.destination }}</span>
    </NuxtLink>

    <dl class="mt-4 gap-3 grid grid-cols-2">
      <div>
        <dt class="text-[10px] text-[var(--color-text-subtle)]">
          Camions confirmés
        </dt>
        <dd class="text-sm font-800 m-0 mt-1">
          {{ mission.truckCount }} · {{ mission.truckType }}
        </dd>
      </div>
      <div>
        <dt class="text-[10px] text-[var(--color-text-subtle)]">
          Montant total
        </dt>
        <dd class="text-sm font-800 m-0 mt-1">
          {{ formatCurrency(mission.totalPrice) }}
        </dd>
      </div>
      <div class="col-span-2">
        <dt class="text-[10px] text-[var(--color-text-subtle)]">
          Mobilisation
        </dt>
        <dd class="text-sm font-800 m-0 mt-1">
          {{ formatDateTime(mission.mobilizationAt) }}
        </dd>
      </div>
    </dl>

    <div class="mt-4">
      <div class="text-[10px] text-[var(--color-text-subtle)] mb-1 flex justify-between">
        <span>Progression</span><strong>{{ mission.progress }} %</strong>
      </div>
      <div class="rounded-full bg-[var(--color-bg-deep)] h-2 overflow-hidden">
        <span class="rounded-full bg-[var(--color-accent)] h-full block" :style="{ width: `${mission.progress}%` }" />
      </div>
    </div>

    <div class="mt-4 gap-2 grid" :class="mission.carrierPhone ? 'grid-cols-3' : 'grid-cols-1'">
      <NuxtLink :to="`/o/${organizationSlug}/operations/missions/${mission._id}`" class="text-xs font-800 px-3 py-2 border border-[var(--color-border-strong)] rounded-xl flex gap-2 min-h-11 items-center justify-center hover:border-[var(--color-accent)]">
        Détail
        <AppBadge v-if="mission.incidentCount" tone="danger">
          {{ mission.incidentCount }}
        </AppBadge>
      </NuxtLink>
      <a v-if="mission.carrierPhone" :href="buildPhoneUrl(mission.carrierPhone)" class="text-xs font-800 px-3 py-2 border border-[var(--color-border-strong)] rounded-xl flex gap-2 min-h-11 items-center justify-center hover:border-[var(--color-accent)]">
        <span class="i-carbon-phone-filled text-[var(--color-accent)]" /> Appeler
      </a>
      <a v-if="mission.carrierPhone" :href="buildWhatsAppUrl(mission.carrierPhone, message)" target="_blank" rel="noopener noreferrer" class="text-xs text-green-300 font-800 px-3 py-2 border border-green-500/30 rounded-xl bg-green-500/8 flex gap-2 min-h-11 items-center justify-center hover:bg-green-500/15">
        <span class="i-carbon-logo-whatsapp" /> WhatsApp
      </a>
    </div>
  </AppCard>
</template>
