<script setup lang="ts">
withDefaults(defineProps<{
  id?: string
  type?: string
  placeholder?: string
  autocomplete?: string
  disabled?: boolean
  min?: string | number
  max?: string | number
  step?: string | number
}>(), {
  type: 'text',
  disabled: false,
})

const model = defineModel<string | number | undefined>()
</script>

<template>
  <input
    :id="id"
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step"
    class="text-sm text-[var(--color-text)] px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] min-h-11 w-full placeholder:text-[var(--color-text-subtle)] disabled:opacity-60 disabled:cursor-not-allowed focus-ring"
  >
</template>
