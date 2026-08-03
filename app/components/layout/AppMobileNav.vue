<script setup lang="ts">
const route = useRoute()
const { organization } = useCurrentOrganization()
const moreOpen = shallowRef(false)
const slug = computed(() => {
  const params = route.params as Record<string, string | string[] | undefined>
  return typeof params.organizationSlug === 'string' ? params.organizationSlug : ''
})
const base = computed(() => `/o/${slug.value}/operations`)
const isAgent = computed(() => organization.value?.role === 'AGENT')
const agentNavigation = computed(() => [
  { id: 'needs', label: 'Demandes', icon: 'i-carbon-task', to: `${base.value}/calling` },
  { id: 'call', label: 'Appeler', icon: 'i-carbon-phone-filled', to: `${base.value}/calling/appeler` },
  { id: 'portfolio', label: 'Portefeuille', icon: 'i-carbon-delivery-truck', to: `${base.value}/calling/portfolio` },
])
const items = computed(() => [
  { label: 'Accueil', icon: 'i-carbon-home', to: base.value },
  { label: 'Besoins', icon: 'i-carbon-task', to: `${base.value}/needs` },
  { label: 'Créer', icon: 'i-carbon-add', to: `${base.value}/needs/new`, cta: true },
  { label: 'Réseau', icon: 'i-carbon-delivery-truck', to: `${base.value}/transporteurs` },
])
const moreItems = computed(() => [
  { label: 'Options', icon: 'i-carbon-list-checked', to: `${base.value}/options` },
  { label: 'Missions', icon: 'i-carbon-delivery', to: `${base.value}/missions` },
  { label: 'Incidents', icon: 'i-carbon-warning-alt', to: `${base.value}/incidents` },
  { label: 'Clients', icon: 'i-carbon-enterprise', to: `${base.value}/clients` },
  { label: 'Rapports', icon: 'i-carbon-chart-column', to: `${base.value}/rapports` },
  { label: 'Paramètres', icon: 'i-carbon-settings', to: `${base.value}/parametres` },
])

function isAgentNavigationActive(id: string) {
  const callingBase = `${base.value}/calling`
  if (id === 'needs')
    return route.path === callingBase || (!route.path.startsWith(`${callingBase}/appeler`) && !route.path.startsWith(`${callingBase}/portfolio`))

  return route.path === `${callingBase}/${id === 'call' ? 'appeler' : 'portfolio'}`
}
</script>

<template>
  <div v-if="moreOpen && !isAgent" class="p-4 pb-24 border-t border-[var(--color-border)] bg-[var(--color-bg-deep)] inset-x-0 bottom-0 fixed z-49 lg:hidden" role="dialog" aria-label="Navigation complémentaire">
    <div class="mb-3 flex items-center justify-between">
      <strong class="text-sm">Navigation</strong>
      <button type="button" class="icon-btn" aria-label="Fermer la navigation" @click="moreOpen = false">
        <span class="i-carbon-close" />
      </button>
    </div>
    <div class="gap-2 grid grid-cols-2">
      <NuxtLink v-for="item in moreItems" :key="item.label" :to="item.to" class="text-sm p-3 border border-[var(--color-border)] rounded-xl flex gap-3 items-center" @click="moreOpen = false">
        <span :class="item.icon" class="text-lg text-[var(--color-accent)]" /> {{ item.label }}
      </NuxtLink>
    </div>
  </div>
  <nav
    class="px-2 pb-[env(safe-area-inset-bottom)] border-t border-[var(--color-border)] bg-[var(--color-bg-deep)]/98 grid h-18 inset-x-0 bottom-0 fixed z-50 lg:hidden"
    :class="[isAgent ? 'grid-cols-3 gap-2' : 'grid-cols-5', isAgent && 'agent-mobile-nav']"
    aria-label="Navigation mobile"
  >
    <template v-if="isAgent">
      <NuxtLink
        v-for="item in agentNavigation"
        :key="item.id"
        :to="item.to"
        class="agent-mobile-nav-item focus-ring"
        :class="isAgentNavigationActive(item.id) && 'agent-mobile-nav-item-active'"
        :aria-current="isAgentNavigationActive(item.id) ? 'page' : undefined"
      >
        <span :class="item.icon" class="text-xl" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </template>
    <NuxtLink
      v-for="item in items"
      v-else
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
    <button v-if="!isAgent" type="button" class="text-[10px] text-[var(--color-text-subtle)] font-700 rounded-xl flex flex-col gap-1 items-center justify-center focus-ring" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
      <span class="i-carbon-apps text-xl" />
      <span>Plus</span>
    </button>
  </nav>
</template>

<style scoped>
.agent-mobile-nav {
  background: var(--color-bg-deep);
  box-shadow: 0 -10px 24px rgb(4 11 20 / 14%);
}

.agent-mobile-nav-item {
  margin: 0.45rem 0;
  border-radius: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  font-size: 0.68rem;
  font-weight: 800;
}
.agent-mobile-nav-item-active {
  background: var(--color-accent);
  color: var(--color-button-text);
  box-shadow: 0 6px 18px rgb(32 199 183 / 22%);
}
</style>
