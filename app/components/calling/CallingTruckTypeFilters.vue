<script setup lang="ts">
import type { CallingTruckTypeOption } from '~/utils/calling-truck-types'

defineProps<{
  options: CallingTruckTypeOption[]
}>()

const selectedTypes = defineModel<string[]>({ default: () => [] })

function toggleTruckType(type: string) {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter(selectedType => selectedType !== type)
    : [...selectedTypes.value, type]
}

function clearFilters() {
  selectedTypes.value = []
}
</script>

<template>
  <fieldset v-if="options.length" class="calling-type-filters">
    <legend class="calling-type-filters-title">
      Types de camions
    </legend>
    <div class="calling-type-filters-actions">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="calling-type-filter"
        :class="{ 'calling-type-filter--active': selectedTypes.includes(option.value) }"
        :aria-pressed="selectedTypes.includes(option.value)"
        @click="toggleTruckType(option.value)"
      >
        <span class="i-carbon-delivery-truck" aria-hidden="true" />
        {{ option.label }}
      </button>
    </div>
    <button
      v-if="selectedTypes.length"
      type="button"
      class="calling-type-filter-clear focus-ring"
      @click="clearFilters"
    >
      Effacer les filtres
    </button>
  </fieldset>
</template>

<style scoped>
.calling-type-filters {
  min-width: 0;
  margin: 0.85rem 0 0;
  padding: 0;
  border: 0;
}

.calling-type-filters-title {
  margin-bottom: 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 750;
}

.calling-type-filters-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.calling-type-filter,
.calling-type-filter-clear {
  min-height: 2.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-deep);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
}

.calling-type-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  padding: 0.55rem 0.7rem;
  border-radius: 999px;
  font-size: 0.78rem;
  white-space: nowrap;
}

.calling-type-filter:hover,
.calling-type-filter--active {
  border-color: var(--color-accent);
}

.calling-type-filter--active {
  background: color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-deep));
  color: var(--color-text);
}

.calling-type-filter-clear {
  margin-top: 0.55rem;
  padding: 0.25rem 0;
  border-width: 0 0 1px;
  border-radius: 0;
  color: var(--color-accent);
  font-size: 0.76rem;
}

.calling-type-filter-clear:hover {
  color: var(--color-text);
}

@media (max-width: 520px) {
  .calling-type-filters-actions {
    flex-wrap: nowrap;
    margin-inline: -0.15rem;
    padding: 0.1rem 0.15rem 0.45rem;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: none;
  }

  .calling-type-filters-actions::-webkit-scrollbar {
    display: none;
  }

  .calling-type-filter {
    flex: 0 0 auto;
  }
}
</style>
