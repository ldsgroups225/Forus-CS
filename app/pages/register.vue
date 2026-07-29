<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { authClient, session } = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
const confirmation = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

async function submit() {
  errorMessage.value = ''
  successMessage.value = ''

  if (name.value.trim().length < 2) {
    errorMessage.value = 'Indiquez votre nom complet.'
    return
  }
  if (!email.value.includes('@')) {
    errorMessage.value = 'Saisissez une adresse e-mail valide.'
    return
  }
  if (password.value.length < 8) {
    errorMessage.value = 'Le mot de passe doit contenir au moins 8 caractères.'
    return
  }
  if (password.value !== confirmation.value) {
    errorMessage.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  loading.value = true
  try {
    const response = await authClient.signUp.email({
      name: name.value.trim(),
      email: email.value.trim().toLowerCase(),
      password: password.value,
    })

    if (response.error) {
      errorMessage.value = response.error.message || 'Impossible de créer le compte.'
      return
    }

    await session.value.refetch()
    if (!session.value.data?.user) {
      successMessage.value = 'Compte créé. Consultez votre e-mail pour confirmer votre adresse avant de vous connecter.'
      return
    }
    await navigateTo('/onboarding/organization')
  }
  catch {
    errorMessage.value = 'Le service d’inscription est momentanément indisponible.'
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
        Démarrage rapide
      </AppBadge>
      <h1 class="text-2xl font-900 mb-2 mt-4">
        Créer votre compte
      </h1>
      <p class="text-sm text-[var(--color-text-muted)] leading-6 m-0">
        Votre première organisation sera créée à l’étape suivante.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <AppFormField label="Nom complet" for="register-name" required>
        <AppInput id="register-name" v-model="name" autocomplete="name" placeholder="Darius Kassi" />
      </AppFormField>
      <AppFormField label="Adresse e-mail" for="register-email" required>
        <AppInput id="register-email" v-model="email" type="email" autocomplete="email" placeholder="responsable@forus.ci" />
      </AppFormField>
      <AppFormField label="Mot de passe" for="register-password" hint="8 caractères minimum" required>
        <AppInput id="register-password" v-model="password" type="password" autocomplete="new-password" />
      </AppFormField>
      <AppFormField label="Confirmer le mot de passe" for="register-confirmation" required>
        <AppInput id="register-confirmation" v-model="confirmation" type="password" autocomplete="new-password" />
      </AppFormField>

      <p v-if="errorMessage" class="text-sm text-red-300 px-3.5 py-3 border border-red-500/25 rounded-xl bg-red-500/10" role="alert">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="text-sm text-green-300 px-3.5 py-3 border border-green-500/25 rounded-xl bg-green-500/10" role="status">
        {{ successMessage }}
      </p>

      <AppButton type="submit" :loading="loading" block size="lg">
        Créer mon compte
      </AppButton>
    </form>

    <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-6 text-center">
      Déjà inscrit ?
      <NuxtLink to="/login" class="text-[var(--color-accent)] font-800 hover:underline">
        Se connecter
      </NuxtLink>
    </p>
  </AppCard>
</template>
