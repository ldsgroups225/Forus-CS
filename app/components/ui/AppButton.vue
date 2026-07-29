<script setup lang="ts">
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="font-700 border rounded-xl inline-flex gap-2 min-h-11 transition items-center justify-center disabled:opacity-55 disabled:cursor-not-allowed focus-ring active:scale-[0.98]"
    :class="[
      block && 'w-full',
      size === 'sm' && 'px-3 py-2 text-xs',
      size === 'md' && 'px-4 py-2.5 text-sm',
      size === 'lg' && 'px-5 py-3 text-base',
      variant === 'primary' && 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[#031413] hover:bg-[var(--color-accent-strong)]',
      variant === 'secondary' && 'border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text)] hover:border-[var(--color-accent)]',
      variant === 'ghost' && 'border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]',
      variant === 'danger' && 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:brightness-110',
      variant === 'success' && 'border-[var(--color-success)] bg-[var(--color-success)] text-[#04150b] hover:brightness-110',
    ]"
  >
    <span v-if="loading" class="i-carbon-circle-dash text-lg animate-spin" aria-hidden="true" />
    <slot name="leading" />
    <slot />
    <slot name="trailing" />
  </button>
</template>
