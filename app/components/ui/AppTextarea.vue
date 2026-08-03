<script setup lang="ts">
withDefaults(defineProps<{
  id?: string
  rows?: number
  placeholder?: string
  maxlength?: number
  disabled?: boolean
}>(), {
  rows: 4,
  disabled: false,
})

const model = defineModel<string | undefined>()
</script>

<template>
  <textarea
    :id="id"
    v-model="model"
    :rows="rows"
    :placeholder="placeholder"
    :maxlength="maxlength"
    :disabled="disabled"
    class="text-sm text-[var(--color-text)] px-3.5 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] w-full resize-y transition-colors placeholder:text-[var(--color-text-subtle)] hover:border-[var(--color-border-strong)] disabled:opacity-60 disabled:cursor-not-allowed focus-ring"
  />
</template>
