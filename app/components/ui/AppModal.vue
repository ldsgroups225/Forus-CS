<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue'

defineProps<{
  title: string
  description?: string
}>()

const open = defineModel<boolean>({ default: false })
const dialogRef = useTemplateRef<HTMLElement>('dialog')
const previouslyFocused = shallowRef<HTMLElement | null>(null)

function focusableElements() {
  return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')) ?? []).filter(element => !element.hasAttribute('hidden'))
}

function trapFocus(event: KeyboardEvent) {
  const focusable = focusableElements()
  const first = focusable.at(0)
  const last = focusable.at(-1)
  if (!first || !last)
    return

  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialogRef.value)) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) {
    await nextTick()
    previouslyFocused.value?.focus()
    previouslyFocused.value = null
    return
  }
  previouslyFocused.value = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  await nextTick()
  dialogRef.value?.focus()
})

function close() {
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="p-0 bg-black/65 flex items-end inset-0 justify-center fixed z-100 backdrop-blur-sm sm:p-4 sm:items-center"
        role="presentation"
        @click.self="close"
      >
        <section
          ref="dialog"
          class="p-5 border border-[var(--color-border)] rounded-t-3xl bg-[var(--color-surface)] max-h-[90vh] max-w-lg w-full shadow-2xl overflow-y-auto sm:rounded-2xl"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          @keydown.esc.stop="close"
          @keydown.tab="trapFocus"
        >
          <header class="mb-5 flex gap-4 items-start justify-between">
            <div>
              <h2 class="text-lg font-800 m-0">
                {{ title }}
              </h2>
              <p v-if="description" class="text-sm text-[var(--color-text-muted)] mb-0 mt-1">
                {{ description }}
              </p>
            </div>
            <button class="icon-btn shrink-0" type="button" aria-label="Fermer" @click="close">
              <span class="i-carbon-close" />
            </button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
