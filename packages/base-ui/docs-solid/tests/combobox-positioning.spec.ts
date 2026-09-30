import { test, expect } from "@playwright/test"

for (const route of ["/solid/components/combobox", "/solid/components/autocomplete"]) {
  test(`${route} popup positions below input not at 0,0`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" })

    const input = page.locator('[data-demo] input').first()
    await input.scrollIntoViewIfNeeded()
    await input.focus()
    await input.click()
    /* autocomplete needs a keystroke to open the popup */
    await input.pressSequentially("a", { delay: 30 })
    await page.waitForTimeout(200)

    const popup = await page.evaluate(() => {
      const positioner = [...document.querySelectorAll('[role="presentation"]')].find((el) =>
        (el as HTMLElement).className.toLowerCase().includes("positioner"),
      ) as HTMLElement | undefined
      if (!positioner) return { error: "no positioner" }
      const r = positioner.getBoundingClientRect()
      return { top: Math.round(r.top), left: Math.round(r.left) }
    })

    expect((popup as any).top, `popup must not be at 0; got ${JSON.stringify(popup)}`).toBeGreaterThan(0)
  })
}
