import { test, expect } from "@playwright/test"

test("accordion panel height var transitions on open", async ({ page }) => {
  await page.goto("/solid/components/accordion", { waitUntil: "networkidle" })
  const trigger = page.locator('[data-demo] button[aria-expanded="false"]').first()
  await trigger.scrollIntoViewIfNeeded()

  const records = await page.evaluate(async () => {
    const trigger = document.querySelector('[data-demo] button[aria-expanded="false"]') as HTMLButtonElement
    const out: Array<string> = []
    const start = performance.now()
    const ts = () => Math.round(performance.now() - start)
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type !== "attributes" || !(m.target instanceof HTMLElement)) continue
        const t = m.target
        if (t.getAttribute("role") !== "region" || !t.hasAttribute("aria-labelledby")) continue
        if (m.attributeName === "style") {
          const cs = getComputedStyle(t)
          out.push(`+${ts()}ms heightVar=${cs.getPropertyValue("--accordion-panel-height").trim()}`)
        }
      }
    })
    obs.observe(document.body, { childList: true, subtree: true, attributes: true })
    trigger.click()
    await new Promise((r) => setTimeout(r, 400))
    obs.disconnect()
    return out
  })

  /* expect at least one px-valued height var during the open transition */
  expect(records.some((r) => /heightVar=\d+px/.test(r)), `expected px height var; saw:\n${records.join("\n")}`).toBe(true)
})
