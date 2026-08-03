<script setup lang="ts">
const { organization } = useCurrentOrganization()
const { members } = useTeamPresence(() => organization.value?._id)
const open = shallowRef(false)
const visibleMembers = computed(() => members.value ?? [])
</script>

<template>
  <div v-if="visibleMembers.length" class="relative">
    <button
      class="icon-btn relative"
      type="button"
      aria-label="Membres actuellement en ligne"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="i-carbon-user-multiple" />
      <span class="text-[9px] text-[#031413] font-900 rounded-full bg-[var(--color-accent)] flex h-4 min-w-4 items-center right-0 top-0 justify-center absolute">
        {{ visibleMembers.length }}
      </span>
    </button>
    <div v-if="open" class="p-2 surface-panel w-64 right-0 top-12 absolute">
      <p class="text-xs text-[var(--color-text-muted)] m-0 px-2 py-1">
        Équipe en ligne
      </p>
      <div v-for="member in visibleMembers" :key="member.userId" class="px-2 py-2 flex gap-2 items-center">
        <span class="rounded-full bg-[var(--color-accent)] h-2 w-2" />
        <span class="text-sm font-700 truncate">{{ member.displayName }}</span>
        <span class="text-[10px] text-[var(--color-text-muted)] ml-auto">{{ member.role }}</span>
      </div>
    </div>
  </div>
</template>
