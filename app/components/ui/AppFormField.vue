<script setup lang="ts">
defineProps<{
  label: string
  for?: string
  hint?: string
  error?: string
  required?: boolean
}>()
</script>

<template>
  <div>
    <div class="mb-2 flex gap-3 items-start justify-between">
      <label :for="$props.for" class="text-sm text-[var(--color-text)] font-700">
        {{ label }}
        <span v-if="required" class="text-[var(--color-danger)]" aria-label="obligatoire">*</span>
      </label>
      <span v-if="hint" class="text-xs text-[var(--color-text-subtle)] text-right">{{ hint }}</span>
    </div>
    <slot />
    <p v-if="error" class="text-xs text-[var(--color-danger)] mb-0 mt-1.5" role="alert">
      {{ error }}
    </p>
  </div>
</template>
