import { test } from "@playwright/test"

test("toolbar button text content", async ({ page }) => {
  await page.goto("/solid/components/toolbar", { waitUntil: "networkidle" })
  const dump = await page.evaluate(() => {
    const root = document.querySelector('[data-demo] [class*="Toolbar"]')
    return root?.outerHTML.slice(0, 1500) ?? "no toolbar"
  })
  console.log("DUMP", dump)
})
