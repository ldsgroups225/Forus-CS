<script setup lang="ts">
import { formatCurrency, formatNumber } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { organization } = useCurrentOrganization()
const now = new Date()
const from = shallowRef(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
const to = shallowRef(now.toISOString().slice(0, 10))
const range = computed(() => ({
  from: new Date(`${from.value}T00:00:00`).getTime(),
  to: new Date(`${to.value}T23:59:59`).getTime(),
}))
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id, ...range.value }
  : null)
const { data: overview, isPending, error } = useConvexQuery(api.reports.overview, queryArgs)
const { data: agents } = useConvexQuery(api.reports.agentPerformance, queryArgs)

function exportCsv() {
  if (!overview.value)
    return

  const rows: Array<Array<string | number>> = [
    ['Indicateur', 'Valeur'],
    ['Besoins', overview.value.needs.total],
    ['Besoins actifs', overview.value.needs.active],
    ['Besoins satisfaits', overview.value.needs.satisfied],
    ['Camions demandés', overview.value.needs.requestedTrucks],
    ['Camions approuvés', overview.value.needs.approvedTrucks],
    ['Missions', overview.value.missions.total],
    ['Missions terminées', overview.value.missions.completed],
    ['Valeur missions', overview.value.missions.totalValue],
    ['Incidents ouverts', overview.value.incidents.open],
    ['Appels', overview.value.calls.total],
    ['Taux de réponse', overview.value.calls.answerRate],
  ]
  const csv = rows.map(row =>
    row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `forus-cs-rapport-${from.value}-${to.value}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Rapports et KPI" description="Besoins, missions, appels, incidents et performance agents sur la période.">
      <template #actions>
        <AppButton variant="secondary" :disabled="!overview" @click="exportCsv">
          <template #leading>
            <span class="i-carbon-download" />
          </template>
          Exporter en CSV
        </AppButton>
      </template>
    </AppPageHeader>

    <AppCard class="mb-5">
      <div class="gap-4 grid xl:grid-cols-[12rem_12rem_1fr] sm:grid-cols-2 xl:items-end">
        <AppFormField label="Du" for="report-from">
          <AppInput id="report-from" v-model="from" type="date" />
        </AppFormField>
        <AppFormField label="Au" for="report-to">
          <AppInput id="report-to" v-model="to" type="date" />
        </AppFormField>
        <p class="text-xs text-[var(--color-text-muted)] m-0 xl:pb-3">
          Calcul direct depuis les données Convex isolées de l’organisation.
        </p>
      </div>
    </AppCard>

    <div v-if="isPending" class="gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
      <AppCard v-for="index in 8" :key="index">
        <AppSkeleton :lines="2" />
      </AppCard>
    </div>
    <p v-else-if="error || !overview" class="text-sm text-red-300" role="alert">
      Impossible de calculer le rapport.
    </p>
    <template v-else>
      <div class="gap-3 grid grid-cols-2 lg:grid-cols-4">
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Besoins actifs
          </p><strong class="text-2xl font-900 mt-2 block">{{ overview.needs.active }}</strong><small class="text-[var(--color-text-subtle)]">{{ overview.needs.satisfied }} satisfaits</small>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Camions OK
          </p><strong class="text-2xl text-green-300 font-900 mt-2 block">{{ overview.needs.approvedTrucks }}</strong><small class="text-[var(--color-text-subtle)]">sur {{ overview.needs.requestedTrucks }} demandés</small>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Missions terminées
          </p><strong class="text-2xl font-900 mt-2 block">{{ overview.missions.completed }}</strong><small class="text-[var(--color-text-subtle)]">{{ overview.missions.inProgress }} en cours</small>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Valeur missions
          </p><strong class="text-xl text-[var(--color-accent)] font-900 mt-2 block">{{ formatCurrency(overview.missions.totalValue) }}</strong>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Appels
          </p><strong class="text-2xl font-900 mt-2 block">{{ overview.calls.total }}</strong><small class="text-[var(--color-text-subtle)]">{{ overview.calls.answerRate }} % de réponse</small>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Incidents ouverts
          </p><strong class="text-2xl text-orange-300 font-900 mt-2 block">{{ overview.incidents.open }}</strong><small class="text-[var(--color-text-subtle)]">{{ overview.incidents.critical }} critiques</small>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Transporteurs actifs
          </p><strong class="text-2xl font-900 mt-2 block">{{ overview.activeCarriers }}</strong>
        </AppCard>
        <AppCard>
          <p class="text-xs text-[var(--color-text-muted)] m-0">
            Relances à faire
          </p><strong class="text-2xl font-900 mt-2 block">{{ overview.pendingFollowUps }}</strong>
        </AppCard>
      </div>

      <AppCard class="mt-5">
        <div class="mb-4">
          <h2 class="text-base font-900 m-0">
            Performance agents
          </h2>
          <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
            Pondération du brief : activité 20 %, développement 30 %, traitement 30 %, qualité 20 %.
          </p>
        </div>
        <AppEmptyState v-if="!agents?.length" title="Aucun agent actif" description="Invitez des agents pour activer le suivi individuel." icon="i-carbon-user-multiple" />
        <div v-else class="overflow-x-auto">
          <table class="text-sm min-w-200 w-full">
            <thead class="text-xs text-[var(--color-text-muted)] text-left">
              <tr>
                <th class="pb-3">
                  Agent
                </th><th class="pb-3">
                  Appels
                </th><th class="pb-3">
                  Réponse
                </th><th class="pb-3">
                  Nouveaux
                </th><th class="pb-3">
                  Options
                </th><th class="pb-3">
                  Score
                </th><th class="pb-3">
                  Prime estimée
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in agents" :key="agent.userId" class="border-t border-[var(--color-border)]">
                <td class="font-800 py-3">
                  {{ agent.displayName }}
                </td>
                <td class="py-3">
                  {{ formatNumber(agent.calls) }}
                </td>
                <td class="py-3">
                  {{ agent.responseRate }} %
                </td>
                <td class="py-3">
                  {{ agent.newCarriers }}
                </td>
                <td class="py-3">
                  {{ agent.submittedOptions }}
                </td>
                <td class="py-3">
                  <AppBadge :tone="agent.score.total >= 80 ? 'success' : agent.score.total >= 50 ? 'warning' : 'danger'">
                    {{ agent.score.total }} / 100
                  </AppBadge>
                </td>
                <td class="py-3">
                  <strong>{{ formatCurrency(agent.estimatedBonus) }}</strong><span class="text-[10px] text-[var(--color-text-subtle)] block">Éligibilité à valider</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>
    </template>
  </div>
</template>
