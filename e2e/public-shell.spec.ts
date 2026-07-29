import { expect, test } from '@playwright/test'

test('connexion, validation et navigation vers l’inscription', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible()
  await page.getByLabel('Adresse e-mail').fill('responsable@example.com')
  await page.getByLabel('Mot de passe').fill('court')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toContainText('8 caractères')

  await page.getByRole('link', { name: 'Créer un compte' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Créer votre compte' })).toBeVisible()
})

test('validation locale de l’inscription', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Nom complet').fill('Responsable E2E')
  await page.getByLabel('Adresse e-mail').fill('responsable@example.com')
  await page.locator('#register-password').fill('mot-de-passe-e2e')
  await page.locator('#register-confirmation').fill('autre-mot-de-passe')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect(page.getByRole('alert')).toContainText('ne correspondent pas')
})

test('écran hors ligne et App Shell installable', async ({ page, request }) => {
  await page.goto('/offline')
  await expect(page.getByRole('heading', { name: 'Vous êtes hors ligne' })).toBeVisible()

  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  await expect.poll(async () => (await manifest.json()).short_name).toBe('Forus CS')

  for (const asset of ['/pwa-192x192.png', '/pwa-512x512.png', '/maskable-icon.png'])
    expect((await request.get(asset)).ok()).toBe(true)

  const health = await request.get('/api/health')
  expect(health.ok()).toBe(true)
  await expect.poll(async () => (await health.json()).status).toBe('ok')
})

test('aucun débordement horizontal sur mobile', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Contrôle réservé au viewport mobile.')
  await page.goto('/login')

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})
