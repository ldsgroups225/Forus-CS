<script setup lang="ts">
withDefaults(defineProps<{
  padded?: boolean
  interactive?: boolean
}>(), {
  padded: true,
  interactive: false,
})
</script>

<template>
  <section
    class="surface-panel"
    :class="[
      padded && 'p-4 sm:p-5',
      interactive && 'transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]',
    ]"
  >
    <slot />
  </section>
</template>
