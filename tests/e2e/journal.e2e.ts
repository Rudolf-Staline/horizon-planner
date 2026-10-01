import { test, expect } from '@playwright/test'

test('journal saves, edits, archives and restores entries', async ({
  page,
}) => {
  await page.goto('/tests/harness/journal.html')
  await page.getByLabel('Titre').fill('Une belle avancée')
  await page.getByLabel('Votre texte').fill('J’ai terminé une première étape.')
  await page.getByRole('button', { name: 'Très bien', exact: true }).click()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Entrée enregistrée.' }),
  ).toBeVisible()
  await expect(
    page.locator('.journal-entry', { hasText: 'Une belle avancée' }),
  ).toBeVisible()
  await page
    .getByLabel('Votre texte')
    .fill('Une première étape, puis une deuxième.')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(
    page.locator('.journal-entry', { hasText: 'puis une deuxième' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Archiver cette entrée', exact: true })
    .click()
  await expect(
    page.locator('.journal-entry', { hasText: 'Une belle avancée' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Archives', exact: true }).click()
  await expect(
    page.locator('.journal-entry', { hasText: 'Une belle avancée' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Restaurer cette entrée', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Journal', exact: true })
    .last()
    .click()
  await expect(
    page.locator('.journal-entry', { hasText: 'Une belle avancée' }),
  ).toBeVisible()
})

test('failed save and section navigation preserve the draft', async ({
  page,
}) => {
  await page.goto('/tests/harness/journal.html?fail=1')
  await page.getByLabel('Votre texte').fill('Ces mots doivent rester.')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Connexion interrompue')
  await expect(page.getByLabel('Votre texte')).toHaveValue(
    'Ces mots doivent rester.',
  )
  await page
    .locator('.sidebar')
    .getByRole('button', { name: 'Calendrier', exact: true })
    .click()
  await page
    .locator('.sidebar')
    .getByRole('button', { name: 'Journal', exact: true })
    .click()
  await expect(page.getByLabel('Votre texte')).toHaveValue(
    'Ces mots doivent rester.',
  )
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(
    page.locator('.journal-entry', { hasText: 'Ces mots doivent rester.' }),
  ).toBeVisible()
})
for (const width of [1440, 390, 320])
  test(`journal fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tests/harness/journal.html')
    await expect(page.getByLabel('Votre texte')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true)
  })
