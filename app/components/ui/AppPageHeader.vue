<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header-copy">
      <h1 class="page-header-title">
        {{ title }}
      </h1>
      <p v-if="description" class="page-header-description">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.page-header-copy {
  min-width: 0;
}
.page-header-title {
  margin: 0;
  color: var(--color-text);
  font-size: 1.875rem;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.1;
}
.page-header-description {
  max-width: 62ch;
  margin: 0.55rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  line-height: 1.55;
}
.page-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    align-items: end;
    justify-content: space-between;
  }
  .page-header-actions {
    flex: none;
    justify-content: end;
  }
}
</style>
