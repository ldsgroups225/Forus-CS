<script setup lang="ts">
const online = useOnline()

watch(online, (value) => {
  if (value)
    void navigateTo('/')
})
</script>

<template>
  <main class="forus-grid px-4 text-center flex min-h-screen items-center justify-center">
    <div class="max-w-md">
      <div class="text-3xl text-orange-300 mx-auto mb-6 border border-orange-500/25 rounded-3xl bg-orange-500/10 flex h-18 w-18 items-center justify-center">
        <span class="i-carbon-cloud-offline" />
      </div>
      <h1 class="text-2xl font-900 mb-3">
        Vous êtes hors ligne
      </h1>
      <p class="text-sm text-[var(--color-text-muted)] leading-6 mb-6">
        Les écrans déjà consultés restent disponibles. Les écritures métier seront synchronisées dans une prochaine version.
      </p>
      <AppButton variant="secondary" @click="$router.back()">
        Revenir à l’écran précédent
      </AppButton>
    </div>
  </main>
</template>
