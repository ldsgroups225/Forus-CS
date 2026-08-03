<script setup lang="ts">
import type { CallOutcome } from '~~/shared/domain'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { callOutcomeLabels, needUrgencyLabels } from '~~/shared/domain'
import { getCallingTruckTypeOptions, matchesCallingTruckTypeFilter } from '~/utils/calling-truck-types'
import { formatDateTime, formatDisplayName, formatPhoneNumber } from '~/utils/formatters'
import { buildWhatsAppUrl } from '~/utils/need-contact'
import { api } from '../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const { enqueue } = useOfflineMutationQueue()
const { organization } = useCurrentOrganization()
const queueArgs = computed(() => organization.value ? { organizationId: organization.value._id } : null)
const { data: queue, isPending, error } = useConvexQuery(api.carriers.listCallingQueue, queueArgs)
const { data: activeNeeds, error: needsError } = useConvexQuery(api.needs.listActive, queueArgs)
const search = shallowRef('')
const selectedTruckTypes = shallowRef<string[]>([])
const expandedCarrierId = shallowRef<string | null>(null)
const expandedNeedId = shallowRef<string | null>(null)
const selectedCarrier = shallowRef<NonNullable<typeof queue.value>[number] | null>(null)
const resultModalOpen = computed({
  get: () => selectedCarrier.value !== null,
  set: (open: boolean) => {
    if (!open)
      selectedCarrier.value = null
  },
})
const outcome = shallowRef<CallOutcome>('AVAILABLE')
const notes = shallowRef('')
const calledAt = shallowRef(Date.now())
const submitting = shallowRef(false)
const feedback = shallowRef('')
const followUpDone = shallowRef<Id<'followUps'> | null>(null)
const isRecording = shallowRef(false)
const isTranscribing = shallowRef(false)
const recorder = shallowRef<MediaRecorder | null>(null)
const recorderStream = shallowRef<MediaStream | null>(null)
const audioChunks: Blob[] = []

const outcomeOptions = Object.entries(callOutcomeLabels).map(([value, label]) => ({ value, label }))
const truckTypeOptions = computed(() => getCallingTruckTypeOptions(queue.value ?? []))
const filteredQueue = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('fr')
  return (queue.value ?? []).filter((carrier) => {
    const matchesSearch = !needle || [carrier.name, carrier.contactName, carrier.phone]
      .filter(Boolean)
      .some(value => value?.toLocaleLowerCase('fr').includes(needle))

    return matchesSearch && matchesCallingTruckTypeFilter(carrier, selectedTruckTypes.value)
  })
})
const followUps = computed(() => filteredQueue.value.filter(carrier => carrier.followUp))
const visibleNeeds = computed(() => (activeNeeds.value ?? []).slice(0, 3))

function openCall(carrier: NonNullable<typeof queue.value>[number]) {
  selectedCarrier.value = carrier
  outcome.value = 'AVAILABLE'
  notes.value = ''
  calledAt.value = Date.now()
  feedback.value = ''
}

function toggleCarrierDetails(carrierId: string) {
  expandedCarrierId.value = expandedCarrierId.value === carrierId ? null : carrierId
}

function toggleNeedDetails(needId: string) {
  expandedNeedId.value = expandedNeedId.value === needId ? null : needId
}

function carrierWhatsAppUrl(carrier: NonNullable<typeof queue.value>[number]) {
  const recipient = carrier.contactName || formatDisplayName(carrier.name)
  return buildWhatsAppUrl(carrier.phone, `Bonjour ${recipient},\n\nFORUS souhaite faire un point sur votre disponibilité.\n\nMerci de nous indiquer les camions disponibles.\n\nÉquipe Forus CS`)
}

async function logCall() {
  if (!organization.value || !selectedCarrier.value)
    return
  if (outcome.value === 'CALLBACK' && notes.value.trim().length < 2) {
    feedback.value = 'Ajoutez une note pour organiser le rappel.'
    return
  }
  submitting.value = true
  feedback.value = ''
  const values = {
    organizationId: organization.value._id,
    carrierId: selectedCarrier.value._id as Id<'carriers'>,
    direction: 'OUTBOUND' as const,
    outcome: outcome.value,
    phone: selectedCarrier.value.phone,
    notes: notes.value.trim() || undefined,
    calledAt: calledAt.value,
    idempotencyKey: crypto.randomUUID(),
  }
  try {
    if (navigator.onLine)
      await $convex.mutation(api.calls.log, values)
    else
      await enqueue(organization.value._id, 'calls.log', values)
    feedback.value = navigator.onLine ? 'Appel enregistré.' : 'Appel enregistré hors ligne, synchronisation en attente.'
    selectedCarrier.value = null
  }
  catch {
    feedback.value = 'Impossible d’enregistrer cet appel.'
  }
  finally {
    submitting.value = false
  }
}

function preferredAudioMimeType() {
  return [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
  ].find(type => MediaRecorder.isTypeSupported(type)) ?? ''
}

async function toggleRecording() {
  if (isRecording.value) {
    recorder.value?.stop()
    return
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    feedback.value = 'La dictée audio n’est pas disponible sur ce navigateur.'
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = preferredAudioMimeType()
    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    audioChunks.length = 0
    recorderStream.value = stream
    recorder.value = mediaRecorder
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size)
        audioChunks.push(event.data)
    }
    mediaRecorder.onstop = async () => {
      isRecording.value = false
      recorderStream.value?.getTracks().forEach(track => track.stop())
      recorderStream.value = null
      const audio = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      if (!audio.size)
        return
      isTranscribing.value = true
      feedback.value = 'Transcription en cours…'
      try {
        const authResponse = await useAuth().authClient.convex.token()
        const token = authResponse.data?.token
        if (!token)
          throw new Error('AUTH_TOKEN_MISSING')
        const formData = new FormData()
        formData.append('file', audio, `calling-note.${audio.type.includes('mp4') ? 'mp4' : 'webm'}`)
        const transcription = await $fetch<{ text: string }>('/api/ai/transcribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (transcription.text)
          notes.value = [notes.value.trim(), transcription.text].filter(Boolean).join('\n')
        feedback.value = transcription.text ? 'Transcription ajoutée à la note.' : 'Aucun texte détecté dans l’enregistrement.'
      }
      catch {
        feedback.value = 'Impossible de transcrire cet enregistrement.'
      }
      finally {
        isTranscribing.value = false
      }
    }
    mediaRecorder.start()
    isRecording.value = true
    feedback.value = 'Enregistrement en cours… appuyez à nouveau pour arrêter.'
  }
  catch {
    feedback.value = 'Autorisation microphone refusée ou indisponible.'
  }
}

async function completeFollowUp(carrier: NonNullable<typeof queue.value>[number]) {
  if (!carrier.followUp)
    return
  followUpDone.value = carrier.followUp._id as Id<'followUps'>
  try {
    await $convex.mutation(api.calls.completeFollowUp, {
      followUpId: carrier.followUp._id as Id<'followUps'>,
      status: 'COMPLETED',
    })
  }
  catch {
    followUpDone.value = null
  }
}
</script>

<template>
  <div class="calling-page page-container">
    <section class="calling-hero">
      <div>
        <p class="calling-kicker">
          Poste calling
        </p>
        <h1>Les appels qui font avancer la journée.</h1>
        <p class="calling-subtitle">
          Regardez la demande, puis appelez le bon transporteur.
        </p>
      </div>
      <div class="calling-counts">
        <div class="calling-count" aria-label="Nombre de demandes actives">
          <strong>{{ activeNeeds?.length ?? 0 }}</strong>
          <span>demandes</span>
        </div>
        <div class="calling-count" aria-label="Nombre de transporteurs appelables">
          <strong>{{ queue?.length ?? 0 }}</strong>
          <span>numéros</span>
        </div>
      </div>
    </section>

    <section id="active-needs" class="calling-brief" aria-labelledby="active-needs-title">
      <div class="calling-section-heading">
        <div>
          <p class="calling-kicker">
            À pourvoir maintenant
          </p>
          <h2 id="active-needs-title">
            Demandes en cours
          </h2>
        </div>
        <span class="calling-brief-note">Le contexte de vos appels</span>
      </div>
      <p v-if="needsError" class="calling-brief-empty" role="status">
        Les demandes ne sont pas disponibles pour le moment.
      </p>
      <p v-else-if="!activeNeeds?.length" class="calling-brief-empty">
        Aucune demande ouverte : poursuivez vos relances et mettez à jour les appels.
      </p>
      <div v-else class="calling-need-list">
        <article
          v-for="need in visibleNeeds"
          :key="need._id"
          class="calling-need"
          role="button"
          tabindex="0"
          :aria-expanded="expandedNeedId === need._id"
          @click="toggleNeedDetails(need._id)"
          @keydown.enter.prevent="toggleNeedDetails(need._id)"
          @keydown.space.prevent="toggleNeedDetails(need._id)"
        >
          <div class="calling-need-top">
            <span class="calling-need-reference">{{ need.reference }}</span>
            <AppBadge :tone="need.urgency === 'CRITICAL' ? 'danger' : need.urgency === 'HIGH' ? 'warning' : 'info'">
              {{ needUrgencyLabels[need.urgency] }}
            </AppBadge>
          </div>
          <h3>{{ need.loadingLocation }} <span>→</span> {{ need.destination }}</h3>
          <p class="calling-need-client">
            {{ need.clientName }} · {{ need.truckType }}
          </p>
          <div class="calling-need-footer">
            <strong>{{ need.remainingTruckCount }} camion(s) à trouver</strong>
            <span>Mobilisation {{ formatDateTime(need.mobilizationAt) }}</span>
          </div>
          <Transition name="calling-expand">
            <div v-if="expandedNeedId === need._id" class="calling-expand-shell">
              <div class="calling-expand-content">
                <dl class="calling-detail-grid">
                  <div>
                    <dt>Client</dt>
                    <dd>{{ need.clientName }}</dd>
                  </div>
                  <div>
                    <dt>Volume demandé</dt>
                    <dd>{{ need.requestedTruckCount }} camion(s) · {{ need.tonnageTons }} t</dd>
                  </div>
                  <div v-if="need.packaging">
                    <dt>Conditionnement</dt>
                    <dd>{{ need.packaging }}</dd>
                  </div>
                  <div v-if="need.estimatedDuration">
                    <dt>Durée estimée</dt>
                    <dd>{{ need.estimatedDuration }}</dd>
                  </div>
                  <div v-if="need.constraints" class="calling-detail-wide">
                    <dt>Contraintes</dt>
                    <dd>{{ need.constraints }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Transition>
        </article>
      </div>
    </section>

    <section v-if="followUps.length" class="calling-followups" aria-labelledby="followups-title">
      <div class="calling-section-heading">
        <div>
          <p class="calling-kicker">
            À ne pas oublier
          </p>
          <h2 id="followups-title">
            Rappels à faire
          </h2>
        </div>
        <AppBadge tone="warning">
          {{ followUps.length }}
        </AppBadge>
      </div>
      <div class="calling-followup-list">
        <div v-for="carrier in followUps" :key="carrier._id" class="calling-followup">
          <div>
            <strong>{{ carrier.name }}</strong>
            <span>{{ formatDateTime(carrier.followUp!.dueAt) }} · {{ carrier.followUp!.notes }}</span>
          </div>
          <AppButton size="sm" variant="secondary" :disabled="followUpDone === carrier.followUp!._id" @click="completeFollowUp(carrier)">
            {{ followUpDone === carrier.followUp!._id ? 'Fait' : 'Terminer' }}
          </AppButton>
        </div>
      </div>
    </section>

    <section id="calling-contacts" class="calling-contacts" aria-labelledby="calling-contacts-title">
      <div class="calling-section-heading">
        <div>
          <p class="calling-kicker">
            Votre portefeuille
          </p>
          <h2 id="calling-contacts-title">
            Contacts à appeler
          </h2>
        </div>
        <span class="calling-brief-note">{{ filteredQueue.length }} disponible(s)</span>
      </div>
      <div class="calling-search">
        <span class="i-carbon-search" aria-hidden="true" />
        <AppInput id="calling-search" v-model="search" aria-label="Rechercher un transporteur ou un numéro" placeholder="Nom, contact ou numéro…" />
      </div>
      <CallingTruckTypeFilters v-model="selectedTruckTypes" :options="truckTypeOptions" />
    </section>

    <div v-if="isPending" class="calling-list" aria-label="Chargement des numéros" aria-busy="true">
      <AppCard v-for="index in 4" :key="index">
        <AppSkeleton :lines="4" />
      </AppCard>
    </div>
    <p v-else-if="error" class="calling-message" role="alert">
      Impossible de charger vos numéros. Vérifiez votre connexion.
    </p>
    <AppEmptyState v-else-if="!filteredQueue.length" title="Aucun numéro à appeler" description="Votre portefeuille ne contient aucun transporteur actif avec un numéro appelable." icon="i-carbon-phone-off" />
    <section v-else class="calling-list" aria-label="Transporteurs à appeler">
      <article
        v-for="carrier in filteredQueue"
        :key="carrier._id"
        class="calling-card"
        role="button"
        tabindex="0"
        :aria-expanded="expandedCarrierId === carrier._id"
        @click="toggleCarrierDetails(carrier._id)"
        @keydown.enter.prevent="toggleCarrierDetails(carrier._id)"
        @keydown.space.prevent="toggleCarrierDetails(carrier._id)"
      >
        <div class="calling-card-top">
          <div class="calling-carrier-identity">
            <p class="calling-card-label">
              Transporteur
            </p>
            <h2 :title="carrier.name">
              {{ formatDisplayName(carrier.name) }}
            </h2>
            <p v-if="carrier.contactName" class="calling-contact">
              {{ carrier.contactName }}
            </p>
          </div>
          <AppBadge :tone="carrier.availableVehicleCount ? 'success' : 'neutral'" dot>
            <span class="calling-availability-long">{{ carrier.availableVehicleCount ? `${carrier.availableVehicleCount} disponible(s)` : 'Pas de disponibilité connue' }}</span>
            <span class="calling-availability-short">{{ carrier.availableVehicleCount ? 'Disponible' : 'À confirmer' }}</span>
          </AppBadge>
        </div>
        <span class="calling-number">{{ formatPhoneNumber(carrier.phone) }}</span>
        <div class="calling-card-meta">
          <span class="calling-truck-types">
            <span class="i-carbon-delivery-truck" aria-hidden="true" />
            <span class="calling-truck-types-value">{{ carrier.truckTypes.length ? carrier.truckTypes.join(', ') : 'Type de camion non renseigné' }}</span>
          </span>
          <span>{{ carrier.activeVehicleCount }} véhicule(s) actif(s)</span>
          <span v-if="carrier.lastCall">Dernier appel : {{ callOutcomeLabels[carrier.lastCall.outcome] }}</span>
          <span v-else>Jamais appelé</span>
        </div>
        <Transition name="calling-expand">
          <div v-if="expandedCarrierId === carrier._id" class="calling-expand-shell">
            <div class="calling-expand-content">
              <dl class="calling-detail-grid">
                <div v-if="carrier.contactName">
                  <dt>Contact principal</dt>
                  <dd>{{ carrier.contactName }}</dd>
                </div>
                <div>
                  <dt>Disponibilité</dt>
                  <dd>{{ carrier.availableVehicleCount }} véhicule(s) disponible(s) sur {{ carrier.activeVehicleCount }}</dd>
                </div>
                <div v-if="carrier.lastCall">
                  <dt>Dernier appel</dt>
                  <dd>{{ callOutcomeLabels[carrier.lastCall.outcome] }} · {{ formatDateTime(carrier.lastCall.calledAt) }}</dd>
                </div>
                <div v-if="carrier.followUp">
                  <dt>Rappel prévu</dt>
                  <dd>{{ formatDateTime(carrier.followUp.dueAt) }}<span v-if="carrier.followUp.notes"> · {{ carrier.followUp.notes }}</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </Transition>
        <div class="calling-actions" @click.stop>
          <AppButton block size="lg" class="calling-button" @click="openCall(carrier)">
            <template #leading>
              <span class="i-carbon-phone-filled" />
            </template>
            Appeler maintenant
          </AppButton>
          <a
            :href="carrierWhatsAppUrl(carrier)"
            target="_blank"
            rel="noopener noreferrer"
            class="calling-whatsapp focus-ring"
            :aria-label="`Ouvrir WhatsApp avec ${formatDisplayName(carrier.name)}`"
            title="WhatsApp"
          >
            <WhatsAppIcon />
            <span class="calling-whatsapp-label">WhatsApp</span>
          </a>
        </div>
      </article>
    </section>

    <AppModal v-model="resultModalOpen" title="Résultat de l’appel" :description="selectedCarrier ? `${selectedCarrier.name} · ${formatPhoneNumber(selectedCarrier.phone)}` : ''">
      <form class="calling-form" @submit.prevent="logCall">
        <AppFormField label="Résultat" for="calling-outcome" required>
          <AppSelect id="calling-outcome" v-model="outcome" :options="outcomeOptions" />
        </AppFormField>
        <AppFormField label="Note" for="calling-notes" :hint="outcome === 'CALLBACK' ? 'Obligatoire pour organiser le rappel.' : 'Facultatif'">
          <AppTextarea id="calling-notes" v-model="notes" :rows="3" placeholder="Ex. disponible demain matin…" :required="outcome === 'CALLBACK'" />
        </AppFormField>
        <AppButton type="button" variant="secondary" block :loading="isTranscribing" :disabled="isTranscribing" @click="toggleRecording">
          <template #leading>
            <span :class="isRecording ? 'i-carbon-stop-filled' : 'i-carbon-microphone-filled'" />
          </template>
          {{ isRecording ? 'Arrêter et transcrire' : 'Dicter une note' }}
        </AppButton>
        <p v-if="feedback" class="calling-message" role="status">
          {{ feedback }}
        </p>
        <AppButton type="submit" block size="lg" :loading="submitting">
          Enregistrer le résultat
        </AppButton>
      </form>
    </AppModal>
  </div>
</template>

<style scoped>
.calling-page {
  padding-bottom: 7rem;
}

.calling-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 1.25rem;
  background: linear-gradient(135deg, var(--color-surface), var(--color-surface-soft));
}
.calling-counts {
  display: flex;
  align-items: stretch;
}
.calling-kicker {
  margin: 0 0 0.35rem;
  color: var(--color-accent);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.calling-hero h1,
.calling-section-heading h2,
.calling-card h2 {
  margin: 0;
}
.calling-hero h1 {
  font-size: clamp(1.4rem, 5vw, 2.35rem);
  letter-spacing: -0.04em;
}
.calling-subtitle {
  margin: 0.45rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}
.calling-count {
  min-width: 5rem;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
  text-align: right;
}
.calling-count strong {
  display: block;
  color: var(--color-accent);
  font-size: 2rem;
  line-height: 1;
}
.calling-count span {
  color: var(--color-text-muted);
  font-size: 0.7rem;
}
.calling-search {
  position: relative;
}
.calling-search > span {
  position: absolute;
  z-index: 1;
  left: 0.9rem;
  top: 50%;
  color: var(--color-text-subtle);
  transform: translateY(-50%);
}
.calling-search :deep(input) {
  padding-left: 2.5rem;
  min-height: 3rem;
}
.calling-followups {
  margin-bottom: 1.25rem;
  padding: 1rem;
  border: 1px solid rgb(245 165 36 / 35%);
  border-radius: 1.25rem;
  background: rgb(245 165 36 / 8%);
}
.calling-brief,
.calling-contacts {
  margin-bottom: 1.25rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 1.25rem;
  background: var(--color-surface);
}
.calling-brief {
  background: linear-gradient(90deg, rgb(32 199 183 / 7%), transparent 38%), var(--color-surface);
}
.calling-brief-note {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
.calling-brief-empty {
  margin: 0;
  padding: 1rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: 0.85rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.calling-need-list {
  display: grid;
  gap: 0.75rem;
}
.calling-need {
  padding: 0.9rem;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-accent);
  border-radius: 0.85rem;
  background: var(--color-bg-deep);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}
.calling-need:hover,
.calling-need:focus-visible,
.calling-card:hover,
.calling-card:focus-visible {
  border-color: var(--color-accent);
}
.calling-need:active,
.calling-card:active {
  transform: translateY(1px);
}
.calling-need-top,
.calling-need-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.calling-need-reference {
  color: var(--color-accent);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.calling-need h3 {
  margin: 0.65rem 0 0;
  font-size: 1rem;
}
.calling-need h3 span {
  color: var(--color-accent);
}
.calling-need-client {
  margin: 0.3rem 0 0.85rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}
.calling-need-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.72rem;
}
.calling-need-footer strong {
  color: var(--color-text);
  font-size: 0.78rem;
}
.calling-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.calling-followup-list {
  display: grid;
  gap: 0.6rem;
}
.calling-followup {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.85rem;
  background: var(--color-surface);
}
.calling-followup strong,
.calling-followup span {
  display: block;
}
.calling-followup span {
  margin-top: 0.2rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
.calling-list {
  display: grid;
  gap: 1rem;
}
.calling-card {
  container-type: inline-size;
  padding: 1.1rem;
  border: 1px solid var(--color-border);
  border-radius: 1.25rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}
.calling-card-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.75rem;
}
.calling-carrier-identity {
  min-width: 0;
}
.calling-card-label {
  margin: 0 0 0.25rem;
  color: var(--color-text-subtle);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.calling-card h2 {
  font-size: 1.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.calling-contact {
  margin: 0.2rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.calling-availability-short {
  display: none;
}
.calling-number {
  display: block;
  margin: 1.25rem 0 0.65rem;
  color: var(--color-text);
  font-size: clamp(1.3rem, 8cqw, 2.15rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1.1;
  white-space: nowrap;
}
.calling-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  margin-bottom: 1rem;
  color: var(--color-text-muted);
  font-size: 0.72rem;
}
.calling-truck-types {
  display: flex;
  flex: 1 0 100%;
  align-items: center;
  gap: 0.3rem;
  line-height: 1.35;
}
.calling-truck-types-value {
  min-width: 0;
}
.calling-actions {
  display: flex;
  gap: 0.65rem;
}
.calling-expand-shell {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows 220ms ease,
    opacity 180ms ease;
}
.calling-expand-content {
  min-height: 0;
  padding: 0.9rem 0 0;
  border-top: 1px solid var(--color-border);
  overflow: hidden;
}
.calling-detail-grid {
  display: grid;
  gap: 0.7rem;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.calling-detail-grid div {
  min-width: 0;
}
.calling-detail-grid dt {
  color: var(--color-text-subtle);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.calling-detail-grid dd {
  margin: 0.2rem 0 0;
  color: var(--color-text);
  font-size: 0.78rem;
  line-height: 1.35;
}
.calling-detail-wide {
  grid-column: 1 / -1;
}
.calling-expand-enter-active,
.calling-expand-leave-active {
  display: grid;
  transition:
    grid-template-rows 220ms ease,
    opacity 180ms ease;
}
.calling-expand-enter-from,
.calling-expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.calling-button {
  flex: 1;
}
.calling-button :deep(button) {
  min-height: 3.25rem;
}
.calling-whatsapp {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-width: 3.25rem;
  min-height: 3.25rem;
  padding: 0 0.85rem;
  border: 1px solid color-mix(in srgb, var(--color-success) 55%, var(--color-border));
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  color: var(--color-success);
  font-size: 0.78rem;
  font-weight: 800;
}
.calling-whatsapp:hover {
  border-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 20%, var(--color-surface));
}
.calling-message {
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.85rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.calling-form {
  display: grid;
  gap: 1rem;
}
@media (min-width: 700px) {
  .calling-need-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .calling-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .calling-page {
    padding-bottom: 7.75rem;
  }
  .calling-hero {
    align-items: start;
    flex-direction: column;
  }
  .calling-counts {
    width: 100%;
  }
  .calling-count {
    flex: 1;
    padding-left: 0;
  }
  .calling-count:first-child {
    border-left: 0;
    text-align: left;
  }
  .calling-need-footer {
    align-items: start;
    flex-direction: column;
    gap: 0.3rem;
  }
  .calling-card {
    padding: 1rem;
  }
  .calling-detail-grid {
    grid-template-columns: 1fr;
  }
  .calling-detail-wide {
    grid-column: auto;
  }
  .calling-card-meta {
    gap: 0.4rem 0.7rem;
  }
  .calling-truck-types {
    align-items: flex-start;
  }
  .calling-availability-long,
  .calling-whatsapp-label {
    display: none;
  }
  .calling-availability-short {
    display: inline;
  }
  .calling-whatsapp {
    width: 3.25rem;
    padding: 0;
  }
}
@media (min-width: 1024px) {
  .calling-page {
    padding-bottom: 2rem;
  }
}
@media (min-width: 1100px) {
  .calling-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .calling-card,
  .calling-need,
  .calling-expand-shell,
  .calling-expand-enter-active,
  .calling-expand-leave-active {
    transition: none;
  }
}
</style>
