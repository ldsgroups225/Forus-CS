<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { authClient } = useAuth()
const email = shallowRef('')
const loading = shallowRef(false)
const message = shallowRef('')
const error = shallowRef('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const response = await authClient.requestPasswordReset({
      email: email.value.trim().toLocaleLowerCase(),
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (response.error) {
      error.value = response.error.message ?? 'Demande impossible.'
      return
    }
    message.value = 'Si ce compte existe, un lien de réinitialisation a été envoyé.'
  }
  catch {
    error.value = 'Le service d’e-mail n’est pas encore configuré ou est indisponible.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <AppCard class="p-6 sm:p-8">
    <AppBadge tone="accent" dot>
      Récupération sécurisée
    </AppBadge>
    <h1 class="text-2xl font-900 mb-2 mt-4">
      Mot de passe oublié
    </h1>
    <p class="text-sm text-[var(--color-text-muted)] leading-6">
      Saisissez l’adresse e-mail du compte. La réponse reste volontairement neutre.
    </p>
    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <AppFormField label="Adresse e-mail" for="forgot-email" required>
        <AppInput id="forgot-email" v-model="email" type="email" autocomplete="email" required />
      </AppFormField>
      <p v-if="message" class="text-sm text-green-300 p-3 border border-green-500/25 rounded-xl bg-green-500/8" role="status">
        {{ message }}
      </p>
      <p v-if="error" class="text-sm text-red-300 p-3 border border-red-500/25 rounded-xl bg-red-500/8" role="alert">
        {{ error }}
      </p>
      <AppButton type="submit" :loading="loading" block>
        Envoyer le lien
      </AppButton>
    </form>
    <NuxtLink to="/login" class="text-sm text-[var(--color-accent)] font-700 mt-6 text-center block">
      Retour à la connexion
    </NuxtLink>
  </AppCard>
</template>
