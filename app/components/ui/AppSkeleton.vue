<script setup lang="ts">
withDefaults(defineProps<{
  lines?: number
}>(), {
  lines: 3,
})
</script>

<template>
  <div class="animate-pulse space-y-3" aria-label="Chargement en cours" role="status">
    <div
      v-for="line in lines"
      :key="line"
      class="rounded-full bg-[var(--color-surface-raised)] h-4"
      :class="line === lines ? 'w-2/3' : 'w-full'"
    />
  </div>
</template>
