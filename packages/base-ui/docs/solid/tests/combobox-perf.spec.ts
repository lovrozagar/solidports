import { test } from "@playwright/test"

test("combobox input-inside-popup hover perf", async ({ page }) => {
  await page.goto("/solid/components/combobox", { waitUntil: "networkidle" })

  /* find input-inside-popup demo - matches "Select country" placeholder text */
  const trigger = page.locator('button').filter({ hasText: 'Select country' }).first()
  await trigger.scrollIntoViewIfNeeded({ timeout: 10000 })
  await trigger.click()
  await page.waitForTimeout(500)

  /* time hovering over 30 options */
  const start = Date.now()
  const items = page.locator('[role="option"]')
  for (let i = 0; i < 30; i++) {
    await items.nth(i).hover({ force: true })
  }
  const elapsed = Date.now() - start
  console.log(`HOVER_30_OPTIONS_MS ${elapsed}`)

  /* arrow key cycle */
  const start2 = Date.now()
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("ArrowDown")
  }
  const elapsed2 = Date.now() - start2
  console.log(`ARROWDOWN_30_MS ${elapsed2}`)
})
