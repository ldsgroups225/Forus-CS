<script setup lang="ts">
const online = useOnline()
const { pendingCount } = useOfflineMutationQueue()
</script>

<template>
  <div
    v-if="!online || pendingCount"
    class="text-[11px] font-700 px-2.5 py-1 border rounded-full inline-flex gap-2 items-center"
    :class="online
      ? 'border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
      : 'border-orange-500/25 bg-orange-500/10 text-orange-300'"
    role="status"
  >
    <span class="rounded-full bg-current h-1.5 w-1.5" :class="online && 'animate-pulse'" />
    {{ online ? `Synchronisation : ${pendingCount} en attente` : 'Hors ligne' }}
    <span v-if="!online && pendingCount">· {{ pendingCount }} en attente</span>
  </div>
</template>
