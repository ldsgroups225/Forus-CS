<script setup lang="ts">
import { api } from '../../../convex/_generated/api'

definePageMeta({ layout: 'auth' })

const { $convex } = useNuxtApp()
const name = ref('')
const slug = ref('')
const slugEdited = ref(false)
const errorMessage = ref('')
const loading = ref(false)
const seedLoading = ref(false)
const isDevelopment = import.meta.dev

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

watch(name, (value) => {
  if (!slugEdited.value)
    slug.value = slugify(value)
})

async function submit() {
  errorMessage.value = ''

  if (name.value.trim().length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)) {
    errorMessage.value = 'Vérifiez le nom et l’identifiant de l’organisation.'
    return
  }

  loading.value = true
  try {
    const result = await $convex.mutation(api.organizations.create, {
      name: name.value,
      slug: slug.value,
    })
    await navigateTo(`/o/${result.slug}/operations`)
  }
  catch (error) {
    errorMessage.value = error instanceof Error && error.message.includes('SLUG_TAKEN')
      ? 'Cet identifiant est déjà utilisé.'
      : 'Impossible de créer l’organisation. Réessayez.'
  }
  finally {
    loading.value = false
  }
}

async function seedDemo() {
  errorMessage.value = ''
  seedLoading.value = true

  try {
    const result = await $convex.mutation(api.seed.seedDevelopment, {})
    await navigateTo(`/o/${result.slug}/operations`)
  }
  catch {
    errorMessage.value = 'Impossible de charger la démonstration. Vérifiez que Convex utilise une configuration locale.'
  }
  finally {
    seedLoading.value = false
  }
}
</script>

<template>
  <AppCard class="p-6 sm:p-8">
    <div class="mb-7">
      <div class="text-2xl text-[var(--color-accent)] mb-5 rounded-2xl bg-[var(--color-accent-soft)] flex h-12 w-12 items-center justify-center">
        <span class="i-carbon-enterprise" />
      </div>
      <h1 class="text-2xl font-900 mb-2">
        Créez votre organisation
      </h1>
      <p class="text-sm text-[var(--color-text-muted)] leading-6 m-0">
        Vous en deviendrez automatiquement l’administrateur.
      </p>
    </div>

    <form class="space-y-5" @submit.prevent="submit">
      <AppFormField label="Nom de l’organisation" for="organization-name" required>
        <AppInput id="organization-name" v-model="name" placeholder="FORUS GROUP" />
      </AppFormField>
      <AppFormField label="Identifiant URL" for="organization-slug" hint="Lettres, chiffres et tirets" required>
        <div class="relative">
          <AppInput
            id="organization-slug"
            v-model="slug"
            placeholder="forus-group"
            @input="slugEdited = true"
          />
        </div>
      </AppFormField>

      <p v-if="errorMessage" class="text-sm text-red-300 px-3.5 py-3 border border-red-500/25 rounded-xl bg-red-500/10" role="alert">
        {{ errorMessage }}
      </p>

      <AppButton type="submit" :loading="loading" block size="lg">
        Créer et continuer
      </AppButton>
    </form>

    <div v-if="isDevelopment" class="mt-6 pt-6 border-t border-[var(--color-border)]">
      <p class="text-xs text-[var(--color-text-subtle)] leading-5 mb-3 mt-0">
        En développement uniquement : chargez une organisation FORUS GROUP avec trois clients et huit besoins.
      </p>
      <AppButton variant="secondary" :loading="seedLoading" block @click="seedDemo">
        Charger la démonstration FORUS
      </AppButton>
    </div>
  </AppCard>
</template>
