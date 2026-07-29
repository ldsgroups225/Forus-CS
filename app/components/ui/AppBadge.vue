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
    class="text-[11px] tracking-wide font-800 px-2.5 py-1 border rounded-full inline-flex gap-1.5 whitespace-nowrap uppercase items-center"
    :class="[
      tone === 'neutral' && 'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]',
      tone === 'info' && 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      tone === 'success' && 'border-green-500/30 bg-green-500/10 text-green-300',
      tone === 'warning' && 'border-orange-500/30 bg-orange-500/10 text-orange-300',
      tone === 'danger' && 'border-red-500/30 bg-red-500/10 text-red-300',
      tone === 'accent' && 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    ]"
  >
    <span v-if="dot" class="rounded-full bg-current h-1.5 w-1.5" />
    <slot />
  </span>
</template>
