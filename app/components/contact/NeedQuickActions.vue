<script setup lang="ts">
import type { NeedContactSummary, NeedConversation } from '~/utils/need-contact'
import { buildPhoneUrl, formatPhoneNumber } from '~/utils/formatters'
import { buildNeedWhatsAppMessage, buildWhatsAppUrl } from '~/utils/need-contact'

const props = defineProps<{
  need: NeedContactSummary
  phone?: string
}>()

const conversations: Array<{
  type: NeedConversation
  label: string
  description: string
  icon: string
}> = [
  {
    type: 'BRIEF',
    label: 'Envoyer le brief',
    description: 'Trajet, marchandise, camion et quantité',
    icon: 'i-carbon-send',
  },
  {
    type: 'MOBILIZATION',
    label: 'Confirmer la mobilisation',
    description: 'Date, trajet et disponibilité attendue',
    icon: 'i-carbon-time',
  },
  {
    type: 'FOLLOW_UP',
    label: 'Relancer le suivi',
    description: 'Reste à trouver et point d’avancement',
    icon: 'i-carbon-reminder',
  },
]

const normalizedPhone = computed(() => props.phone?.trim() ?? '')
const callUrl = computed(() => normalizedPhone.value
  ? buildPhoneUrl(normalizedPhone.value)
  : '',
)

function conversationUrl(type: NeedConversation) {
  return buildWhatsAppUrl(
    normalizedPhone.value,
    buildNeedWhatsAppMessage(props.need, type),
  )
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-base font-800 m-0">
          Contact client
        </h2>
        <p class="text-xs text-[var(--color-text-muted)] mb-0 mt-1">
          {{ need.contactName || need.clientName }}
          <template v-if="phone">
            · {{ formatPhoneNumber(phone) }}
          </template>
        </p>
      </div>
      <AppBadge v-if="phone" tone="success" dot>
        Actions rapides
      </AppBadge>
    </div>

    <div v-if="phone" class="gap-3 grid sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
      <a
        :href="callUrl"
        class="text-sm text-[#04150b] font-800 px-4 py-3 border border-[var(--color-success)] rounded-xl bg-[var(--color-success)] flex gap-2 min-h-12 items-center justify-center focus-ring hover:brightness-110"
      >
        <span class="i-carbon-phone-filled text-lg" aria-hidden="true" />
        Appeler maintenant
      </a>

      <details class="quick-conversations border border-[var(--color-border-strong)] rounded-xl bg-[var(--color-bg-deep)]">
        <summary class="text-sm font-800 px-4 py-3 list-none flex gap-2 min-h-12 cursor-pointer items-center justify-between focus-ring">
          <span class="flex gap-2 items-center">
            <span class="i-carbon-logo-whatsapp text-lg text-green-300" aria-hidden="true" />
            Conversation WhatsApp
          </span>
          <span class="i-carbon-chevron-down transition-transform" aria-hidden="true" />
        </summary>
        <div class="px-2 pb-2 space-y-1">
          <a
            v-for="conversation in conversations"
            :key="conversation.type"
            :href="conversationUrl(conversation.type)"
            target="_blank"
            rel="noopener noreferrer"
            class="p-3 text-left rounded-lg flex gap-3 items-start hover:bg-[var(--color-accent-soft)] focus-ring"
          >
            <span :class="conversation.icon" class="text-[var(--color-accent)] mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong class="text-sm block">{{ conversation.label }}</strong>
              <span class="text-[11px] text-[var(--color-text-subtle)] mt-0.5 block">{{ conversation.description }}</span>
            </span>
          </a>
        </div>
      </details>
    </div>

    <AppEmptyState
      v-else
      title="Téléphone client manquant"
      description="Ajoutez un numéro au client pour activer l’appel direct et les conversations WhatsApp préparées."
      icon="i-carbon-phone-off"
      compact
    />
  </div>
</template>

<style scoped>
.quick-conversations[open] summary > :last-child {
  transform: rotate(180deg);
}
</style>
