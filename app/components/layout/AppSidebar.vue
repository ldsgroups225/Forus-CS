<script setup lang="ts">
const route = useRoute()

const organizationSlug = computed(() => {
  const params = route.params as Record<string, string | string[] | undefined>
  return typeof params.organizationSlug === 'string' ? params.organizationSlug : ''
})
const { organization } = useCurrentOrganization()

const base = computed(() => `/o/${organizationSlug.value}/operations`)

const navigation = computed(() => organization.value?.role === 'AGENT'
  ? [
      { label: 'Besoins', icon: 'i-carbon-task', to: `${base.value}/calling`, exact: true },
      { label: 'Portefeuille', icon: 'i-carbon-delivery-truck', to: `${base.value}/calling/portfolio` },
    ]
  : [
      { label: 'Dashboard', icon: 'i-carbon-dashboard', to: base.value, exact: true },
      { label: 'Besoins', icon: 'i-carbon-task', to: `${base.value}/needs` },
      { label: 'Options', icon: 'i-carbon-list-checked', to: `${base.value}/options` },
      { label: 'Missions', icon: 'i-carbon-delivery', to: `${base.value}/missions` },
      { label: 'Incidents', icon: 'i-carbon-warning-alt', to: `${base.value}/incidents` },
      { label: 'Clients', icon: 'i-carbon-enterprise', to: `${base.value}/clients` },
      { label: 'Transporteurs', icon: 'i-carbon-delivery-truck', to: `${base.value}/transporteurs` },
      { label: 'Calling', icon: 'i-carbon-phone-filled', to: `${base.value}/calling/supervision` },
      { label: 'Rapports', icon: 'i-carbon-chart-column', to: `${base.value}/rapports` },
      { label: 'Paramètres', icon: 'i-carbon-settings', to: `${base.value}/parametres` },
    ])

function isActive(item: { to: string, exact?: boolean }) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}
</script>

<template>
  <aside class="border-r border-[var(--color-border)] bg-[var(--color-bg-deep)] flex-col w-64 hidden inset-y-0 left-0 fixed z-40 lg:flex">
    <div class="px-5 border-b border-[var(--color-border)] flex h-18 items-center">
      <AppBrand />
    </div>

    <nav class="px-3 py-5 flex-1 overflow-y-auto space-y-1" aria-label="Navigation principale">
      <NuxtLink
        v-for="item in navigation"
        :key="item.label"
        :to="item.to"
        class="group text-sm font-700 px-3.5 py-2.5 rounded-xl flex gap-3 min-h-11 transition items-center focus-ring"
        :class="isActive(item)
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'"
      >
        <span :class="item.icon" class="text-lg" aria-hidden="true" />
        <span>{{ item.label }}</span>
        <span v-if="isActive(item)" class="ml-auto rounded-full bg-[var(--color-accent)] h-1.5 w-1.5" />
      </NuxtLink>
    </nav>

    <div class="p-4 border-t border-[var(--color-border)]">
      <NetworkStatus />
      <p class="text-[10px] text-[var(--color-text-subtle)] leading-4 mb-0 mt-3">
        Données isolées par organisation
      </p>
    </div>
  </aside>
</template>
