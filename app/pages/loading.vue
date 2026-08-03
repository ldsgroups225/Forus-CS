<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const { $authClient, $ensureConvexAuth } = useNuxtApp()
const attempts = shallowRef(0)
const errorMessage = shallowRef('')
const retrying = shallowRef(false)

const destination = computed(() => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return redirect.startsWith('/') && !redirect.startsWith('//') && redirect !== '/loading'
    ? redirect
    : '/'
})

function wait(delay: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, delay))
}

async function restoreSession() {
  if (retrying.value)
    return

  retrying.value = true
  errorMessage.value = ''
  try {
    for (const delay of [0, 350, 900]) {
      if (delay)
        await wait(delay)
      attempts.value += 1
      const response = await $authClient.getSession()
      if (!response.data?.user) {
        await navigateTo({ path: '/login', query: { redirect: destination.value } })
        return
      }
      if (await $ensureConvexAuth()) {
        await navigateTo(destination.value)
        return
      }
    }
    errorMessage.value = navigator.onLine
      ? 'La session met plus de temps que prévu à se rétablir.'
      : 'La connexion réseau est indisponible.'
  }
  catch {
    errorMessage.value = navigator.onLine
      ? 'La session met plus de temps que prévu à se rétablir.'
      : 'La connexion réseau est indisponible.'
  }
  finally {
    retrying.value = false
  }
}

if (import.meta.client)
  void restoreSession()
</script>

<template>
  <main class="app-recovery" aria-live="polite" aria-busy="true">
    <section class="app-recovery-card">
      <AppBrand />
      <div class="app-recovery-heading">
        <span class="i-carbon-renew app-recovery-icon" aria-hidden="true" />
        <div>
          <p class="app-recovery-kicker">
            Forus CS
          </p>
          <h1>Restauration de votre espace</h1>
        </div>
      </div>
      <p class="app-recovery-copy">
        Nous reconnectons votre session et vos données.
      </p>
      <div class="app-recovery-skeletons" aria-label="Chargement de vos données">
        <AppSkeleton :lines="1" />
        <AppSkeleton :lines="2" />
      </div>
      <p v-if="errorMessage" class="app-recovery-error" role="status">
        {{ errorMessage }}
      </p>
      <AppButton v-if="errorMessage" variant="secondary" block @click="restoreSession">
        Réessayer
      </AppButton>
      <p v-else class="app-recovery-status">
        Connexion sécurisée… {{ attempts > 1 ? `tentative ${attempts}` : '' }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.app-recovery {
  min-height: 100vh;
  padding: 1.5rem;
  display: grid;
  place-items: center;
}
.app-recovery-card {
  width: min(100%, 31rem);
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 1.5rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.app-recovery-heading {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 2.25rem;
}
.app-recovery-icon {
  flex: none;
  color: var(--color-accent);
  font-size: 2rem;
  animation: recovery-spin 1.2s linear infinite;
}
.app-recovery-kicker {
  margin: 0 0 0.2rem;
  color: var(--color-accent);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.app-recovery-heading h1 {
  margin: 0;
  font-size: 1.35rem;
}
.app-recovery-copy,
.app-recovery-status,
.app-recovery-error {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.55;
}
.app-recovery-copy {
  margin: 1.25rem 0;
}
.app-recovery-skeletons {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-bg-deep);
}
.app-recovery-error {
  margin: 1rem 0;
  color: var(--color-warning);
}
.app-recovery-status {
  margin: 1rem 0 0;
}
@keyframes recovery-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-recovery-icon {
    animation: none;
  }
}
</style>
