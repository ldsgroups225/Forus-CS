<script setup lang="ts">
import type { CarrierOptionStatus } from '~~/shared/domain'
import { carrierOptionStatusLabels } from '~~/shared/domain'

defineProps<{
  option: {
    _id: string
    reference: string
    status: CarrierOptionStatus
    carrierName: string
    needReference: string
    clientName: string
    loadingLocation: string
    destination: string
    proposedTruckCount: number
    acceptedTruckCount?: number
    pricePerTruck: number
    availableAt: number
    updatedAt: number
  }
  organizationSlug: string
}>()
</script>

<template>
  <NuxtLink
    :to="`/o/${organizationSlug}/operations/options/${option._id}`"
    class="p-4 surface-panel block transition hover:border-[var(--color-border-strong)] active:scale-[0.99]"
  >
    <div class="mb-4 flex gap-3 items-start justify-between">
      <div class="min-w-0">
        <div class="text-sm font-900">
          {{ option.reference }}
        </div>
        <div class="text-xs text-[var(--color-text-muted)] mt-1 truncate">
          {{ option.carrierName }} · {{ option.needReference }}
        </div>
      </div>
      <AppBadge :tone="carrierOptionStatusTone(option.status)">
        {{ carrierOptionStatusLabels[option.status] }}
      </AppBadge>
    </div>
    <div class="text-xs p-3 rounded-xl bg-[var(--color-bg-deep)]">
      <div class="font-700">
        {{ option.clientName }}
      </div>
      <div class="text-[var(--color-text-muted)] mt-1">
        {{ option.loadingLocation }} → {{ option.destination }}
      </div>
    </div>
    <div class="mt-4 gap-3 grid grid-cols-3">
      <div>
        <span class="text-[10px] text-[var(--color-text-subtle)] block">Proposés</span>
        <strong class="text-sm mt-1 block">{{ option.proposedTruckCount }}</strong>
      </div>
      <div>
        <span class="text-[10px] text-[var(--color-text-subtle)] block">Prix unitaire</span>
        <strong class="text-sm mt-1 block">{{ formatCurrency(option.pricePerTruck) }}</strong>
      </div>
      <div>
        <span class="text-[10px] text-[var(--color-text-subtle)] block">Disponibilité</span>
        <strong class="text-xs mt-1 block">{{ formatDateTime(option.availableAt) }}</strong>
      </div>
    </div>
  </NuxtLink>
</template>
