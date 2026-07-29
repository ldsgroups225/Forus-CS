<script setup lang="ts">
import type { ClientFormValues } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { buildPhoneUrl, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const { enqueue } = useOfflineMutationQueue()
const { organization } = useCurrentOrganization()
const queryArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null)
const { data: clients, isPending, error } = useConvexQuery(api.clients.listAll, queryArgs)
const search = shallowRef('')
const formOpen = shallowRef(false)
const editingId = shallowRef<Id<'clients'>>()
const submitting = shallowRef(false)
const feedback = shallowRef('')
const form = reactive<ClientFormValues>({
  name: '',
  contactName: '',
  phone: '',
  email: '',
})

const filteredClients = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  return (clients.value ?? []).filter(client =>
    !needle
    || [client.name, client.contactName, client.phone, client.email]
      .filter(Boolean)
      .some(value => value?.toLocaleLowerCase('fr').includes(needle)))
})

function resetForm() {
  editingId.value = undefined
  Object.assign(form, { name: '', contactName: '', phone: '', email: '' })
}

function createClient() {
  resetForm()
  formOpen.value = true
}

function editClient(client: NonNullable<typeof clients.value>[number]) {
  editingId.value = client._id
  Object.assign(form, {
    name: client.name,
    contactName: client.contactName ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
  })
  formOpen.value = true
}

async function saveClient() {
  if (!organization.value || form.name.trim().length < 2)
    return

  submitting.value = true
  feedback.value = ''
  try {
    const values = {
      name: form.name,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
    }
    if (!navigator.onLine && !editingId.value) {
      await enqueue(organization.value._id, 'clients.create', {
        organizationId: organization.value._id,
        ...values,
      })
      feedback.value = 'Client conservé hors ligne. Il sera synchronisé au retour du réseau.'
      formOpen.value = false
      resetForm()
      return
    }
    if (editingId.value) {
      await $convex.mutation(api.clients.update, {
        clientId: editingId.value,
        ...values,
      })
    }
    else {
      await $convex.mutation(api.clients.create, {
        organizationId: organization.value._id,
        ...values,
      })
    }
    feedback.value = editingId.value ? 'Client mis à jour.' : 'Client créé.'
    formOpen.value = false
    resetForm()
  }
  catch {
    feedback.value = 'Impossible d’enregistrer ce client. Vérifiez les informations.'
  }
  finally {
    submitting.value = false
  }
}

async function toggleClient(client: NonNullable<typeof clients.value>[number]) {
  try {
    await $convex.mutation(api.clients.setActive, {
      clientId: client._id,
      isActive: !client.isActive,
    })
    feedback.value = client.isActive ? 'Client désactivé.' : 'Client réactivé.'
  }
  catch {
    feedback.value = 'Cette action n’est pas autorisée.'
  }
}
</script>

<template>
  <div class="page-container">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs text-[var(--color-accent)] tracking-[0.16em] font-800 mb-1 uppercase">
          Référentiel commercial
        </p>
        <h1 class="text-2xl font-900 m-0 sm:text-3xl">
          Clients
        </h1>
        <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
          Coordonnées, activation et historique des donneurs d’ordre.
        </p>
      </div>
      <AppButton @click="createClient">
        <template #leading>
          <span class="i-carbon-add" />
        </template>
        Nouveau client
      </AppButton>
    </div>

    <p v-if="feedback" class="text-sm mb-4 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]" role="status">
      {{ feedback }}
    </p>

    <AppCard class="mb-5 p-3 sm:p-4">
      <div class="relative">
        <span class="i-carbon-search text-[var(--color-text-subtle)] left-3.5 top-1/2 absolute -translate-y-1/2" />
        <AppInput
          id="clients-search"
          v-model="search"
          aria-label="Rechercher un client"
          class="pl-10"
          placeholder="Nom, contact, téléphone ou e-mail…"
        />
      </div>
    </AppCard>

    <div v-if="isPending" class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="index in 6" :key="index">
        <AppSkeleton :lines="4" />
      </AppCard>
    </div>
    <p v-else-if="error" class="text-sm text-red-300" role="alert">
      Impossible de charger les clients.
    </p>
    <AppEmptyState
      v-else-if="filteredClients.length === 0"
      title="Aucun client"
      description="Créez le premier client avant d’enregistrer un besoin."
      icon="i-carbon-enterprise"
    />
    <div v-else class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="client in filteredClients" :key="client._id" :interactive="true">
        <div class="flex gap-3 items-start justify-between">
          <div class="min-w-0">
            <h2 class="text-base font-900 m-0 truncate">
              {{ client.name }}
            </h2>
            <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1 truncate">
              {{ client.contactName || 'Contact non renseigné' }}
            </p>
          </div>
          <AppBadge :tone="client.isActive ? 'success' : 'neutral'" dot>
            {{ client.isActive ? 'Actif' : 'Inactif' }}
          </AppBadge>
        </div>
        <div class="text-sm mt-5 space-y-2">
          <a v-if="client.phone" :href="buildPhoneUrl(client.phone)" class="flex gap-2 items-center hover:text-[var(--color-accent)]">
            <span class="i-carbon-phone" /> {{ formatPhoneNumber(client.phone) }}
          </a>
          <a v-if="client.email" :href="`mailto:${client.email}`" class="flex gap-2 truncate items-center hover:text-[var(--color-accent)]">
            <span class="i-carbon-email" /> {{ client.email }}
          </a>
        </div>
        <div class="mt-5 flex flex-wrap gap-2">
          <AppButton size="sm" variant="secondary" @click="editClient(client)">
            Modifier
          </AppButton>
          <a
            v-if="client.phone"
            :href="buildWhatsAppUrl(client.phone, `Bonjour ${client.contactName || client.name},\\n\\nÉquipe Forus CS.`)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-green-300 font-800 px-3 py-2 border border-green-500/30 rounded-xl inline-flex gap-2 min-h-9 items-center"
          >
            <span class="i-carbon-logo-whatsapp" /> WhatsApp
          </a>
          <AppButton size="sm" :variant="client.isActive ? 'ghost' : 'success'" @click="toggleClient(client)">
            {{ client.isActive ? 'Désactiver' : 'Réactiver' }}
          </AppButton>
        </div>
      </AppCard>
    </div>

    <AppModal v-model="formOpen" :title="editingId ? 'Modifier le client' : 'Nouveau client'">
      <form class="space-y-4" @submit.prevent="saveClient">
        <AppFormField label="Nom du client" for="client-name" required>
          <AppInput id="client-name" v-model="form.name" autocomplete="organization" required />
        </AppFormField>
        <AppFormField label="Contact principal" for="client-contact">
          <AppInput id="client-contact" v-model="form.contactName" autocomplete="name" />
        </AppFormField>
        <div class="gap-4 grid sm:grid-cols-2">
          <AppFormField label="Téléphone" for="client-phone">
            <AppInput id="client-phone" v-model="form.phone" type="tel" autocomplete="tel" placeholder="+225…" />
          </AppFormField>
          <AppFormField label="E-mail" for="client-email">
            <AppInput id="client-email" v-model="form.email" type="email" autocomplete="email" />
          </AppFormField>
        </div>
        <div class="pt-2 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="formOpen = false">
            Annuler
          </AppButton>
          <AppButton type="submit" :loading="submitting">
            Enregistrer
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
