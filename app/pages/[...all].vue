<script setup lang="ts">
const router = useRouter()
</script>

<template>
  <main class="forus-grid px-4 text-center flex min-h-screen items-center justify-center">
    <div class="max-w-md">
      <div class="text-3xl text-[var(--color-warning)] mx-auto mb-5 rounded-2xl bg-[var(--color-surface)] flex h-16 w-16 items-center justify-center">
        <span class="i-carbon-warning" />
      </div>
      <p class="text-xs text-[var(--color-accent)] tracking-[0.18em] font-900 mb-2 uppercase">
        Erreur 404
      </p>
      <h1 class="text-2xl font-900 m-0">
        Page introuvable
      </h1>
      <p class="text-sm text-[var(--color-text-muted)] mb-6 mt-3">
        La page demandée n’existe pas ou a été déplacée.
      </p>
      <AppButton variant="secondary" @click="router.back()">
        Retour
      </AppButton>
    </div>
  </main>
</template>
