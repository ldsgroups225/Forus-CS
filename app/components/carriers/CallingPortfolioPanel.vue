<script setup lang="ts">
interface CallingAgent {
  _id: string
  name: string
  color?: string
  isActive: boolean
  assignedCarrierCount: number
  linkedUserName?: string
  linkedUserEmail?: string
}

const props = defineProps<{
  agents: readonly CallingAgent[]
  selectedId: string
  unassignedCount: number
  canManage: boolean
  creating?: boolean
}>()

const emit = defineEmits<{
  create: [name: string]
  dropCarrier: [callingAgentId: string]
  select: [callingAgentId: string]
}>()

const draftName = shallowRef('')
const createOpen = shallowRef(false)

const activeAgents = computed(() =>
  props.agents.filter(agent => agent.isActive))
const inactiveAgents = computed(() =>
  props.agents.filter(agent => !agent.isActive))
const totalAssigned = computed(() =>
  props.agents.reduce((total, agent) => total + agent.assignedCarrierCount, 0))

function createAgent() {
  const name = draftName.value.trim()
  if (name.length < 2)
    return

  emit('create', name)
  draftName.value = ''
  createOpen.value = false
}

function dropOn(callingAgentId: string, event: DragEvent) {
  event.preventDefault()
  emit('dropCarrier', callingAgentId)
}
</script>

<template>
  <section class="mb-5 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] overflow-hidden">
    <div class="p-4 border-b border-[var(--color-border)] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs text-[var(--color-accent)] tracking-[0.14em] font-800 m-0 uppercase">
          Dispatch calling
        </p>
        <h2 class="text-lg font-900 m-0 mt-1">
          Portefeuilles agents
        </h2>
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <AppBadge tone="accent">
          {{ totalAssigned }} assignés
        </AppBadge>
        <AppBadge :tone="unassignedCount ? 'warning' : 'success'">
          {{ unassignedCount }} non attribués
        </AppBadge>
        <AppButton v-if="canManage" size="sm" variant="secondary" @click="createOpen = !createOpen">
          <template #leading>
            <span class="i-carbon-user-avatar-filled-alt" />
          </template>
          Créer un agent
        </AppButton>
      </div>
    </div>

    <form v-if="createOpen && canManage" class="p-4 border-b border-[var(--color-border)] gap-3 grid sm:grid-cols-[1fr_auto]" @submit.prevent="createAgent">
      <AppInput v-model="draftName" placeholder="Agent 1, Agent Plateau, Agent Bennes…" :disabled="creating" />
      <AppButton type="submit" :loading="creating">
        Créer
      </AppButton>
    </form>

    <div class="p-4 gap-3 grid sm:grid-cols-2 xl:grid-cols-5">
      <button
        type="button"
        class="portfolio-tile"
        :class="selectedId === '' && 'portfolio-tile-active'"
        @click="emit('select', '')"
        @dragover.prevent
        @drop="dropOn('', $event)"
      >
        <span class="text-xs text-[var(--color-text-subtle)] font-800 uppercase">Tous</span>
        <strong>Base complète</strong>
        <span>{{ totalAssigned + unassignedCount }} transporteurs</span>
      </button>

      <button
        type="button"
        class="portfolio-tile"
        :class="selectedId === 'unassigned' && 'portfolio-tile-active'"
        @click="emit('select', 'unassigned')"
        @dragover.prevent
        @drop="dropOn('unassigned', $event)"
      >
        <span class="text-xs text-[var(--color-text-subtle)] font-800 uppercase">À répartir</span>
        <strong>Non attribués</strong>
        <span>{{ unassignedCount }} transporteurs</span>
      </button>

      <button
        v-for="agent in activeAgents"
        :key="agent._id"
        type="button"
        class="portfolio-tile"
        :class="selectedId === agent._id && 'portfolio-tile-active'"
        @click="emit('select', agent._id)"
        @dragover.prevent
        @drop="dropOn(agent._id, $event)"
      >
        <span class="text-xs text-[var(--color-text-subtle)] font-800 uppercase">
          {{ agent.linkedUserName || agent.linkedUserEmail ? 'Compte lié' : 'Enveloppe' }}
        </span>
        <strong>{{ agent.name }}</strong>
        <span>{{ agent.assignedCarrierCount }} transporteurs</span>
      </button>
    </div>

    <div v-if="inactiveAgents.length" class="px-4 pb-4 flex flex-wrap gap-2">
      <AppBadge v-for="agent in inactiveAgents" :key="agent._id">
        {{ agent.name }} suspendu
      </AppBadge>
    </div>
  </section>
</template>

<style scoped>
.portfolio-tile {
  min-height: 112px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-deep);
  color: var(--color-text);
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.portfolio-tile:hover,
.portfolio-tile:focus-visible {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
}

.portfolio-tile:active {
  transform: translateY(1px);
}

.portfolio-tile-active {
  border-color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}
</style>
