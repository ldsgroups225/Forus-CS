<script setup lang="ts">
import { needStatusLabels } from '~~/shared/domain'
import { api } from '../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { organization } = useCurrentOrganization()
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null,
)
const { data: needs, isPending, error } = useConvexQuery(api.needs.listAll, queryArgs)

const activeNeeds = computed(() =>
  (needs.value ?? []).filter(need => need.status === 'OPEN' || need.status === 'PARTIAL'),
)
const satisfiedNeeds = computed(() =>
  (needs.value ?? []).filter(need => need.status === 'SATISFIED'),
)
const metrics = computed(() => ({
  active: activeNeeds.value.length,
  requested: activeNeeds.value.reduce((total, need) => total + need.requestedTruckCount, 0),
  approved: activeNeeds.value.reduce((total, need) => total + need.approvedTruckCount, 0),
  remaining: activeNeeds.value.reduce((total, need) => total + need.remainingTruckCount, 0),
  satisfied: satisfiedNeeds.value.length,
  critical: activeNeeds.value.filter(need => need.urgency === 'CRITICAL').length,
}))
const recentNeeds = computed(() => (needs.value ?? []).slice(0, 5))

const metricCards = computed(() => [
  { label: 'Besoins actifs', value: metrics.value.active, icon: 'i-carbon-task', tone: 'blue' },
  { label: 'Camions demandés', value: metrics.value.requested, icon: 'i-carbon-delivery-truck', tone: 'purple' },
  { label: 'Camions OK', value: metrics.value.approved, icon: 'i-carbon-checkmark-filled', tone: 'green' },
  { label: 'Reste à trouver', value: metrics.value.remaining, icon: 'i-carbon-search', tone: 'red' },
  { label: 'Besoins satisfaits', value: metrics.value.satisfied, icon: 'i-carbon-checkmark-outline', tone: 'teal' },
  { label: 'Besoins critiques', value: metrics.value.critical, icon: 'i-carbon-warning-alt-filled', tone: 'orange' },
])
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Tableau de bord" :description="`Vue en temps réel des besoins de ${organization?.name ?? 'votre organisation'}.`">
      <template #actions>
        <AppButton @click="navigateTo(`/o/${organization?.slug}/operations/needs/new`)">
          <template #leading>
            <span class="i-carbon-add" />
          </template>
          Nouveau besoin
        </AppButton>
      </template>
    </AppPageHeader>

    <div v-if="isPending" class="gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="index in 6" :key="index">
        <AppSkeleton :lines="2" />
      </AppCard>
    </div>

    <div v-else-if="error" class="text-sm text-red-300 p-4 border border-red-500/25 rounded-2xl bg-red-500/10">
      Impossible de charger le tableau de bord.
    </div>

    <template v-else>
      <div class="gap-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <AppCard
          v-for="metric in metricCards"
          :key="metric.label"
          class="p-4 relative overflow-hidden"
        >
          <div
            class="text-lg mb-4 rounded-xl flex h-9 w-9 items-center justify-center"
            :class="[
              metric.tone === 'blue' && 'bg-blue-500/10 text-blue-300',
              metric.tone === 'purple' && 'bg-purple-500/10 text-purple-300',
              metric.tone === 'green' && 'bg-green-500/10 text-green-300',
              metric.tone === 'red' && 'bg-red-500/10 text-red-300',
              metric.tone === 'teal' && 'bg-teal-500/10 text-teal-300',
              metric.tone === 'orange' && 'bg-orange-500/10 text-orange-300',
            ]"
          >
            <span :class="metric.icon" />
          </div>
          <div class="text-2xl font-900 tabular-nums">
            {{ metric.value }}
          </div>
          <div class="text-[11px] text-[var(--color-text-muted)] leading-4 mt-1">
            {{ metric.label }}
          </div>
        </AppCard>
      </div>

      <div class="mt-6 gap-5 grid xl:grid-cols-[1.3fr_0.7fr]">
        <AppCard>
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h2 class="text-base font-800 m-0">
                Besoins récemment modifiés
              </h2>
              <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
                Les cinq dernières activités opérationnelles.
              </p>
            </div>
            <NuxtLink
              :to="`/o/${organization?.slug}/operations/needs`"
              class="text-xs text-[var(--color-accent)] font-800 hover:underline"
            >
              Voir tout
            </NuxtLink>
          </div>

          <div v-if="recentNeeds.length" class="divide-[var(--color-border)] divide-y">
            <NuxtLink
              v-for="need in recentNeeds"
              :key="need._id"
              :to="`/o/${organization?.slug}/operations/needs/${need._id}`"
              class="group py-3 flex gap-3 items-center first:pt-0 last:pb-0"
            >
              <div class="text-[var(--color-accent)] rounded-xl bg-[var(--color-surface-raised)] flex shrink-0 h-9 w-9 items-center justify-center">
                <span class="i-carbon-delivery" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-800 truncate">
                  {{ need.reference }}
                </div>
                <div class="text-xs text-[var(--color-text-muted)] truncate">
                  {{ need.loadingLocation }} → {{ need.destination }}
                </div>
              </div>
              <AppBadge :tone="needStatusTone(need.status)">
                {{ needStatusLabels[need.status] }}
              </AppBadge>
              <span class="i-carbon-chevron-right text-[var(--color-text-subtle)] hidden group-hover:text-[var(--color-accent)] sm:block" />
            </NuxtLink>
          </div>
          <AppEmptyState
            v-else
            title="Aucun besoin"
            description="Créez votre premier besoin pour alimenter le tableau de bord."
            icon="i-carbon-task-add"
          />
        </AppCard>

        <AppCard>
          <h2 class="text-base font-800 m-0">
            Priorités opérationnelles
          </h2>
          <p class="text-xs text-[var(--color-text-muted)] mb-5 mt-1">
            Points qui demandent une action immédiate.
          </p>
          <div class="space-y-3">
            <div class="p-3 border border-red-500/20 rounded-xl bg-red-500/8 flex items-center justify-between">
              <div class="flex gap-3 items-center">
                <span class="i-carbon-warning-alt text-red-300" />
                <div>
                  <div class="text-sm font-800">
                    Besoins critiques
                  </div>
                  <div class="text-xs text-[var(--color-text-muted)]">
                    À traiter en priorité
                  </div>
                </div>
              </div>
              <strong class="text-xl text-red-300">{{ metrics.critical }}</strong>
            </div>
            <div class="p-3 border border-orange-500/20 rounded-xl bg-orange-500/8 flex items-center justify-between">
              <div class="flex gap-3 items-center">
                <span class="i-carbon-search text-orange-300" />
                <div>
                  <div class="text-sm font-800">
                    Camions à trouver
                  </div>
                  <div class="text-xs text-[var(--color-text-muted)]">
                    Sur les besoins actifs
                  </div>
                </div>
              </div>
              <strong class="text-xl text-orange-300">{{ metrics.remaining }}</strong>
            </div>
            <div class="p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)]">
              <div class="text-xs mb-2 flex items-center justify-between">
                <span class="text-[var(--color-text-muted)]">Taux de couverture</span>
                <span class="text-[var(--color-accent)] font-800">
                  {{ metrics.requested ? Math.round((metrics.approved / metrics.requested) * 100) : 0 }} %
                </span>
              </div>
              <div class="rounded-full bg-[var(--color-surface-raised)] h-2 overflow-hidden">
                <div
                  class="rounded-full bg-[var(--color-accent)] h-full transition-all"
                  :style="{ width: `${metrics.requested ? Math.min(100, (metrics.approved / metrics.requested) * 100) : 0}%` }"
                />
              </div>
            </div>
          </div>
        </AppCard>
      </div>
    </template>
  </div>
</template>
