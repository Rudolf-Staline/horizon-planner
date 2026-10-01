import { expect, test } from '@playwright/test'

for (const width of [1440, 1024, 390, 320]) {
  test(`workspace fits a ${width}px viewport and keeps navigation usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }))
    await page.goto('/tests/harness/interface.html')
    await expect(page.locator('.week-grid-wrap')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (width <= 900) {
      await expect(page.locator('.day-head')).toHaveCount(1)
      await expect(page.locator('.mobile-nav')).toBeVisible()
      const nav = page.locator('.mobile-nav')
      await nav.getByRole('button', { name: 'Tâches', exact: true }).click()
    } else {
      await expect(page.locator('.day-head')).toHaveCount(7)
      await page.locator('.sidebar').getByRole('button', { name: 'Tâches', exact: true }).click()
    }
    await expect(page.getByRole('heading', { name: 'Tâches', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Nouvelle tâche' }).click()
    await expect(page.locator('.task-inbox-create')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('mobile navigation stays beneath dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/harness/interface.html')
  await page.getByRole('button', { name: /plusieurs jours/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const layers = await page.evaluate(() => ({
    navigation: Number(getComputedStyle(document.querySelector('.mobile-nav')!).zIndex),
    dialog: Number(getComputedStyle(document.querySelector('.batch-overlay')!).zIndex),
  }))
  expect(layers.dialog).toBeGreaterThan(layers.navigation)
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('entry form fits a narrow phone and remains keyboard accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByLabel('Adresse e-mail').focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeFocused()
})
