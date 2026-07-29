<script setup lang="ts">
const { user, signOut } = useAuth()
const menuOpen = ref(false)

const initials = computed(() => {
  const source = user.value?.name || user.value?.email || 'FC'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
})
</script>

<template>
  <header class="px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/95 flex gap-3 h-16 items-center top-0 justify-between sticky z-30 backdrop-blur lg:ml-64 sm:px-6 lg:h-18">
    <div class="flex gap-3 min-w-0 items-center">
      <div class="lg:hidden">
        <AppBrand compact />
      </div>
      <OrganizationSwitcher />
    </div>

    <div class="flex gap-2 items-center">
      <div class="hidden sm:block">
        <NetworkStatus />
      </div>
      <button class="icon-btn" type="button" aria-label="Notifications">
        <span class="i-carbon-notification" />
      </button>
      <div class="relative">
        <button
          type="button"
          class="px-1.5 pr-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] flex gap-2 h-10 items-center focus-ring"
          aria-label="Menu du profil"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="text-[10px] text-[#031413] font-900 rounded-lg bg-[var(--color-accent)] flex h-7 w-7 items-center justify-center">
            {{ initials }}
          </span>
          <span class="i-carbon-chevron-down text-xs text-[var(--color-text-subtle)]" />
        </button>
        <div
          v-if="menuOpen"
          class="p-2 surface-panel w-64 right-0 top-12 absolute"
        >
          <div class="px-3 py-2 border-b border-[var(--color-border)]">
            <div class="text-sm font-700 truncate">
              {{ user?.name || 'Responsable Opérations' }}
            </div>
            <div class="text-xs text-[var(--color-text-muted)] truncate">
              {{ user?.email }}
            </div>
          </div>
          <button
            type="button"
            class="text-sm text-[var(--color-danger)] mt-1 px-3 py-2 text-left rounded-lg flex gap-2 w-full items-center hover:bg-red-500/10 focus-ring"
            @click="signOut"
          >
            <span class="i-carbon-logout" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
