import {
  expect,
  test,
} from '@playwright/test'

test(
  'public entry keeps the planner locked for anonymous visitors',
  async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole(
        'heading',
        { name: 'Connexion' },
      ),
    ).toBeVisible()

    await expect(
      page.getByLabel(
        'Adresse e-mail',
      ),
    ).toBeVisible()

    await expect(
      page.getByLabel(
        'Mot de passe',
      ),
    ).toBeVisible()

    await expect(
      page.getByRole(
        'button',
        { name: /se connecter/i },
      ),
    ).toBeVisible()

    await expect(
      page.locator(
        '.calendar-shell',
      ),
    ).toHaveCount(0)
  },
)

test(
  'calendar creates and cancels tasks inline',
  async ({ page }) => {
    await page.goto(
      '/tests/harness/calendar.html',
    )

    const monday =
      page.locator(
        '[data-calendar-date="2026-09-21"]',
      )

    await expect(
      monday,
    ).toBeVisible()

    await monday.click({
      position: {
        x: 70,
        y: 150,
      },
    })

    const input =
      page.getByLabel(
        'Titre de la nouvelle tâche',
      )

    await expect(
      input,
    ).toBeFocused()

    await input.fill(
      'Réviser EDP',
    )
    await input.press(
      'Enter',
    )

    await expect(
      page.getByRole(
        'button',
        {
          name: /Réviser EDP/,
        },
      ),
    ).toBeVisible()

    await expect(
      page.locator(
        '.event-card',
      ),
    ).toHaveCount(1)

    await monday.click({
      position: {
        x: 70,
        y: 310,
      },
    })

    await expect(
      page.getByLabel(
        'Titre de la nouvelle tâche',
      ),
    ).toBeFocused()

    await page
      .getByLabel(
        'Titre de la nouvelle tâche',
      )
      .press('Escape')

    await expect(
      page.getByLabel(
        'Titre de la nouvelle tâche',
      ),
    ).toHaveCount(0)

    await expect(
      page.locator(
        '.event-card',
      ),
    ).toHaveCount(1)
  },
)
