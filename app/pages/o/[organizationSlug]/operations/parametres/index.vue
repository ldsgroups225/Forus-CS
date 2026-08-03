<script setup lang="ts">
import type { OrganizationRole } from '~~/shared/domain'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { invitationStatusLabels, roleLabels } from '~~/shared/domain'
import { buildInvitationUrl } from '~~/shared/invitations'
import { formatCurrency, formatDateTime } from '~/utils/formatters'
import { api } from '../../../../../../convex/_generated/api'

definePageMeta({ layout: 'operations' })

const { $convex } = useNuxtApp()
const runtimeConfig = useRuntimeConfig()
const { organization } = useCurrentOrganization()
const organizationArgs = computed(() => organization.value
  ? { organizationId: organization.value._id }
  : null)
const { data: settings } = useConvexQuery(api.organizations.getSettings, organizationArgs)
const canAdmin = computed(() => organization.value?.role === 'ORGANIZATION_ADMIN')
const canSeeTeam = computed(() =>
  organization.value?.role !== 'AGENT')
const { data: members } = useConvexQuery(api.memberships.list, computed(() =>
  organization.value && canSeeTeam.value
    ? { organizationId: organization.value._id }
    : null))
const { data: callingAgents } = useConvexQuery(api.callingAgents.list, computed(() =>
  organization.value && canSeeTeam.value
    ? { organizationId: organization.value._id }
    : null))
const { data: invitations } = useConvexQuery(api.invitations.list, computed(() =>
  organization.value && canAdmin.value
    ? { organizationId: organization.value._id }
    : null))
const saving = shallowRef(false)
const feedback = shallowRef('')
const inviteOpen = shallowRef(false)
const callingAgentName = shallowRef('')
const invitationLink = shallowRef('')
const copiedInvitationId = shallowRef('')
const settingsForm = reactive({
  name: '',
  timezone: 'Africa/Abidjan',
  currency: 'XOF',
  defaultCountryCode: '225',
  whatsappBusinessEnabled: false,
  presenceEnabled: false,
  agentBaseStipend: 50_000,
  maximumPerformanceBonus: 50_000,
})
const inviteForm = reactive({
  email: '',
  role: 'AGENT' as OrganizationRole,
})

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label }))
const supervisorOptions = computed(() => [
  { value: '', label: 'Aucun superviseur' },
  ...(members.value ?? [])
    .filter(member => member.isActive && member.role === 'SUPERVISOR')
    .map(member => ({
      value: member.userId,
      label: member.displayName ?? member.email ?? member.userId,
    })),
])
const agentLinkOptions = computed(() => [
  { value: '', label: 'Aucun compte lié' },
  ...(members.value ?? [])
    .filter(member => member.isActive && member.role === 'AGENT')
    .map(member => ({
      value: member.userId,
      label: member.displayName ?? member.email ?? member.userId,
    })),
])

function invitationUrl(code: string) {
  return buildInvitationUrl(
    runtimeConfig.public.siteUrl,
    import.meta.client ? window.location.origin : undefined,
    code,
  )
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

watch(
  [organization, settings],
  ([currentOrganization, currentSettings]) => {
    if (!currentOrganization || !currentSettings)
      return
    Object.assign(settingsForm, {
      name: currentOrganization.name,
      timezone: currentSettings.timezone,
      currency: currentSettings.currency,
      defaultCountryCode: currentSettings.defaultCountryCode,
      whatsappBusinessEnabled: currentSettings.whatsappBusinessEnabled,
      presenceEnabled: currentSettings.presenceEnabled ?? false,
      agentBaseStipend: currentSettings.agentBaseStipend ?? 50_000,
      maximumPerformanceBonus: currentSettings.maximumPerformanceBonus ?? 50_000,
    })
  },
  { immediate: true },
)

async function saveSettings() {
  if (!organization.value || !canAdmin.value)
    return

  saving.value = true
  feedback.value = ''
  try {
    await $convex.mutation(api.organizations.updateSettings, {
      organizationId: organization.value._id,
      ...settingsForm,
      agentBaseStipend: Number(settingsForm.agentBaseStipend),
      maximumPerformanceBonus: Number(settingsForm.maximumPerformanceBonus),
    })
    feedback.value = 'Paramètres enregistrés et audités.'
  }
  catch {
    feedback.value = 'Impossible d’enregistrer ces paramètres.'
  }
  finally {
    saving.value = false
  }
}

async function createInvitation() {
  if (!organization.value)
    return

  saving.value = true
  try {
    const result = await $convex.mutation(api.invitations.create, {
      organizationId: organization.value._id,
      email: inviteForm.email,
      role: inviteForm.role,
    })
    invitationLink.value = invitationUrl(result.code)
    feedback.value = 'Invitation créée. Copiez le lien sécurisé pour l’envoyer au membre.'
  }
  catch {
    feedback.value = 'Invitation impossible ou déjà active pour cet e-mail.'
  }
  finally {
    saving.value = false
  }
}

async function copyInvitation() {
  await writeClipboard(invitationLink.value)
  feedback.value = 'Lien d’invitation copié.'
}

async function copyInvitationLink(invitationId: string, code: string) {
  await writeClipboard(invitationUrl(code))
  copiedInvitationId.value = invitationId
  feedback.value = 'Lien d’invitation copié.'
}

async function updateRole(membershipId: Id<'memberships'>, role: string | undefined) {
  if (!role)
    return
  try {
    await $convex.mutation(api.memberships.updateRole, {
      membershipId,
      role: role as OrganizationRole,
    })
    feedback.value = 'Rôle mis à jour.'
  }
  catch {
    feedback.value = 'Rôle non modifié : un administrateur actif doit être conservé.'
  }
}

async function toggleMember(member: NonNullable<typeof members.value>[number]) {
  try {
    await $convex.mutation(api.memberships.setActive, {
      membershipId: member._id,
      isActive: !member.isActive,
    })
    feedback.value = member.isActive ? 'Membre désactivé.' : 'Membre réactivé.'
  }
  catch {
    feedback.value = 'Action refusée : auto-désactivation ou dernier administrateur.'
  }
}

async function assignSupervisor(membershipId: Id<'memberships'>, supervisorId?: string) {
  try {
    await $convex.mutation(api.memberships.assignSupervisor, {
      membershipId,
      supervisorId: supervisorId || undefined,
    })
    feedback.value = 'Équipe mise à jour.'
  }
  catch {
    feedback.value = 'Superviseur invalide.'
  }
}

async function createCallingAgent() {
  if (!organization.value || !callingAgentName.value.trim())
    return

  saving.value = true
  try {
    await $convex.mutation(api.callingAgents.create, {
      organizationId: organization.value._id,
      name: callingAgentName.value,
    })
    callingAgentName.value = ''
    feedback.value = 'Agent calling créé.'
  }
  catch {
    feedback.value = 'Création de l’agent calling impossible.'
  }
  finally {
    saving.value = false
  }
}

async function linkCallingAgent(callingAgentId: Id<'callingAgents'>, userId?: string) {
  try {
    await $convex.mutation(api.callingAgents.linkUser, {
      callingAgentId,
      userId: userId || undefined,
    })
    feedback.value = 'Liaison agent mise à jour.'
  }
  catch {
    feedback.value = 'Liaison impossible : choisissez un membre actif avec le rôle Agent.'
  }
}

async function revokeInvitation(invitationId: Id<'invitations'>) {
  await $convex.mutation(api.invitations.revoke, { invitationId })
  feedback.value = 'Invitation révoquée.'
}
</script>

<template>
  <div class="page-container">
    <AppPageHeader title="Paramètres et équipe" description="Organisation, membres, rôles, équipes et politique de rémunération." />

    <p v-if="feedback" class="text-sm mb-5 px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]" role="status">
      {{ feedback }}
    </p>

    <div class="space-y-5">
      <AppCard>
        <div class="mb-5">
          <h2 class="text-base font-900 m-0">
            Organisation
          </h2>
          <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
            Les secrets Better Auth et Convex ne sont jamais exposés ici.
          </p>
        </div>
        <form class="space-y-4" @submit.prevent="saveSettings">
          <div class="gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
            <AppFormField label="Nom" for="settings-name">
              <AppInput id="settings-name" v-model="settingsForm.name" :disabled="!canAdmin" />
            </AppFormField>
            <AppFormField label="Fuseau horaire" for="settings-timezone">
              <AppInput id="settings-timezone" v-model="settingsForm.timezone" :disabled="!canAdmin" />
            </AppFormField>
            <AppFormField label="Devise" for="settings-currency">
              <AppInput id="settings-currency" v-model="settingsForm.currency" maxlength="3" :disabled="!canAdmin" />
            </AppFormField>
            <AppFormField label="Indicatif pays" for="settings-country">
              <AppInput id="settings-country" v-model="settingsForm.defaultCountryCode" :disabled="!canAdmin" />
            </AppFormField>
            <AppFormField label="Prime de stage" for="settings-stipend" hint="F CFA / mois">
              <AppInput id="settings-stipend" v-model="settingsForm.agentBaseStipend" type="number" min="0" step="1000" :disabled="!canAdmin" />
            </AppFormField>
            <AppFormField label="Prime performance max." for="settings-bonus" hint="F CFA / mois">
              <AppInput id="settings-bonus" v-model="settingsForm.maximumPerformanceBonus" type="number" min="0" step="1000" :disabled="!canAdmin" />
            </AppFormField>
            <AppFormField label="WhatsApp Business">
              <label class="text-sm px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] flex gap-3 min-h-11 items-center">
                <input v-model="settingsForm.whatsappBusinessEnabled" type="checkbox" :disabled="!canAdmin">
                Activer après configuration
              </label>
            </AppFormField>
            <AppFormField label="Présence d’équipe">
              <label class="text-sm px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)] flex gap-3 min-h-11 items-center">
                <input v-model="settingsForm.presenceEnabled" type="checkbox" :disabled="!canAdmin">
                Afficher les membres connectés
              </label>
            </AppFormField>
          </div>
          <div v-if="canAdmin" class="flex justify-end">
            <AppButton type="submit" :loading="saving">
              Enregistrer
            </AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard v-if="canSeeTeam">
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-900 m-0">
              Membres et équipes
            </h2>
            <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
              Les autorisations sont appliquées côté Convex à chaque lecture et mutation.
            </p>
          </div>
          <AppButton v-if="canAdmin" size="sm" @click="inviteOpen = true">
            <template #leading>
              <span class="i-carbon-user-follow" />
            </template>
            Inviter
          </AppButton>
        </div>
        <div class="overflow-x-auto">
          <table class="text-sm min-w-220 w-full">
            <thead class="text-xs text-[var(--color-text-muted)] text-left">
              <tr>
                <th class="pb-3">
                  Membre
                </th><th class="pb-3">
                  Rôle
                </th><th class="pb-3">
                  Superviseur
                </th><th class="pb-3">
                  Statut
                </th><th class="pb-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in members" :key="member._id" class="border-t border-[var(--color-border)]">
                <td class="py-3">
                  <strong>{{ member.displayName || 'Membre' }}</strong><span class="text-xs text-[var(--color-text-muted)] block">{{ member.email || member.userId }}</span>
                </td>
                <td class="py-3">
                  <AppSelect :model-value="member.role" :options="roleOptions" :disabled="!canAdmin" @update:model-value="updateRole(member._id, $event)" />
                </td>
                <td class="py-3">
                  <AppSelect v-if="member.role === 'AGENT'" :model-value="member.supervisorId || ''" :options="supervisorOptions" :disabled="!canAdmin && organization?.role !== 'OPERATIONS_MANAGER'" @update:model-value="assignSupervisor(member._id, $event)" /><span v-else class="text-[var(--color-text-subtle)]">—</span>
                </td>
                <td class="py-3">
                  <AppBadge :tone="member.isActive ? 'success' : 'danger'" dot>
                    {{ member.isActive ? 'Actif' : 'Inactif' }}
                  </AppBadge>
                </td>
                <td class="py-3">
                  <AppButton v-if="canAdmin" size="sm" :variant="member.isActive ? 'ghost' : 'success'" @click="toggleMember(member)">
                    {{ member.isActive ? 'Désactiver' : 'Réactiver' }}
                  </AppButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard v-if="canSeeTeam">
        <div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 class="text-base font-900 m-0">
              Agents calling
            </h2>
            <p class="text-xs text-[var(--color-text-muted)] m-0 mt-1">
              Chaque enveloppe porte un portefeuille; un compte réel peut être lié après invitation.
            </p>
          </div>
          <form v-if="canAdmin" class="gap-2 grid sm:grid-cols-[minmax(12rem,18rem)_auto]" @submit.prevent="createCallingAgent">
            <AppInput v-model="callingAgentName" placeholder="Agent 1" :disabled="saving" />
            <AppButton type="submit" size="sm" :loading="saving">
              Créer
            </AppButton>
          </form>
        </div>
        <p v-if="!callingAgents?.length" class="text-sm text-[var(--color-text-muted)] m-0">
          Aucun agent calling créé.
        </p>
        <div v-else class="gap-3 grid lg:grid-cols-2">
          <div v-for="agent in callingAgents" :key="agent._id" class="p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-deep)]">
            <div class="mb-3 flex gap-3 items-start justify-between">
              <div>
                <strong>{{ agent.name }}</strong>
                <span class="text-xs text-[var(--color-text-muted)] mt-1 block">
                  {{ agent.assignedCarrierCount }} transporteurs
                </span>
              </div>
              <AppBadge :tone="agent.linkedUserName || agent.linkedUserEmail ? 'success' : 'warning'">
                {{ agent.linkedUserName || agent.linkedUserEmail ? 'Lié' : 'Enveloppe' }}
              </AppBadge>
            </div>
            <AppSelect
              v-if="canAdmin"
              :model-value="agent.linkedUserId || ''"
              :options="agentLinkOptions"
              @update:model-value="linkCallingAgent(agent._id, $event)"
            />
            <p v-else class="text-xs text-[var(--color-text-muted)] m-0">
              {{ agent.linkedUserName || agent.linkedUserEmail || 'Compte réel non lié' }}
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard v-if="canAdmin">
        <h2 class="text-base font-900 m-0">
          Invitations
        </h2>
        <p v-if="!invitations?.length" class="text-sm text-[var(--color-text-muted)] mb-0 mt-3">
          Aucune invitation créée.
        </p>
        <div v-else class="mt-4 space-y-2">
          <div v-for="invitation in invitations" :key="invitation._id" class="text-sm p-3 rounded-xl bg-[var(--color-bg-deep)] flex flex-col gap-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <strong>{{ invitation.email }}</strong>
                <span class="text-xs text-[var(--color-text-muted)] mt-1 block">{{ roleLabels[invitation.role] }} · expire {{ formatDateTime(invitation.expiresAt) }}</span>
              </div>
              <div class="flex gap-2 items-center">
                <AppBadge :tone="invitation.effectiveStatus === 'PENDING' ? 'warning' : invitation.effectiveStatus === 'ACCEPTED' ? 'success' : 'neutral'">
                  {{ invitationStatusLabels[invitation.effectiveStatus] }}
                </AppBadge>
              </div>
            </div>
            <div v-if="invitation.effectiveStatus === 'PENDING'" class="gap-2 grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <p class="text-xs text-[var(--color-text-muted)] m-0 px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] break-all">
                {{ invitationUrl(invitation.code) }}
              </p>
              <AppButton size="sm" variant="secondary" @click="copyInvitationLink(invitation._id, invitation.code)">
                <template #leading>
                  <span class="i-carbon-copy" />
                </template>
                {{ copiedInvitationId === invitation._id ? 'Copié' : 'Copier' }}
              </AppButton>
              <AppButton size="sm" variant="ghost" @click="revokeInvitation(invitation._id)">
                Révoquer
              </AppButton>
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <h2 class="text-base font-900 m-0">
          Rémunération configurée
        </h2>
        <p class="text-sm text-[var(--color-text-muted)] mb-0 mt-3">
          Prime fixe : <strong class="text-[var(--color-text)]">{{ formatCurrency(settingsForm.agentBaseStipend) }}</strong> · Bonus maximum estimé : <strong class="text-[var(--color-text)]">{{ formatCurrency(settingsForm.maximumPerformanceBonus) }}</strong>. L’éligibilité reste soumise à validation humaine.
        </p>
      </AppCard>
    </div>

    <AppModal v-model="inviteOpen" title="Inviter un membre" description="Le lien est valable sept jours et lié à l’adresse e-mail.">
      <form class="space-y-4" @submit.prevent="createInvitation">
        <AppFormField label="E-mail" for="invite-email" required>
          <AppInput id="invite-email" v-model="inviteForm.email" type="email" autocomplete="email" required />
        </AppFormField>
        <AppFormField label="Rôle" for="invite-role">
          <AppSelect id="invite-role" v-model="inviteForm.role" :options="roleOptions" />
        </AppFormField>
        <div v-if="invitationLink" class="p-3 border border-green-500/25 rounded-xl bg-green-500/8">
          <p class="text-xs text-green-200 m-0 break-all">
            {{ invitationLink }}
          </p>
          <AppButton class="mt-3" size="sm" variant="success" @click="copyInvitation">
            Copier le lien
          </AppButton>
        </div>
        <div class="pt-2 flex gap-2 justify-end">
          <AppButton variant="ghost" @click="inviteOpen = false">
            Fermer
          </AppButton><AppButton type="submit" :loading="saving">
            Créer l’invitation
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
