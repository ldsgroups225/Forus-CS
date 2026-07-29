<script setup lang="ts">
withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})
</script>

<template>
  <div class="flex gap-3 items-center">
    <div class="brand-mark border border-teal-300/25 rounded-xl bg-[#07111f] flex shrink-0 h-10 w-10 items-center justify-center relative overflow-hidden">
      <img
        src="/forus-logo-foreground.png"
        alt=""
        aria-hidden="true"
        class="h-[88%] w-[88%] object-contain"
      >
    </div>
    <div v-if="!compact" class="min-w-0">
      <div class="text-sm tracking-wide font-900 truncate">
        FORUS CS
      </div>
      <div class="text-[10px] text-[var(--color-text-subtle)] tracking-[0.18em] font-700 truncate uppercase">
        Call Center
      </div>
    </div>
  </div>
</template>

<style scoped>
.brand-mark {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 12%),
    0 8px 24px rgb(16 185 180 / 10%);
}
</style>
