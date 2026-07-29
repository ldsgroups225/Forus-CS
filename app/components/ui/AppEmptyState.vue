<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
  icon?: string
  compact?: boolean
}>(), {
  icon: 'i-carbon-inbox',
  compact: false,
})
</script>

<template>
  <div class="px-5 text-center surface-panel flex flex-col items-center" :class="compact ? 'py-6' : 'py-12'">
    <div class="text-2xl text-[var(--color-accent)] rounded-2xl bg-[var(--color-accent-soft)] flex h-13 w-13 items-center justify-center" :class="compact ? 'mb-3' : 'mb-4'">
      <span :class="icon" aria-hidden="true" />
    </div>
    <h3 class="text-base font-800 m-0">
      {{ title }}
    </h3>
    <p class="text-sm text-[var(--color-text-muted)] leading-6 mb-0 mt-2 max-w-md">
      {{ description }}
    </p>
    <div class="mt-5">
      <slot />
    </div>
  </div>
</template>
