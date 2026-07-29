<script setup lang="ts">
const route = useRoute()
const slug = computed(() => {
  const params = route.params as Record<string, string | string[] | undefined>
  return typeof params.organizationSlug === 'string' ? params.organizationSlug : ''
})
const base = computed(() => `/o/${slug.value}/operations`)
const items = computed(() => [
  { label: 'Accueil', icon: 'i-carbon-home', to: base.value },
  { label: 'Besoins', icon: 'i-carbon-task', to: `${base.value}/needs` },
  { label: 'Créer', icon: 'i-carbon-add', to: `${base.value}/needs/new`, cta: true },
  { label: 'Options', icon: 'i-carbon-list-checked', to: `${base.value}/options` },
  { label: 'Missions', icon: 'i-carbon-delivery', to: `${base.value}/missions` },
])
</script>

<template>
  <nav class="px-2 pb-[env(safe-area-inset-bottom)] border-t border-[var(--color-border)] bg-[var(--color-bg-deep)]/98 grid grid-cols-5 h-18 inset-x-0 bottom-0 fixed z-50 lg:hidden" aria-label="Navigation mobile">
    <NuxtLink
      v-for="item in items"
      :key="item.label"
      :to="item.to"
      class="text-[10px] font-700 rounded-xl flex flex-col gap-1 min-w-0 items-center justify-center relative focus-ring"
      :class="route.path === item.to || (!item.cta && item.to !== base && route.path.startsWith(item.to))
        ? 'text-[var(--color-accent)]'
        : 'text-[var(--color-text-subtle)]'"
    >
      <span
        class="text-xl flex items-center justify-center"
        :class="[
          item.icon,
          item.cta && 'h-11 w-11 -translate-y-3 rounded-2xl bg-[var(--color-accent)] text-2xl text-[#031413] shadow-[0_8px_24px_rgb(32_199_183_/_30%)]',
        ]"
      />
      <span :class="item.cta && '-translate-y-3'">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
