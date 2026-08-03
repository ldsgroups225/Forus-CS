<script setup lang="ts">
import type { NeedFormValues } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const { organization } = useCurrentOrganization()
const clientArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null,
)
const { data: clients } = useConvexQuery(api.clients.list, clientArgs)

const loading = ref(false)
const errorMessage = ref('')
const clientModalOpen = ref(false)
const newClientName = ref('')
const newClientContactName = ref('')
const newClientPhone = ref('')
const newClientEmail = ref('')
const creatingClient = ref(false)

function mutationInput(values: NeedFormValues) {
  if (!organization.value)
    throw new Error('Organisation indisponible.')

  return {
    organizationId: organization.value._id,
    clientId: values.clientId as Id<'clients'>,
    projectName: values.projectName || undefined,
    urgency: values.urgency,
    truckType: values.truckType,
    requestedTruckCount: values.requestedTruckCount,
    tonnageTons: values.tonnageTons,
    cargoType: values.cargoType,
    packaging: values.packaging || undefined,
    loadingLocation: values.loadingLocation,
    destination: values.destination,
    mobilizationAt: new Date(values.mobilizationAt).getTime(),
    rotations: values.rotations,
    estimatedDuration: values.estimatedDuration || undefined,
    targetCarrierPrice: values.targetCarrierPrice,
    maximumCarrierPrice: values.maximumCarrierPrice,
    paymentTerms: values.paymentTerms || undefined,
    negotiationAllowed: values.negotiationAllowed,
    constraints: values.constraints,
  }
}

async function submit(values: NeedFormValues, publish: boolean) {
  loading.value = true
  errorMessage.value = ''
  try {
    const needId = await $convex.mutation(api.needs.createDraft, mutationInput(values))
    if (publish)
      await $convex.mutation(api.needs.publish, { needId })

    await navigateTo(`/o/${organization.value?.slug}/operations/needs/${needId}`)
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? `Le besoin n’a pas été enregistré : ${error.message}`
      : 'Le besoin n’a pas été enregistré.'
  }
  finally {
    loading.value = false
  }
}

async function createClient() {
  if (!organization.value || newClientName.value.trim().length < 2)
    return

  creatingClient.value = true
  try {
    await $convex.mutation(api.clients.create, {
      organizationId: organization.value._id,
      name: newClientName.value,
      contactName: newClientContactName.value || undefined,
      phone: newClientPhone.value || undefined,
      email: newClientEmail.value || undefined,
    })
    newClientName.value = ''
    newClientContactName.value = ''
    newClientPhone.value = ''
    newClientEmail.value = ''
    clientModalOpen.value = false
  }
  finally {
    creatingClient.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="mb-5">
      <button class="text-xs text-[var(--color-text-muted)] font-700 inline-flex gap-2 min-h-11 items-center hover:text-[var(--color-accent)] focus-ring" @click="$router.back()">
        <span class="i-carbon-arrow-left" />
        Retour aux besoins
      </button>
    </div>
    <AppPageHeader title="Créer un besoin opérationnel" description="Enregistrez un brouillon ou publiez immédiatement le besoin à l’équipe." />

    <p v-if="errorMessage" class="text-sm text-red-300 mb-5 px-4 py-3 border border-red-500/25 rounded-xl bg-red-500/10" role="alert">
      {{ errorMessage }}
    </p>

    <NeedForm
      :clients="clients ?? []"
      :loading="loading"
      submit-label="Enregistrer comme brouillon"
      @submit="submit"
      @cancel="navigateTo(`/o/${organization?.slug}/operations/needs`)"
      @add-client="clientModalOpen = true"
    />

    <AppModal v-model="clientModalOpen" title="Ajouter un client" description="Le client sera disponible immédiatement dans le formulaire.">
      <form class="space-y-4" @submit.prevent="createClient">
        <AppFormField label="Nom du client" for="new-client-name" required>
          <AppInput id="new-client-name" v-model="newClientName" placeholder="Nom de l’entreprise" />
        </AppFormField>
        <AppFormField label="Personne à contacter" for="new-client-contact">
          <AppInput id="new-client-contact" v-model="newClientContactName" placeholder="Nom du contact opérationnel" />
        </AppFormField>
        <AppFormField label="Téléphone" for="new-client-phone" hint="+225 ajouté automatiquement aux actions rapides">
          <AppInput id="new-client-phone" v-model="newClientPhone" type="tel" inputmode="tel" placeholder="07 08 09 10 11" />
        </AppFormField>
        <AppFormField label="Adresse e-mail" for="new-client-email">
          <AppInput id="new-client-email" v-model="newClientEmail" type="email" placeholder="operations@client.ci" />
        </AppFormField>
        <div class="flex gap-2 justify-end">
          <AppButton variant="ghost" @click="clientModalOpen = false">
            Annuler
          </AppButton>
          <AppButton type="submit" :loading="creatingClient">
            Ajouter le client
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
