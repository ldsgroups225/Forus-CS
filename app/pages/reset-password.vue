<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const { authClient } = useAuth()
const password = shallowRef('')
const confirmation = shallowRef('')
const loading = shallowRef(false)
const error = shallowRef('')
const success = shallowRef(false)
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')

async function submit() {
  error.value = ''
  if (!token.value) {
    error.value = 'Le jeton de réinitialisation est absent.'
    return
  }
  if (password.value.length < 8 || password.value !== confirmation.value) {
    error.value = 'Utilisez au moins 8 caractères et confirmez le même mot de passe.'
    return
  }
  loading.value = true
  try {
    const response = await authClient.resetPassword({
      newPassword: password.value,
      token: token.value,
    })
    if (response.error) {
      error.value = response.error.message ?? 'Réinitialisation impossible.'
      return
    }
    success.value = true
  }
  catch {
    error.value = 'Le lien est invalide, expiré ou le service est indisponible.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <AppCard class="p-6 sm:p-8">
    <AppBadge tone="accent" dot>
      Nouveau mot de passe
    </AppBadge>
    <h1 class="text-2xl font-900 mb-2 mt-4">
      Réinitialiser le mot de passe
    </h1>
    <div v-if="success" class="mt-6">
      <p class="text-sm text-green-300 p-3 border border-green-500/25 rounded-xl bg-green-500/8" role="status">
        Mot de passe mis à jour.
      </p>
      <AppButton block @click="navigateTo('/login')">
        Se connecter
      </AppButton>
    </div>
    <form v-else class="mt-6 space-y-4" @submit.prevent="submit">
      <AppFormField label="Nouveau mot de passe" for="reset-password" required>
        <AppInput id="reset-password" v-model="password" type="password" autocomplete="new-password" required />
      </AppFormField>
      <AppFormField label="Confirmation" for="reset-confirmation" required>
        <AppInput id="reset-confirmation" v-model="confirmation" type="password" autocomplete="new-password" required />
      </AppFormField>
      <p v-if="error" class="text-sm text-red-300 p-3 border border-red-500/25 rounded-xl bg-red-500/8" role="alert">
        {{ error }}
      </p>
      <AppButton type="submit" :loading="loading" block>
        Mettre à jour
      </AppButton>
    </form>
  </AppCard>
</template>
