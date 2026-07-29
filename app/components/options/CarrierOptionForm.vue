<script setup lang="ts">
import type { CarrierOptionFormValues } from '~~/shared/domain'
import { createEmptyCarrierOptionForm } from '~~/shared/domain'

const props = withDefaults(defineProps<{
  initialValue?: CarrierOptionFormValues
  truckType?: string
  maximumTruckCount: number
  loading?: boolean
  submitLabel?: string
}>(), {
  truckType: '',
  loading: false,
  submitLabel: 'Soumettre l’option',
})

const emit = defineEmits<{
  submit: [values: CarrierOptionFormValues]
  cancel: []
}>()

const form = reactive<CarrierOptionFormValues>({
  ...createEmptyCarrierOptionForm(props.truckType),
  ...props.initialValue,
})
const errors = reactive<Record<string, string>>({})

function validate() {
  Object.keys(errors).forEach(key => delete errors[key])

  if (form.carrierName.trim().length < 2)
    errors.carrierName = 'Indiquez le nom du transporteur.'
  if (form.truckType.trim().length < 2)
    errors.truckType = 'Indiquez le type de camion.'
  if (!Number.isInteger(Number(form.proposedTruckCount)) || Number(form.proposedTruckCount) <= 0)
    errors.proposedTruckCount = 'Saisissez une quantité entière positive.'
  else if (Number(form.proposedTruckCount) > props.maximumTruckCount)
    errors.proposedTruckCount = `Le besoin ne requiert plus que ${props.maximumTruckCount} camion(s).`
  if (!Number.isFinite(Number(form.pricePerTruck)) || Number(form.pricePerTruck) <= 0)
    errors.pricePerTruck = 'Saisissez un prix unitaire positif.'
  if (!form.availableAt || Number.isNaN(new Date(form.availableAt).getTime()))
    errors.availableAt = 'Indiquez une disponibilité valide.'
  if (form.carrierEmail && !form.carrierEmail.includes('@'))
    errors.carrierEmail = 'Saisissez une adresse e-mail valide.'

  return Object.keys(errors).length === 0
}

function submit() {
  if (!validate())
    return

  emit('submit', {
    ...form,
    proposedTruckCount: Number(form.proposedTruckCount),
    pricePerTruck: Number(form.pricePerTruck),
  })
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs text-[var(--color-text-muted)] m-0">
        Vérifiez la quantité, le prix et la disponibilité avant l’envoi.
      </p>
      <AppButton data-testid="carrier-option-submit-top" type="submit" size="sm" :loading="loading">
        <template #leading>
          <span class="i-carbon-send" />
        </template>
        {{ submitLabel }}
      </AppButton>
    </div>

    <div class="gap-4 grid sm:grid-cols-2">
      <AppFormField label="Transporteur" for="option-carrier" :error="errors.carrierName" required>
        <AppInput id="option-carrier" v-model="form.carrierName" autocomplete="organization" placeholder="TransLog SARL" />
      </AppFormField>
      <AppFormField label="Téléphone" for="option-phone">
        <AppInput id="option-phone" v-model="form.carrierPhone" type="tel" autocomplete="tel" placeholder="07 00 00 00 00" />
      </AppFormField>
      <AppFormField label="E-mail" for="option-email" :error="errors.carrierEmail">
        <AppInput id="option-email" v-model="form.carrierEmail" type="email" autocomplete="email" placeholder="contact@transporteur.ci" />
      </AppFormField>
      <AppFormField label="Type de camion" for="option-truck-type" :error="errors.truckType" required>
        <AppInput id="option-truck-type" v-model="form.truckType" placeholder="Semi-remorque" />
      </AppFormField>
      <AppFormField label="Camions proposés" for="option-count" :hint="`Maximum ${maximumTruckCount}`" :error="errors.proposedTruckCount" required>
        <AppInput id="option-count" v-model="form.proposedTruckCount" type="number" min="1" :max="maximumTruckCount" step="1" />
      </AppFormField>
      <AppFormField label="Prix par camion" for="option-price" hint="FCFA" :error="errors.pricePerTruck" required>
        <AppInput id="option-price" v-model="form.pricePerTruck" type="number" min="1000" step="1000" />
      </AppFormField>
      <AppFormField label="Disponible à partir du" for="option-available" :error="errors.availableAt" required>
        <AppInput id="option-available" v-model="form.availableAt" type="datetime-local" />
      </AppFormField>
      <AppFormField label="Conditions de paiement" for="option-payment">
        <AppInput id="option-payment" v-model="form.paymentTerms" placeholder="Net à payer après livraison" />
      </AppFormField>
    </div>

    <AppFormField label="Conformité documentaire">
      <label class="text-sm px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] flex gap-3 min-h-11 cursor-pointer items-center">
        <input v-model="form.documentsConfirmed" type="checkbox" class="accent-[var(--color-accent)] h-4 w-4">
        Carte grise, assurance et documents de transport vérifiés
      </label>
    </AppFormField>

    <AppFormField label="Notes" for="option-notes">
      <AppTextarea id="option-notes" v-model="form.notes" :rows="3" placeholder="Disponibilité, équipements, contraintes ou précision tarifaire…" />
    </AppFormField>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <AppButton variant="ghost" :disabled="loading" @click="emit('cancel')">
        Annuler
      </AppButton>
      <AppButton type="submit" :loading="loading">
        <template #leading>
          <span class="i-carbon-send" />
        </template>
        {{ submitLabel }}
      </AppButton>
    </div>
  </form>
</template>
