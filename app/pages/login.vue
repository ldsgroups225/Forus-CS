<script setup lang="ts">
import { api } from '../../convex/_generated/api'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const { authClient, session } = useAuth()
const { $convex, $ensureConvexAuth } = useNuxtApp()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)
const { data: authCapabilities } = useConvexQuery(api.auth.getCapabilities, {})
const hasSocialProviders = computed(() =>
  Boolean(authCapabilities.value?.google || authCapabilities.value?.github))

async function signInWith(provider: 'google' | 'github') {
  errorMessage.value = ''
  loading.value = true
  try {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    const response = await authClient.signIn.social({
      provider,
      callbackURL: new URL(redirect, window.location.origin).toString(),
      errorCallbackURL: `${window.location.origin}/login`,
    })
    if (response.error)
      errorMessage.value = response.error.message || 'Connexion OAuth impossible.'
  }
  catch {
    errorMessage.value = 'Le fournisseur de connexion est momentanément indisponible.'
  }
  finally {
    loading.value = false
  }
}

async function submit() {
  errorMessage.value = ''

  if (!email.value || password.value.length < 8) {
    errorMessage.value = 'Saisissez un e-mail valide et un mot de passe d’au moins 8 caractères.'
    return
  }

  loading.value = true
  try {
    const response = await authClient.signIn.email({
      email: email.value.trim().toLowerCase(),
      password: password.value,
    })

    if (response.error) {
      errorMessage.value = response.error.message || 'Connexion impossible. Vérifiez vos identifiants.'
      return
    }

    await session.value.refetch()
    if (!await $ensureConvexAuth()) {
      errorMessage.value = 'La session est créée, mais l’accès aux données n’est pas encore disponible.'
      return
    }
    const redirect = typeof route.query.redirect === 'string'
      ? route.query.redirect
      : await destinationAfterAuthentication($convex)
    await navigateTo(redirect)
  }
  catch {
    errorMessage.value = 'Le service de connexion est momentanément indisponible.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <AppCard class="p-6 sm:p-8">
    <div class="mb-7 text-center">
      <AppBadge tone="accent" dot>
        Espace sécurisé
      </AppBadge>
      <h1 class="text-2xl font-900 mb-2 mt-4">
        Bon retour
      </h1>
      <p class="text-sm text-[var(--color-text-muted)] leading-6 m-0">
        Connectez-vous pour piloter les besoins opérationnels.
      </p>
    </div>

    <form class="space-y-5" @submit.prevent="submit">
      <AppFormField label="Adresse e-mail" for="login-email" required>
        <AppInput
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="responsable@forus.ci"
        />
      </AppFormField>

      <AppFormField label="Mot de passe" for="login-password" required>
        <AppInput
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
        />
      </AppFormField>

      <p v-if="errorMessage" class="text-sm text-red-300 px-3.5 py-3 border border-red-500/25 rounded-xl bg-red-500/10" role="alert">
        {{ errorMessage }}
      </p>

      <AppButton type="submit" :loading="loading" block size="lg">
        Se connecter
        <template #trailing>
          <span class="i-carbon-arrow-right" />
        </template>
      </AppButton>
      <NuxtLink to="/forgot-password" class="text-xs text-[var(--color-accent)] font-700 text-center block hover:underline">
        Mot de passe oublié ?
      </NuxtLink>
    </form>

    <div v-if="hasSocialProviders" class="mt-6 pt-6 border-t border-[var(--color-border)]">
      <p class="text-xs text-[var(--color-text-subtle)] mb-3 text-center">
        Ou continuer avec
      </p>
      <div class="gap-2 grid sm:grid-cols-2">
        <AppButton v-if="authCapabilities?.google" variant="secondary" :loading="loading" block @click="signInWith('google')">
          <template #leading>
            <AuthProviderIcon provider="google" />
          </template>
          Google
        </AppButton>
        <AppButton v-if="authCapabilities?.github" variant="secondary" :loading="loading" block @click="signInWith('github')">
          <template #leading>
            <AuthProviderIcon provider="github" />
          </template>
          GitHub
        </AppButton>
      </div>
    </div>

    <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-6 text-center">
      Première visite ?
      <NuxtLink to="/register" class="text-[var(--color-accent)] font-800 hover:underline">
        Créer un compte
      </NuxtLink>
    </p>
  </AppCard>
</template>
