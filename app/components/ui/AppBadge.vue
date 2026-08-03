<script setup lang="ts">
type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

withDefaults(defineProps<{
  tone?: BadgeTone
  dot?: boolean
}>(), {
  tone: 'neutral',
  dot: false,
})
</script>

<template>
  <span
    class="app-badge"
    :class="[
      `app-badge-${tone}`,
    ]"
  >
    <span v-if="dot" class="rounded-full bg-current h-1.5 w-1.5" />
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  line-height: 1.25;
  text-transform: uppercase;
  white-space: nowrap;
}
.app-badge-info,
.app-badge-success,
.app-badge-warning,
.app-badge-danger,
.app-badge-accent {
  border-color: color-mix(in srgb, currentColor 35%, var(--color-border));
  background: color-mix(in srgb, currentColor 10%, var(--color-surface));
}
.app-badge-info {
  color: var(--color-info);
}
.app-badge-success {
  color: var(--color-success);
}
.app-badge-warning {
  color: var(--color-warning);
}
.app-badge-danger {
  color: var(--color-danger);
}
.app-badge-accent {
  color: var(--color-accent);
}
</style>
