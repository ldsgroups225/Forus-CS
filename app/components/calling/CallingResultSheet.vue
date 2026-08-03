<script setup lang="ts">
import type { CallOutcome } from '~~/shared/domain'
import type { Id } from '../../../convex/_generated/dataModel'
import { onUnmounted } from 'vue'
import { callOutcomeLabels } from '~~/shared/domain'
import { api } from '../../../convex/_generated/api'

interface VehicleRow {
  selectionMode: 'KNOWN' | 'MANUAL'
  vehicleId?: string
  registration: string
  truckType: string
  capacityTons: number
  location: string
  documentsConfirmed: boolean
}

interface CallingCarrier {
  _id: string
  name: string
  phone: string
  truckTypes: readonly string[]
  vehicles: readonly {
    _id: string
    registration: string
    truckType: string
    capacityTons: number
  }[]
}

const props = defineProps<{
  organizationId: Id<'organizations'>
  need: {
    _id: string
    truckType: string
    remainingTruckCount: number
    destination: string
  }
  carrier: CallingCarrier | null
}>()

const emit = defineEmits<{ submitted: [] }>()
const open = defineModel<boolean>({ default: false })
const { $convex } = useNuxtApp()
const outcome = ref<CallOutcome>('AVAILABLE')
const notes = ref('')
const availableAt = ref(new Date().toISOString().slice(0, 16))
const pricePerTruck = ref<number | undefined>()
const paymentTerms = ref('')
const followUpAt = ref('')
const vehicleRows = ref<VehicleRow[]>([])
const vehicleSearches = reactive<Record<number, string>>({})
const feedback = ref('')
const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const scheduleFollowUp = ref(false)
let draftTimer: ReturnType<typeof setTimeout> | undefined
const draftKey = computed(() =>
  props.carrier
    ? `forus-calling-draft:${props.organizationId}:${props.need._id}:${props.carrier._id}`
    : '',
)

const outcomeOptions = Object.entries(callOutcomeLabels).map(
  ([value, label]) => ({ value, label }),
)
const available = computed(() => outcome.value === 'AVAILABLE')
const followUpRequired = computed(
  () => outcome.value === 'CALLBACK' || outcome.value === 'UNAVAILABLE',
)
const showFollowUp = computed(
  () =>
    followUpRequired.value
    || (outcome.value === 'NO_ANSWER' && scheduleFollowUp.value),
)

function freshVehicle(): VehicleRow {
  return {
    selectionMode: props.carrier?.vehicles.length ? 'KNOWN' : 'MANUAL',
    registration: '',
    truckType: props.need.truckType,
    capacityTons: 0,
    location: '',
    documentsConfirmed: false,
  }
}

function reset() {
  outcome.value = 'AVAILABLE'
  notes.value = ''
  availableAt.value = new Date().toISOString().slice(0, 16)
  pricePerTruck.value = undefined
  paymentTerms.value = ''
  followUpAt.value = ''
  vehicleRows.value = [freshVehicle()]
  Object.keys(vehicleSearches).forEach(
    key => delete vehicleSearches[Number(key)],
  )
  feedback.value = ''
  errors.value = {}
  scheduleFollowUp.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    reset()
    if (import.meta.client && draftKey.value) {
      const stored = localStorage.getItem(draftKey.value)
      if (stored) {
        try {
          const draft = JSON.parse(stored) as Partial<{
            outcome: CallOutcome
            notes: string
            availableAt: string
            pricePerTruck: number
            paymentTerms: string
            followUpAt: string
            vehicleRows: Partial<VehicleRow>[]
            scheduleFollowUp: boolean
          }>
          outcome.value = draft.outcome ?? outcome.value
          notes.value = draft.notes ?? notes.value
          availableAt.value = draft.availableAt ?? availableAt.value
          pricePerTruck.value = draft.pricePerTruck ?? pricePerTruck.value
          paymentTerms.value = draft.paymentTerms ?? paymentTerms.value
          followUpAt.value = draft.followUpAt ?? followUpAt.value
          vehicleRows.value = draft.vehicleRows?.length
            ? draft.vehicleRows.map(vehicle => ({
                ...freshVehicle(),
                ...vehicle,
                selectionMode:
                  vehicle.selectionMode
                  ?? (vehicle.vehicleId ? 'KNOWN' : freshVehicle().selectionMode),
              }))
            : vehicleRows.value
          scheduleFollowUp.value
            = draft.scheduleFollowUp ?? scheduleFollowUp.value
        }
        catch {
          localStorage.removeItem(draftKey.value)
        }
      }
    }
  }
})

watch(outcome, () => {
  if (followUpRequired.value)
    scheduleFollowUp.value = true
})

watch(
  [
    outcome,
    notes,
    availableAt,
    pricePerTruck,
    paymentTerms,
    followUpAt,
    vehicleRows,
    scheduleFollowUp,
  ],
  () => {
    if (!import.meta.client || !open.value || !draftKey.value)
      return
    clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      localStorage.setItem(
        draftKey.value,
        JSON.stringify({
          outcome: outcome.value,
          notes: notes.value,
          availableAt: availableAt.value,
          pricePerTruck: pricePerTruck.value,
          paymentTerms: paymentTerms.value,
          followUpAt: followUpAt.value,
          vehicleRows: vehicleRows.value,
          scheduleFollowUp: scheduleFollowUp.value,
        }),
      )
    }, 350)
  },
  { deep: true },
)

onUnmounted(() => clearTimeout(draftTimer))

function selectKnownVehicle(row: VehicleRow, vehicleId: string) {
  if (
    vehicleRows.value.some(
      item => item !== row && item.vehicleId === vehicleId,
    )
  ) {
    return
  }
  const vehicle = props.carrier?.vehicles.find(
    item => item._id === vehicleId,
  )
  if (!vehicle) {
    row.vehicleId = undefined
    return
  }
  row.selectionMode = 'KNOWN'
  row.vehicleId = vehicle._id
  row.registration = vehicle.registration
  row.truckType = vehicle.truckType
  row.capacityTons = vehicle.capacityTons
}

function selectManualVehicle(row: VehicleRow) {
  row.selectionMode = 'MANUAL'
  row.vehicleId = undefined
  row.registration = ''
  row.truckType = props.need.truckType
  row.capacityTons = 0
}

function selectKnownVehicleMode(row: VehicleRow) {
  row.selectionMode = 'KNOWN'
  row.vehicleId = undefined
  row.registration = ''
  row.truckType = props.need.truckType
  row.capacityTons = 0
}

function knownVehiclesFor(index: number) {
  const query = vehicleSearches[index]?.trim().toLocaleLowerCase()
  if (!query)
    return props.carrier?.vehicles ?? []

  return (props.carrier?.vehicles ?? []).filter(vehicle =>
    `${vehicle.registration} ${vehicle.truckType} ${vehicle.capacityTons}`
      .toLocaleLowerCase()
      .includes(query),
  )
}

function isKnownVehicleUnavailable(row: VehicleRow, vehicleId: string) {
  return vehicleRows.value.some(
    item => item !== row && item.vehicleId === vehicleId,
  )
}

function addVehicle() {
  if (vehicleRows.value.length < props.need.remainingTruckCount)
    vehicleRows.value.push(freshVehicle())
}

function removeVehicle(index: number) {
  if (vehicleRows.value.length > 1)
    vehicleRows.value.splice(index, 1)
}

async function submit() {
  if (!props.carrier)
    return
  feedback.value = ''
  errors.value = {}
  if (available.value) {
    if (!pricePerTruck.value || pricePerTruck.value <= 0) {
      errors.value.pricePerTruck = 'Indiquez un prix supérieur à zéro.'
    }
    if (!availableAt.value)
      errors.value.availableAt = 'Indiquez l’heure de mobilisation.'
    vehicleRows.value.forEach((vehicle, index) => {
      if (vehicle.selectionMode === 'KNOWN' && !vehicle.vehicleId) {
        errors.value[`vehicle-${index}`]
          = 'Sélectionnez un véhicule CRM ou saisissez un nouveau camion.'
      }
      if (vehicle.selectionMode === 'MANUAL') {
        if (!vehicle.registration)
          errors.value[`registration-${index}`] = 'Immatriculation requise.'
        if (!vehicle.truckType)
          errors.value[`type-${index}`] = 'Type de camion requis.'
        if (!vehicle.capacityTons || vehicle.capacityTons <= 0)
          errors.value[`capacity-${index}`] = 'Capacité requise.'
      }
      if (!vehicle.location)
        errors.value[`location-${index}`] = 'Position requise.'
    })
  }
  if (showFollowUp.value && !followUpAt.value) {
    errors.value.followUpAt
      = 'Planifiez la relance pour ne pas perdre ce contact.'
  }
  if (Object.keys(errors.value).length) {
    feedback.value = 'Corrigez les champs indiqués avant de continuer.'
    return
  }

  submitting.value = true
  try {
    await $convex.mutation(api.calls.log, {
      organizationId: props.organizationId,
      carrierId: props.carrier._id as Id<'carriers'>,
      needId: props.need._id as Id<'needs'>,
      direction: 'OUTBOUND',
      outcome: outcome.value,
      phone: props.carrier.phone,
      notes: notes.value.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    })
    if (available.value) {
      const vehicles = await Promise.all(
        vehicleRows.value.map(async (vehicle) => {
          if (vehicle.vehicleId)
            return vehicle
          const vehicleId = await $convex.mutation(api.vehicles.create, {
            carrierId: props.carrier!._id as Id<'carriers'>,
            registration: vehicle.registration,
            truckType: vehicle.truckType,
            capacityTons: Number(vehicle.capacityTons),
          })
          return { ...vehicle, vehicleId }
        }),
      )
      await $convex.mutation(api.carrierOptions.create, {
        organizationId: props.organizationId,
        needId: props.need._id as Id<'needs'>,
        carrierId: props.carrier._id as Id<'carriers'>,
        carrierName: props.carrier.name,
        carrierPhone: props.carrier.phone,
        source: 'APPEL',
        truckType: props.need.truckType,
        proposedTruckCount: vehicles.length,
        pricePerTruck: pricePerTruck.value!,
        availableAt: new Date(availableAt.value).getTime(),
        acceptedDestination: props.need.destination,
        paymentTerms: paymentTerms.value.trim() || undefined,
        documentsConfirmed: vehicles.every(
          vehicle => vehicle.documentsConfirmed,
        ),
        notes: notes.value.trim() || undefined,
        vehicles: vehicles.map(vehicle => ({
          vehicleId: vehicle.vehicleId as Id<'vehicles'> | undefined,
          registration: vehicle.registration,
          truckType: vehicle.truckType,
          capacityTons: Number(vehicle.capacityTons),
          location: vehicle.location,
          documentsConfirmed: vehicle.documentsConfirmed,
        })),
      })
    }
    else if (showFollowUp.value && followUpAt.value) {
      await $convex.mutation(api.calls.createFollowUp, {
        organizationId: props.organizationId,
        carrierId: props.carrier._id as Id<'carriers'>,
        needId: props.need._id as Id<'needs'>,
        dueAt: new Date(followUpAt.value).getTime(),
        notes: notes.value.trim() || `Relancer pour ${props.need.destination}.`,
        idempotencyKey: crypto.randomUUID(),
      })
    }
    open.value = false
    if (import.meta.client && draftKey.value)
      localStorage.removeItem(draftKey.value)
    emit('submitted')
  }
  catch {
    feedback.value
      = 'Enregistrement impossible. Vérifiez les informations puis réessayez.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal
    v-model="open"
    title="Retour d’appel"
    :description="carrier ? `${carrier.name} · besoin actif` : ''"
  >
    <form class="space-y-4" @submit.prevent="submit">
      <AppFormField label="Résultat" for="calling-result" required>
        <AppSelect
          id="calling-result"
          v-model="outcome"
          :options="outcomeOptions"
        />
      </AppFormField>

      <template v-if="available">
        <div
          class="p-3 border border-[var(--color-accent)]/35 rounded-xl bg-[var(--color-accent-soft)]"
        >
          <p class="text-sm font-800 m-0">
            Camions proposés pour ce besoin
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
            Même prix, destination et mobilisation pour tous les camions de ce
            retour.
          </p>
        </div>
        <div
          v-for="(vehicle, index) in vehicleRows"
          :key="index"
          class="p-3 border border-[var(--color-border)] rounded-xl space-y-3"
        >
          <div class="flex items-center justify-between">
            <strong class="text-sm">Camion {{ index + 1 }}</strong>
            <button
              v-if="vehicleRows.length > 1"
              type="button"
              class="text-xs text-[var(--color-danger)] focus-ring"
              @click="removeVehicle(index)"
            >
              Retirer
            </button>
          </div>
          <fieldset
            v-if="carrier?.vehicles.length && vehicle.selectionMode === 'KNOWN'"
            class="m-0 p-0 border-0"
            :aria-describedby="
              errors[`vehicle-${index}`] ? `vehicle-error-${index}` : undefined
            "
          >
            <legend class="text-sm text-[var(--color-text)] font-700">
              Immatriculation du véhicule
            </legend>
            <p class="text-xs text-[var(--color-text-muted)] mb-3 mt-1">
              Touchez le camion confirmé par le transporteur.
            </p>
            <AppInput
              v-if="carrier.vehicles.length > 4"
              :id="`vehicle-search-${index}`"
              v-model="vehicleSearches[index]"
              autocomplete="off"
              placeholder="Rechercher une immatriculation"
            />
            <div class="mt-2 space-y-2">
              <button
                v-for="knownVehicle in knownVehiclesFor(index)"
                :key="knownVehicle._id"
                type="button"
                class="vehicle-choice focus-ring"
                :class="
                  vehicle.vehicleId === knownVehicle._id
                    && 'vehicle-choice-selected'
                "
                :data-testid="`vehicle-choice-${index}-${knownVehicle.registration}`"
                :aria-pressed="vehicle.vehicleId === knownVehicle._id"
                :disabled="isKnownVehicleUnavailable(vehicle, knownVehicle._id)"
                @click="selectKnownVehicle(vehicle, knownVehicle._id)"
              >
                <span class="text-left min-w-0">
                  <strong class="block truncate">{{
                    knownVehicle.registration
                  }}</strong>
                  <span
                    class="text-xs text-[var(--color-text-muted)] mt-0.5 block"
                  >{{ knownVehicle.truckType }}</span>
                </span>
                <span class="flex gap-2 items-center">
                  <span class="vehicle-capacity">{{ knownVehicle.capacityTons }} t</span>
                  <span
                    v-if="vehicle.vehicleId === knownVehicle._id"
                    class="i-carbon-checkmark-filled text-lg text-[var(--color-accent)]"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </div>
            <p
              v-if="vehicleSearches[index] && !knownVehiclesFor(index).length"
              class="text-xs text-[var(--color-text-muted)] mb-0 mt-3"
            >
              Aucun véhicule CRM ne correspond à cette immatriculation.
            </p>
            <p
              v-if="errors[`vehicle-${index}`]"
              :id="`vehicle-error-${index}`"
              class="text-xs text-[var(--color-danger)] mb-0 mt-2"
              role="alert"
            >
              {{ errors[`vehicle-${index}`] }}
            </p>
            <button
              type="button"
              class="text-xs text-[var(--color-accent)] font-700 mt-3 focus-ring"
              @click="selectManualVehicle(vehicle)"
            >
              Le camion n’est pas dans la flotte
            </button>
          </fieldset>
          <div v-else class="space-y-3">
            <div
              v-if="carrier?.vehicles.length"
              class="flex gap-3 items-center justify-between"
            >
              <div>
                <strong class="text-sm">Nouveau véhicule</strong>
                <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-0.5">
                  Il sera ajouté au CRM après soumission.
                </p>
              </div>
              <button
                type="button"
                class="text-xs text-[var(--color-accent)] font-700 focus-ring"
                @click="selectKnownVehicleMode(vehicle)"
              >
                Choisir dans la flotte
              </button>
            </div>
            <div class="gap-3 grid grid-cols-2">
              <AppFormField
                label="Immatriculation"
                :for="`registration-${index}`"
                required
                :error="errors[`registration-${index}`]"
              >
                <AppInput
                  :id="`registration-${index}`"
                  v-model="vehicle.registration"
                  :aria-invalid="Boolean(errors[`registration-${index}`])"
                  required
                  placeholder="AB-1234-CI"
                />
              </AppFormField>
              <AppFormField
                label="Capacité (t)"
                :for="`capacity-${index}`"
                required
                :error="errors[`capacity-${index}`]"
              >
                <AppInput
                  :id="`capacity-${index}`"
                  v-model="vehicle.capacityTons"
                  :aria-invalid="Boolean(errors[`capacity-${index}`])"
                  required
                  type="number"
                  min="1"
                  step="0.5"
                />
              </AppFormField>
            </div>
            <div class="gap-3 grid grid-cols-2">
              <AppFormField
                label="Type"
                :for="`type-${index}`"
                required
                :error="errors[`type-${index}`]"
              >
                <AppInput
                  :id="`type-${index}`"
                  v-model="vehicle.truckType"
                  :aria-invalid="Boolean(errors[`type-${index}`])"
                  required
                />
              </AppFormField>
              <AppFormField
                label="Position"
                :for="`location-${index}`"
                required
                :error="errors[`location-${index}`]"
              >
                <AppInput
                  :id="`location-${index}`"
                  v-model="vehicle.location"
                  :aria-invalid="Boolean(errors[`location-${index}`])"
                  required
                  placeholder="Abidjan"
                />
              </AppFormField>
            </div>
          </div>
          <AppFormField
            v-if="vehicle.selectionMode === 'KNOWN'"
            label="Position"
            :for="`location-${index}`"
            required
            :error="errors[`location-${index}`]"
          >
            <AppInput
              :id="`location-${index}`"
              v-model="vehicle.location"
              :aria-invalid="Boolean(errors[`location-${index}`])"
              required
              placeholder="Abidjan"
            />
          </AppFormField>
          <label class="text-xs flex gap-2 items-center"><input
            v-model="vehicle.documentsConfirmed"
            type="checkbox"
            class="accent-[var(--color-accent)]"
          >
            Documents confirmés</label>
        </div>
        <AppButton
          v-if="vehicleRows.length < need.remainingTruckCount"
          type="button"
          variant="secondary"
          block
          @click="addVehicle"
        >
          <span class="i-carbon-add" /> Ajouter un camion
        </AppButton>
        <div class="gap-3 grid grid-cols-2">
          <AppFormField
            label="Prix / camion"
            for="calling-price"
            required
            :error="errors.pricePerTruck"
          >
            <AppInput
              id="calling-price"
              v-model="pricePerTruck"
              :aria-invalid="Boolean(errors.pricePerTruck)"
              required
              type="number"
              min="1"
              step="1000"
            />
          </AppFormField>
          <AppFormField
            label="Disponible le"
            for="calling-available"
            required
            :error="errors.availableAt"
          >
            <AppInput
              id="calling-available"
              v-model="availableAt"
              :aria-invalid="Boolean(errors.availableAt)"
              required
              type="datetime-local"
            />
          </AppFormField>
        </div>
        <AppFormField label="Paiement" for="calling-payment">
          <AppInput
            id="calling-payment"
            v-model="paymentTerms"
            placeholder="Conditions convenues"
          />
        </AppFormField>
      </template>

      <label
        v-if="outcome === 'NO_ANSWER'"
        class="text-sm flex gap-2 items-center"
      >
        <input
          v-model="scheduleFollowUp"
          type="checkbox"
          class="accent-[var(--color-accent)]"
        >
        Planifier une relance
      </label>
      <AppFormField
        v-if="showFollowUp"
        label="Relancer le"
        for="calling-followup"
        :required="followUpRequired"
        :error="errors.followUpAt"
      >
        <AppInput
          id="calling-followup"
          v-model="followUpAt"
          :aria-invalid="Boolean(errors.followUpAt)"
          :required="followUpRequired"
          type="datetime-local"
        />
      </AppFormField>
      <AppFormField label="Commentaire" for="calling-notes">
        <AppTextarea
          id="calling-notes"
          v-model="notes"
          :rows="3"
          placeholder="Précision utile pour la suite…"
        />
      </AppFormField>
      <p
        v-if="feedback"
        class="text-sm text-[var(--color-danger)]"
        role="alert"
      >
        {{ feedback }}
      </p>
      <AppButton type="submit" block size="lg" :loading="submitting">
        {{ available ? "Soumettre au superviseur" : "Enregistrer le retour" }}
      </AppButton>
    </form>
  </AppModal>
</template>

<style scoped>
.vehicle-choice {
  width: 100%;
  min-height: 4.25rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-bg-deep);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.vehicle-choice:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}

.vehicle-choice-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.vehicle-choice:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.vehicle-capacity {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}
</style>
