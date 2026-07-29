<script setup lang="ts">
import type { NeedFormValues } from '~~/shared/domain'
import { createEmptyNeedForm, needUrgencyLabels } from '~~/shared/domain'

interface ClientOption {
  _id: string
  name: string
}

const props = withDefaults(defineProps<{
  initialValue?: NeedFormValues
  clients: readonly ClientOption[]
  loading?: boolean
  showPublish?: boolean
  submitLabel?: string
}>(), {
  loading: false,
  showPublish: true,
  submitLabel: 'Enregistrer les modifications',
})

const emit = defineEmits<{
  submit: [values: NeedFormValues, publish: boolean]
  cancel: []
  addClient: []
}>()

const form = reactive<NeedFormValues>({
  ...createEmptyNeedForm(),
  ...props.initialValue,
})
const errors = reactive<Record<string, string>>({})

watch(
  () => props.initialValue,
  (value) => {
    if (value)
      Object.assign(form, value)
  },
  { deep: true },
)

const urgencyOptions = Object.entries(needUrgencyLabels).map(([value, label]) => ({ value, label }))
const clientOptions = computed(() => props.clients.map(client => ({ value: client._id, label: client.name })))

function validate() {
  Object.keys(errors).forEach(key => delete errors[key])

  if (!form.clientId)
    errors.clientId = 'Sélectionnez un client.'
  if (form.truckType.trim().length < 2)
    errors.truckType = 'Indiquez le type de camion.'
  if (!Number.isInteger(Number(form.requestedTruckCount)) || Number(form.requestedTruckCount) <= 0)
    errors.requestedTruckCount = 'Saisissez une quantité entière positive.'
  if (!Number.isFinite(Number(form.tonnageTons)) || Number(form.tonnageTons) <= 0)
    errors.tonnageTons = 'Saisissez un tonnage positif.'
  if (form.cargoType.trim().length < 2)
    errors.cargoType = 'Indiquez la marchandise.'
  if (form.loadingLocation.trim().length < 2)
    errors.loadingLocation = 'Indiquez le lieu de chargement.'
  if (form.destination.trim().length < 2)
    errors.destination = 'Indiquez la destination.'
  if (!form.mobilizationAt || Number.isNaN(new Date(form.mobilizationAt).getTime()))
    errors.mobilizationAt = 'Indiquez une date de mobilisation valide.'
  if (
    form.targetCarrierPrice !== undefined
    && form.maximumCarrierPrice !== undefined
    && Number(form.targetCarrierPrice) > Number(form.maximumCarrierPrice)
  ) {
    errors.maximumCarrierPrice = 'Le plafond doit être supérieur ou égal au prix cible.'
  }

  return Object.keys(errors).length === 0
}

function submit(publish: boolean) {
  if (!validate()) {
    document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  emit('submit', {
    ...form,
    requestedTruckCount: Number(form.requestedTruckCount),
    tonnageTons: Number(form.tonnageTons),
    rotations: form.rotations ? Number(form.rotations) : undefined,
    targetCarrierPrice: form.targetCarrierPrice ? Number(form.targetCarrierPrice) : undefined,
    maximumCarrierPrice: form.maximumCarrierPrice ? Number(form.maximumCarrierPrice) : undefined,
  }, publish)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit(false)">
    <AppCard>
      <div class="mb-5 flex gap-3 items-center">
        <span class="text-blue-300 rounded-xl bg-blue-500/10 flex h-9 w-9 items-center justify-center">
          <span class="i-carbon-identification" />
        </span>
        <div>
          <h2 class="text-base font-800 m-0">
            Identification
          </h2>
          <p class="text-xs text-[var(--color-text-muted)] m-0 mt-0.5">
            La référence sera attribuée automatiquement.
          </p>
        </div>
      </div>
      <div class="gap-4 grid sm:grid-cols-2">
        <AppFormField label="Client" for="need-client" :error="errors.clientId" required>
          <div class="flex gap-2">
            <AppSelect id="need-client" v-model="form.clientId" :options="clientOptions" placeholder="Sélectionner un client" />
            <button class="icon-btn shrink-0" type="button" aria-label="Ajouter un client" @click="emit('addClient')">
              <span class="i-carbon-add" />
            </button>
          </div>
        </AppFormField>
        <AppFormField label="Projet" for="need-project">
          <AppInput id="need-project" v-model="form.projectName" placeholder="Nom du projet ou chantier" />
        </AppFormField>
      </div>
    </AppCard>

    <AppCard>
      <div class="mb-5 flex gap-3 items-center">
        <span class="text-orange-300 rounded-xl bg-orange-500/10 flex h-9 w-9 items-center justify-center">
          <span class="i-carbon-warning-alt" />
        </span>
        <h2 class="text-base font-800 m-0">
          Urgence, camion et tonnage
        </h2>
      </div>
      <div class="gap-4 grid lg:grid-cols-4 sm:grid-cols-2">
        <AppFormField label="Urgence" for="need-urgency" required>
          <AppSelect id="need-urgency" v-model="form.urgency" :options="urgencyOptions" />
        </AppFormField>
        <AppFormField label="Type de camion" for="need-truck-type" :error="errors.truckType" required>
          <AppInput id="need-truck-type" v-model="form.truckType" placeholder="Semi-remorque" />
        </AppFormField>
        <AppFormField label="Camions demandés" for="need-requested" :error="errors.requestedTruckCount" required>
          <AppInput id="need-requested" v-model="form.requestedTruckCount" type="number" min="1" step="1" />
        </AppFormField>
        <AppFormField label="Tonnage par camion" for="need-tonnage" hint="Tonnes" :error="errors.tonnageTons" required>
          <AppInput id="need-tonnage" v-model="form.tonnageTons" type="number" min="0.1" step="0.1" />
        </AppFormField>
      </div>
    </AppCard>

    <AppCard>
      <div class="mb-5 flex gap-3 items-center">
        <span class="text-green-300 rounded-xl bg-green-500/10 flex h-9 w-9 items-center justify-center">
          <span class="i-carbon-cube" />
        </span>
        <h2 class="text-base font-800 m-0">
          Marchandise et trajet
        </h2>
      </div>
      <div class="gap-4 grid sm:grid-cols-2">
        <AppFormField label="Marchandise" for="need-cargo" :error="errors.cargoType" required>
          <AppInput id="need-cargo" v-model="form.cargoType" placeholder="Matériaux de construction" />
        </AppFormField>
        <AppFormField label="Conditionnement" for="need-packaging">
          <AppInput id="need-packaging" v-model="form.packaging" placeholder="Sacs, palettes, vrac…" />
        </AppFormField>
        <AppFormField label="Lieu de chargement" for="need-loading" :error="errors.loadingLocation" required>
          <AppInput id="need-loading" v-model="form.loadingLocation" placeholder="Abidjan - Vridi" />
        </AppFormField>
        <AppFormField label="Destination" for="need-destination" :error="errors.destination" required>
          <AppInput id="need-destination" v-model="form.destination" placeholder="Bondoukou" />
        </AppFormField>
      </div>
    </AppCard>

    <AppCard>
      <div class="mb-5 flex gap-3 items-center">
        <span class="text-teal-300 rounded-xl bg-teal-500/10 flex h-9 w-9 items-center justify-center">
          <span class="i-carbon-time" />
        </span>
        <h2 class="text-base font-800 m-0">
          Mobilisation et rotations
        </h2>
      </div>
      <div class="gap-4 grid sm:grid-cols-3">
        <AppFormField label="Date et heure" for="need-mobilization" :error="errors.mobilizationAt" required>
          <AppInput id="need-mobilization" v-model="form.mobilizationAt" type="datetime-local" />
        </AppFormField>
        <AppFormField label="Rotations" for="need-rotations">
          <AppInput id="need-rotations" v-model="form.rotations" type="number" min="1" step="1" placeholder="Optionnel" />
        </AppFormField>
        <AppFormField label="Durée estimée" for="need-duration">
          <AppInput id="need-duration" v-model="form.estimatedDuration" placeholder="2 jours" />
        </AppFormField>
      </div>
    </AppCard>

    <AppCard>
      <div class="mb-5 flex gap-3 items-center">
        <span class="text-purple-300 rounded-xl bg-purple-500/10 flex h-9 w-9 items-center justify-center">
          <span class="i-carbon-currency-dollar" />
        </span>
        <h2 class="text-base font-800 m-0">
          Prix et conditions
        </h2>
      </div>
      <div class="gap-4 grid sm:grid-cols-2">
        <AppFormField label="Prix cible transporteur" for="need-target-price" hint="F CFA">
          <AppInput id="need-target-price" v-model="form.targetCarrierPrice" type="number" min="0" step="1000" />
        </AppFormField>
        <AppFormField label="Prix plafond transporteur" for="need-max-price" hint="F CFA" :error="errors.maximumCarrierPrice">
          <AppInput id="need-max-price" v-model="form.maximumCarrierPrice" type="number" min="0" step="1000" />
        </AppFormField>
        <AppFormField label="Conditions de paiement" for="need-payment">
          <AppInput id="need-payment" v-model="form.paymentTerms" placeholder="Net à payer après livraison" />
        </AppFormField>
        <AppFormField label="Négociation">
          <label class="text-sm px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] flex min-h-11 cursor-pointer items-center justify-between">
            <span>Prix négociable</span>
            <input v-model="form.negotiationAllowed" type="checkbox" class="accent-[var(--color-accent)] h-4 w-4">
          </label>
        </AppFormField>
      </div>
    </AppCard>

    <AppCard>
      <div class="mb-5 flex gap-3 items-center">
        <span class="text-red-300 rounded-xl bg-red-500/10 flex h-9 w-9 items-center justify-center">
          <span class="i-carbon-document" />
        </span>
        <h2 class="text-base font-800 m-0">
          Contraintes
        </h2>
      </div>
      <AppFormField label="Notes et exigences" for="need-constraints">
        <AppTextarea
          id="need-constraints"
          v-model="form.constraints"
          :rows="5"
          placeholder="Documents obligatoires, conditions d’accès, équipements, horaires…"
        />
      </AppFormField>
    </AppCard>

    <div class="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 flex flex-col-reverse gap-2 bottom-18 sticky z-20 backdrop-blur -mx-4 sm:mx-0 sm:border sm:rounded-2xl sm:flex-row lg:bottom-3 sm:justify-end">
      <AppButton variant="ghost" :disabled="loading" @click="emit('cancel')">
        Annuler
      </AppButton>
      <AppButton type="submit" variant="secondary" :loading="loading">
        {{ submitLabel }}
      </AppButton>
      <AppButton v-if="showPublish" type="button" variant="success" :loading="loading" @click="submit(true)">
        <template #leading>
          <span class="i-carbon-send" />
        </template>
        Publier le besoin
      </AppButton>
    </div>
  </form>
</template>
