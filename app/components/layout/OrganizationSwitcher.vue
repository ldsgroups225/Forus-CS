<script setup lang="ts">
import { api } from '../../../convex/_generated/api'

const route = useRoute()
const { data: organizations, isPending } = useConvexQuery(
  api.organizations.listForCurrentUser,
  {},
)

const currentSlug = computed(() => {
  const params = route.params as Record<string, string | string[] | undefined>
  return typeof params.organizationSlug === 'string' ? params.organizationSlug : ''
})

async function switchOrganization(event: Event) {
  const target = event.target as HTMLSelectElement
  if (target.value)
    await navigateTo(`/o/${target.value}/operations`)
}
</script>

<template>
  <div class="relative">
    <label for="organization-switcher" class="sr-only">Organisation active</label>
    <select
      id="organization-switcher"
      :value="currentSlug"
      :disabled="isPending"
      class="text-xs text-[var(--color-text)] font-700 py-2 pl-9 pr-8 appearance-none border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] max-w-48 min-h-10 truncate sm:max-w-60 focus-ring"
      @change="switchOrganization"
    >
      <option
        v-for="organization in organizations ?? []"
        :key="organization._id"
        :value="organization.slug"
      >
        {{ organization.name }}
      </option>
    </select>
    <span class="i-carbon-enterprise text-[var(--color-accent)] left-3 top-1/2 absolute -translate-y-1/2" />
    <span class="i-carbon-chevron-down text-[var(--color-text-subtle)] pointer-events-none right-2.5 top-1/2 absolute -translate-y-1/2" />
  </div>
</template>
