<script setup lang="ts">
const online = useOnline()
</script>

<template>
  <div
    class="text-[11px] font-700 px-2.5 py-1 border rounded-full inline-flex gap-2 items-center"
    :class="online
      ? 'border-green-500/20 bg-green-500/8 text-green-300'
      : 'border-orange-500/25 bg-orange-500/10 text-orange-300'"
    role="status"
  >
    <span class="rounded-full bg-current h-1.5 w-1.5" :class="online && 'animate-pulse'" />
    {{ online ? 'En ligne' : 'Hors ligne' }}
  </div>
</template>
