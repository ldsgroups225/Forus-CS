<script setup lang="ts">
import { formatDateTime, formatPhoneNumber } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const route = useRoute()
const { organization } = useCurrentOrganization()
const args = computed(() => organization.value ? { organizationId: organization.value._id } : null)
const { data: queue, isPending, error } = useConvexQuery(api.carriers.listCallingQueue, args)
const base = computed(() => `/o/${route.params.organizationSlug}/operations/calling`)
const prospectOpen = ref(false)
const carrierName = ref('')
const phone = ref('')
const source = ref('')
const note = ref('')
const feedback = ref('')
const submitting = ref(false)
const search = ref('')
const visible = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase()
  return (queue.value ?? []).filter(carrier => !needle || `${carrier.name} ${carrier.phone}`.toLocaleLowerCase().includes(needle))
})

function reloadPage() {
  if (import.meta.client)
    window.location.reload()
}

async function escalateProspect() {
  if (!organization.value || carrierName.value.trim().length < 2 || source.value.trim().length < 2 || note.value.trim().length < 2) {
    feedback.value = 'Indiquez le transporteur, la source et le motif de remontée.'
    return
  }
  submitting.value = true
  feedback.value = ''
  try {
    await $convex.mutation(api.callingEscalations.create, {
      organizationId: organization.value._id,
      carrierName: carrierName.value,
      phone: phone.value || undefined,
      source: source.value,
      note: note.value,
    })
    prospectOpen.value = false
    carrierName.value = ''
    phone.value = ''
    source.value = ''
    note.value = ''
  }
  catch {
    feedback.value = 'Remontée impossible pour le moment.'
  }
  finally { submitting.value = false }
}
</script>

<template>
  <div class="page-container pb-28 lg:pb-8">
    <NuxtLink :to="base" class="text-sm text-[var(--color-accent)] font-700 inline-flex gap-2 items-center focus-ring">
      <span class="i-carbon-arrow-left" /> Besoins
    </NuxtLink>
    <header class="mt-4 flex gap-4 items-end justify-between">
      <div>
        <p class="text-xs text-[var(--color-accent)] tracking-[.14em] font-800 mb-2 uppercase">
          Calling
        </p><h1 class="text-2xl tracking-tight font-800 m-0">
          Portefeuille
        </h1><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-2">
          Suivi à froid, réactivation et relances. Les nouveaux contacts sont remontés au superviseur.
        </p>
      </div><AppButton @click="prospectOpen = true">
        <span class="i-carbon-user-follow" /> Remonter un prospect
      </AppButton>
    </header>
    <section class="mt-6">
      <AppInput v-model="search" aria-label="Rechercher dans le portefeuille" placeholder="Rechercher un transporteur…" />
    </section>
    <div v-if="isPending" class="mt-4 space-y-3">
      <AppSkeleton :lines="3" /><AppSkeleton :lines="3" />
    </div>
    <AppEmptyState v-else-if="error" class="mt-5" title="Portefeuille indisponible" description="Rechargez la page pour récupérer les transporteurs affectés." icon="i-carbon-warning">
      <AppButton variant="secondary" @click="reloadPage">
        Réessayer
      </AppButton>
    </AppEmptyState>
    <AppEmptyState v-else-if="!visible.length" class="mt-5" title="Portefeuille vide" description="Demandez au superviseur de vous affecter une enveloppe Calling." icon="i-carbon-delivery-truck" />
    <section v-else class="mt-4 gap-3 grid">
      <article v-for="carrier in visible" :key="carrier._id" class="p-4 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]">
        <div class="flex gap-3 items-start justify-between">
          <div>
            <h2 class="text-base font-800 m-0">
              {{ carrier.name }}
            </h2><p class="text-sm text-[var(--color-text-muted)] mb-0 mt-1">
              {{ formatPhoneNumber(carrier.phone) }} · {{ carrier.truckTypes.join(', ') }}
            </p>
          </div><AppBadge :tone="carrier.followUp ? 'warning' : 'neutral'">
            {{ carrier.followUp ? 'Relance due' : 'À froid' }}
          </AppBadge>
        </div><p v-if="carrier.followUp" class="text-xs text-[var(--color-text-muted)] mb-0 mt-3">
          {{ formatDateTime(carrier.followUp.dueAt) }} · {{ carrier.followUp.notes }}
        </p>
      </article>
    </section>
    <AppModal v-model="prospectOpen" title="Remonter un prospect" description="Il reste hors portefeuille tant que le superviseur ne l’a pas traité.">
      <form class="space-y-4" @submit.prevent="escalateProspect">
        <AppFormField label="Transporteur" for="prospect-name" required>
          <AppInput id="prospect-name" v-model="carrierName" />
        </AppFormField><AppFormField label="Téléphone" for="prospect-phone">
          <AppInput id="prospect-phone" v-model="phone" type="tel" />
        </AppFormField><AppFormField label="Source du contact" for="prospect-source" required>
          <AppInput id="prospect-source" v-model="source" placeholder="Recommandation, carte, ancien contact…" />
        </AppFormField><AppFormField label="Pourquoi le remonter ?" for="prospect-note" required>
          <AppTextarea id="prospect-note" v-model="note" :rows="3" />
        </AppFormField><p v-if="feedback" class="text-sm text-[var(--color-danger)]" role="alert">
          {{ feedback }}
        </p><AppButton type="submit" block :loading="submitting">
          Envoyer au superviseur
        </AppButton>
      </form>
    </AppModal>
  </div>
</template>
