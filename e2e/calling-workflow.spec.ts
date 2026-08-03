import { expect, test } from '@playwright/test'

interface Credentials {
  email: string
  password: string
}

const adminCredentials: Credentials = {
  email: process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_EMAIL ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD ?? '',
}
const supervisorCredentials: Credentials = {
  email: process.env.E2E_SUPERVISOR_EMAIL ?? '',
  password: process.env.E2E_SUPERVISOR_PASSWORD ?? '',
}
const agentCredentials: Credentials = {
  email: process.env.E2E_AGENT_EMAIL ?? '',
  password: process.env.E2E_AGENT_PASSWORD ?? '',
}
const agentLinkLabel = process.env.E2E_AGENT_LABEL ?? ''
const bootstrapCallingJourney = process.env.E2E_CALLING_BOOTSTRAP === 'true'
const runCallingJourney = bootstrapCallingJourney || (process.env.E2E_CALLING_FULL === 'true'
  && Object.values({ ...adminCredentials, ...supervisorCredentials, ...agentCredentials }).every(Boolean)
)

function dateTimeInput(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString().slice(0, 16)
}

async function signIn(browser: Parameters<typeof test>[0]['browser'], credentials: Credentials) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(credentials.email)
  await page.getByLabel('Mot de passe').fill(credentials.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/o\/[^/]+\/operations(?:\/calling)?\/?$/)
  return { context, page }
}

async function registerAdministrator(browser: Parameters<typeof test>[0]['browser'], suffix: string) {
  const credentials: Credentials = {
    email: `calling-admin-${suffix}@e2e.forus.local`,
    password: `Calling-${suffix}-E2E`,
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/register')
  await page.locator('#register-name').fill('Administrateur Calling E2E')
  await page.locator('#register-email').fill(credentials.email)
  await page.locator('#register-password').fill(credentials.password)
  await page.locator('#register-confirmation').fill(credentials.password)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page).toHaveURL(/\/onboarding\/organization$/)
  await page.locator('#organization-name').fill(`Organisation Calling E2E ${suffix}`)
  await page.locator('#organization-slug').fill(`calling-e2e-${suffix}`)
  await page.getByRole('button', { name: 'Créer et continuer' }).click()
  await expect(page).toHaveURL(/\/o\/[^/]+\/operations\/?$/)
  return { context, page, credentials }
}

async function createInvitation(page: Awaited<ReturnType<typeof signIn>>['page'], email: string, role: 'AGENT' | 'SUPERVISOR') {
  await page.goto(`${operationsRoot(page.url())}/parametres`)
  await page.getByRole('button', { name: 'Inviter', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Inviter un membre' })
  await dialog.locator('#invite-email').fill(email)
  await dialog.locator('#invite-role').selectOption(role)
  await dialog.getByRole('button', { name: 'Créer l’invitation' }).click()
  const invitationUrl = await dialog.locator('p').filter({ hasText: '/invite/' }).textContent() ?? ''
  expect(invitationUrl).toContain('/invite/')
  return new URL(invitationUrl).pathname
}

async function registerAndAcceptInvitation(
  browser: Parameters<typeof test>[0]['browser'],
  invitationPath: string,
  credentials: Credentials,
  name: string,
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(invitationPath)
  await page.getByRole('link', { name: 'Créer un compte' }).click()
  await page.locator('#register-name').fill(name)
  await page.locator('#register-email').fill(credentials.email)
  await page.locator('#register-password').fill(credentials.password)
  await page.locator('#register-confirmation').fill(credentials.password)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('button', { name: 'Accepter l’invitation' })).toBeVisible()
  await page.getByRole('button', { name: 'Accepter l’invitation' }).click()
  await expect(page).toHaveURL(/\/o\/[^/]+\/operations(?:\/calling)?\/?$/)
  return { context, page }
}

function operationsRoot(url: string) {
  const match = new URL(url).pathname.match(/^(\/o\/[^/]+\/operations)/)
  if (!match)
    throw new Error(`E2E_OPERATIONS_ROOT_MISSING:${url}`)
  return match[1]
}

test('Calling : agent, superviseur et Opérations couvrent un besoin avec véhicules nommés', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Le parcours multi-rôles est joué une seule fois.')
  test.skip(!runCallingJourney, 'E2E_CALLING_BOOTSTRAP=true ou E2E_CALLING_FULL et les identifiants Admin, Superviseur et Agent sont requis.')

  const suffix = Date.now().toString().slice(-8)
  const clientName = `Client Calling E2E ${suffix}`
  const carrierName = `Transporteur Calling E2E ${suffix}`
  const callingAgentName = `Agent Calling E2E ${suffix}`
  const registrationA = `CALL-${suffix}-A`
  const registrationB = `CALL-${suffix}-B`
  const bootstrapCredentials = {
    supervisor: { email: `calling-supervisor-${suffix}@e2e.forus.local`, password: `Calling-${suffix}-E2E` },
    agent: { email: `calling-agent-${suffix}@e2e.forus.local`, password: `Calling-${suffix}-E2E` },
  }
  const admin = bootstrapCallingJourney
    ? await registerAdministrator(browser, suffix)
    : await signIn(browser, adminCredentials)
  const root = operationsRoot(admin.page.url())
  let supervisor: Awaited<ReturnType<typeof signIn>> | undefined
  let agent: Awaited<ReturnType<typeof signIn>> | undefined

  try {
    if (bootstrapCallingJourney) {
      const supervisorInvitation = await createInvitation(admin.page, bootstrapCredentials.supervisor.email, 'SUPERVISOR')
      supervisor = await registerAndAcceptInvitation(browser, supervisorInvitation, bootstrapCredentials.supervisor, 'Superviseur Calling E2E')
      const agentInvitation = await createInvitation(admin.page, bootstrapCredentials.agent.email, 'AGENT')
      agent = await registerAndAcceptInvitation(browser, agentInvitation, bootstrapCredentials.agent, 'Agent Calling E2E')
    }

    await admin.page.goto(`${root}/clients`)
    await admin.page.getByRole('button', { name: 'Nouveau client' }).click()
    await admin.page.getByLabel('Nom').fill(clientName)
    await admin.page.getByLabel('Contact principal').fill('Contact Calling E2E')
    await admin.page.getByLabel('Téléphone').fill(`0701${suffix}`)
    await admin.page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(admin.page.getByText(clientName, { exact: true })).toBeVisible()

    await admin.page.goto(`${root}/parametres`)
    const callingAgentForm = admin.page.getByPlaceholder('Agent 1').locator('xpath=ancestor::form')
    await expect(callingAgentForm).toBeVisible()
    await callingAgentForm.getByPlaceholder('Agent 1').fill(callingAgentName)
    await callingAgentForm.getByRole('button', { name: 'Créer', exact: true }).click()
    const callingAgentCard = admin.page.getByText(callingAgentName, { exact: true }).locator('xpath=../../..')
    await expect(callingAgentCard).toBeVisible()
    const callingAgentSelect = callingAgentCard.locator('select')
    await expect(callingAgentSelect).toHaveCount(1)
    await callingAgentSelect.selectOption({
      label: bootstrapCallingJourney ? 'Agent Calling E2E' : (agentLinkLabel || agentCredentials.email),
    })
    await expect(callingAgentCard.getByText('Lié', { exact: true })).toBeVisible()

    await admin.page.goto(`${root}/transporteurs`)
    await admin.page.getByRole('button', { name: 'Ajouter un transporteur' }).click()
    await admin.page.locator('#carrier-name').fill(carrierName)
    await admin.page.locator('#carrier-phone').fill(`0501${suffix}`)
    await admin.page.locator('#carrier-trucks').fill('Porteur 10T')
    await admin.page.locator('#carrier-destinations').fill('Bouaké')
    await admin.page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click()
    await admin.page.locator('#carrier-search').fill(carrierName)
    await expect(admin.page.getByText(carrierName, { exact: true })).toBeVisible()
    const portfolioSelect = admin.page.getByLabel('Assigner au portefeuille')
    await expect(portfolioSelect).toHaveCount(1)
    await portfolioSelect.selectOption({ label: callingAgentName })

    await admin.page.getByRole('link', { name: 'Ouvrir' }).click()
    for (const registration of [registrationA, registrationB]) {
      await admin.page.getByRole('button', { name: 'Ajouter' }).click()
      const vehicleDialog = admin.page.getByRole('dialog')
      await vehicleDialog.locator('#vehicle-registration').fill(registration)
      await vehicleDialog.locator('#vehicle-type').fill('Porteur 10T')
      await vehicleDialog.locator('#vehicle-capacity').fill('10')
      await vehicleDialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(admin.page.getByText(registration, { exact: true })).toBeVisible()
    }

    await admin.page.goto(`${root}/needs/new`)
    await admin.page.locator('#need-client').selectOption({ label: clientName })
    await admin.page.locator('#need-urgency').selectOption('HIGH')
    await admin.page.locator('#need-truck-type').fill('Porteur 10T')
    await admin.page.locator('#need-requested').fill('2')
    await admin.page.locator('#need-tonnage').fill('10')
    await admin.page.locator('#need-cargo').fill('Matériel Calling E2E')
    await admin.page.locator('#need-loading').fill('Abidjan')
    await admin.page.locator('#need-destination').fill('Bouaké')
    await admin.page.locator('#need-mobilization').fill(dateTimeInput(48))
    await admin.page.getByRole('button', { name: 'Publier le besoin' }).click()
    await expect(admin.page).toHaveURL(/\/needs\/[^/]+$/)
    const needId = new URL(admin.page.url()).pathname.split('/').at(-1)
    expect(needId).toBeTruthy()

    agent ??= await signIn(browser, agentCredentials)
    expect(operationsRoot(agent.page.url())).toBe(root)
    await agent.page.goto(`${root}/calling/${needId}`)
    await expect(agent.page.getByRole('heading', { name: 'Appeler' })).toBeVisible()
    await agent.page.getByPlaceholder('Rechercher un transporteur…').fill(carrierName)
    const resultButton = agent.page.getByRole('button', { name: 'Saisir retour' })
    await expect(resultButton).toHaveCount(1)
    await resultButton.click()
    const resultSheet = agent.page.getByRole('dialog', { name: 'Retour d’appel' })
    await expect(resultSheet).toBeVisible()
    await resultSheet.getByTestId(`vehicle-choice-0-${registrationA}`).click()
    await resultSheet.locator('#location-0').fill('Abidjan')
    await resultSheet.getByRole('button', { name: 'Ajouter un camion' }).click()
    await resultSheet.getByTestId(`vehicle-choice-1-${registrationB}`).click()
    await resultSheet.locator('#location-1').fill('Abidjan')
    const documents = resultSheet.locator('input[type="checkbox"]')
    await expect(documents).toHaveCount(2)
    await documents.nth(0).setChecked(true)
    await documents.nth(1).setChecked(true)
    await resultSheet.locator('#calling-price').fill('850000')
    await resultSheet.locator('#calling-available').fill(dateTimeInput(24))
    await resultSheet.getByRole('button', { name: 'Soumettre au superviseur' }).click()
    await expect(resultSheet).toHaveCount(0)

    supervisor ??= await signIn(browser, supervisorCredentials)
    expect(operationsRoot(supervisor.page.url())).toBe(root)
    await supervisor.page.goto(`${root}/calling/supervision`)
    const supervisorOption = supervisor.page.getByText(carrierName, { exact: true }).locator('xpath=ancestor::td')
    await expect(supervisorOption).toBeVisible()
    await supervisorOption.getByRole('button', { name: 'Valider' }).click()
    await expect(supervisorOption.getByText('Validée par le superviseur', { exact: true })).toBeVisible()

    await admin.page.goto(`${root}/calling/supervision`)
    const acceptedOption = admin.page.getByText(carrierName, { exact: true }).locator('xpath=ancestor::td')
    await expect(acceptedOption.getByText('Validée par le superviseur', { exact: true })).toBeVisible()
    const proposedVehicles = acceptedOption.getByRole('checkbox')
    await expect(proposedVehicles).toHaveCount(2)
    await proposedVehicles.nth(1).uncheck()
    await acceptedOption.getByRole('button', { name: 'Accepter' }).click()
    const confirmation = admin.page.getByRole('dialog', { name: 'Confirmer l’acceptation' })
    await expect(confirmation.getByText('1 camion(s)', { exact: false })).toBeVisible()
    await confirmation.getByRole('button', { name: 'Créer la mission' }).click()
    await expect(admin.page.getByText('Acceptée', { exact: true })).toBeVisible()

    await admin.page.goto(`${root}/missions`)
    await admin.page.locator('#missions-search').fill(carrierName)
    await expect(admin.page.getByText(carrierName, { exact: true })).toBeVisible()
    await expect(admin.page.getByText(registrationA, { exact: true })).toBeVisible()
    await expect(admin.page.getByText(registrationB, { exact: true })).toHaveCount(0)
  }
  finally {
    await Promise.all([admin.context.close(), supervisor?.context.close(), agent?.context.close()])
  }
})
