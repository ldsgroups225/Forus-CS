<script setup lang="ts">
export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

defineProps<{
  id?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
}>()

const model = defineModel<string | undefined>()
</script>

<template>
  <select
    :id="id"
    v-model="model"
    :disabled="disabled"
    class="text-sm text-[var(--color-text)] px-3.5 py-2.5 appearance-none border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] min-h-11 w-full transition-colors hover:border-[var(--color-border-strong)] disabled:opacity-60 disabled:cursor-not-allowed focus-ring"
  >
    <option v-if="placeholder" value="" disabled>
      {{ placeholder }}
    </option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>
