import { expect, test } from "@playwright/test"
import { ROUTES } from "./fixtures/routes"

/* Benign noise filter — font preload hints, Solid dev warning, favicon 404s. */
const NOISE = [
  "preload",
  "Download the Solid",
  "favicon",
  "The resource",
  "was preloaded using link preload but not used",
  "Failed to load resource",
]

function isNoise(text: string): boolean {
  return NOISE.some((n) => text.includes(n))
}

for (const route of ROUTES) {
  test(`renders ${route}`, async ({ page }) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []

    page.on("pageerror", (e) => pageErrors.push(e.message))
    const hydrationWarnings: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
      // Solid reports a server/client tree mismatch as a warning; the page still looks right but
      // the mismatched nodes are detached copies that never become interactive.
      else if (msg.type() === "warning" && /^Hydration (key miss|completed with)/.test(msg.text()))
        hydrationWarnings.push(msg.text().slice(0, 200))
    })

    const response = await page.goto(route, { waitUntil: "networkidle" })
    expect(response?.status(), `http status for ${route}`).toBeLessThan(400)

    if (route.startsWith("/solid")) {
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 5_000 })
    }

    expect(pageErrors, `pageerror on ${route}`).toEqual([])

    const unexpected = consoleErrors.filter((e) => !isNoise(e))
    expect(unexpected, `console errors on ${route}`).toEqual([])
    expect(hydrationWarnings, `hydration mismatches on ${route}`).toEqual([])
  })
}
