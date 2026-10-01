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

test('writing mode keeps the draft and supports keyboard saving', async ({
  page,
}) => {
  await page.goto('/tests/harness/journal.html')
  await page.getByLabel('Votre texte').fill('Un texte qui traverse les modes.')
  await page.getByRole('button', { name: 'Mode écriture', exact: true }).click()
  await expect(page.getByLabel('Historique du journal')).toBeHidden()
  await expect(page.getByLabel('Votre texte')).toBeFocused()
  await page.keyboard.press('Control+s')
  await expect(
    page.getByRole('status').filter({ hasText: 'Entrée enregistrée.' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Historique du journal')).toBeVisible()
  await expect(
    page.locator('.journal-entry', {
      hasText: 'Un texte qui traverse les modes.',
    }),
  ).toBeVisible()
})

test('changing an entry protects unsaved writing in a keyboard accessible dialog', async ({
  page,
}) => {
  await page.goto('/tests/harness/journal.html')
  await page.getByLabel('Votre texte').fill('Un brouillon à conserver.')
  await page
    .locator('.journal-entry', { hasText: 'Retrouver mon rythme' })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Continuer à écrire' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByLabel('Votre texte')).toHaveValue(
    'Un brouillon à conserver.',
  )
  await page
    .getByRole('button', { name: 'Nouvelle entrée', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Abandonner les modifications' })
    .click()
  await expect(page.getByLabel('Votre texte')).toHaveValue('')
})

test('history can be retried without losing the draft', async ({ page }) => {
  await page.goto('/tests/harness/journal.html?historyFail=1')
  await expect(page.getByRole('alert')).toContainText('historique')
  await page
    .getByLabel('Votre texte')
    .fill('Toujours là pendant la reconnexion.')
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(
    page.locator('.journal-entry', { hasText: 'Retrouver mon rythme' }),
  ).toBeVisible()
  await expect(page.getByLabel('Votre texte')).toHaveValue(
    'Toujours là pendant la reconnexion.',
  )
})

test('mobile journal keeps saving accessible and centers the active navigation item', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/tests/harness/journal.html')
  const save = page.getByRole('button', { name: 'Enregistrer', exact: true })
  await expect
    .poll(
      async () =>
        (await save.boundingBox())!.y + (await save.boundingBox())!.height,
    )
    .toBeLessThan(670)
  const selected = page.locator('.mobile-nav [aria-current="page"]')
  await expect
    .poll(async () => (await selected.boundingBox())!.x)
    .toBeGreaterThanOrEqual(0)
  await expect
    .poll(
      async () =>
        (await selected.boundingBox())!.x +
        (await selected.boundingBox())!.width,
    )
    .toBeLessThanOrEqual(320)
})

test('mobile mood picker gives writing room and retains the selected feeling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/tests/harness/journal.html')
  const group = page.getByRole('group', { name: 'Votre ressenti (facultatif)' })
  await expect(group).toBeHidden()
  await page
    .getByRole('button', { name: 'Choisir un ressenti', exact: true })
    .click()
  await page.getByRole('button', { name: 'Très bien', exact: true }).click()
  await expect(group).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Choisir un ressenti', exact: true }),
  ).toContainText('Très bien')
  const textarea = await page.getByLabel('Votre texte').boundingBox()
  const footer = await page.locator('.journal-editor-footer').boundingBox()
  expect(footer!.y - textarea!.y).toBeGreaterThan(60)
})
