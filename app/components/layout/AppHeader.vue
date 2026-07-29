<script setup lang="ts">
import { formatDateTime } from '~/utils/formatters'
import { api } from '../../../convex/_generated/api'

const { user, signOut } = useAuth()
const { $convex } = useNuxtApp()
const { organization } = useCurrentOrganization()
const menuOpen = shallowRef(false)
const notificationsOpen = shallowRef(false)
const notificationArgs = computed(() => organization.value
  ? { organizationId: organization.value._id, limit: 20 }
  : null)
const unreadArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null)
const { data: notifications } = useConvexQuery(api.notifications.listCurrent, notificationArgs)
const { data: unreadCount } = useConvexQuery(api.notifications.unreadCount, unreadArgs)

const initials = computed(() => {
  const source = user.value?.name || user.value?.email || 'FC'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
})

function notificationHref(href?: string) {
  if (!href || !organization.value)
    return ''
  if (href.startsWith('/operations'))
    return `/o/${organization.value.slug}${href}`
  return href
}

async function openNotification(notification: NonNullable<typeof notifications.value>[number]) {
  await $convex.mutation(api.notifications.markRead, {
    notificationId: notification._id,
  })
  notificationsOpen.value = false
  const href = notificationHref(notification.href)
  if (href)
    await navigateTo(href)
}

async function markAllRead() {
  if (!organization.value)
    return
  await $convex.mutation(api.notifications.markAllRead, {
    organizationId: organization.value._id,
  })
}
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
      <div class="relative">
        <button class="icon-btn relative" type="button" aria-label="Notifications" :aria-expanded="notificationsOpen" @click="notificationsOpen = !notificationsOpen">
          <span class="i-carbon-notification" />
          <span v-if="unreadCount" class="text-[9px] text-white font-900 rounded-full bg-red-500 flex h-4 min-w-4 items-center right-0 top-0 justify-center absolute">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>
        <div v-if="notificationsOpen" class="p-2 surface-panel max-h-110 w-[min(23rem,calc(100vw-2rem))] right-0 top-12 absolute overflow-y-auto">
          <div class="px-2 py-2 flex items-center justify-between">
            <strong class="text-sm">Notifications</strong>
            <button v-if="unreadCount" type="button" class="text-xs text-[var(--color-accent)] font-700" @click="markAllRead">
              Tout lire
            </button>
          </div>
          <p v-if="!notifications?.length" class="text-xs text-[var(--color-text-muted)] px-2 py-4">
            Aucune notification.
          </p>
          <button
            v-for="notification in notifications"
            :key="notification._id"
            type="button"
            class="p-3 text-left border-t border-[var(--color-border)] rounded-lg w-full hover:bg-[var(--color-bg-deep)]"
            @click="openNotification(notification)"
          >
            <span class="text-sm font-800 flex gap-2 items-center">
              <span v-if="!notification.isRead" class="rounded-full bg-[var(--color-accent)] shrink-0 h-2 w-2" />
              {{ notification.title }}
            </span>
            <span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ notification.body }}</span>
            <time class="text-[10px] text-[var(--color-text-subtle)] mt-1 block">{{ formatDateTime(notification.createdAt) }}</time>
          </button>
        </div>
      </div>
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
