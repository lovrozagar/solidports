import { test, expect } from "@playwright/test"

test("collapsible panel height var transitions on first open", async ({ page }) => {
  await page.goto("/solid/components/collapsible", { waitUntil: "networkidle" })
  const trigger = page.locator('[data-demo] button[aria-expanded="false"]').first()
  await trigger.scrollIntoViewIfNeeded()

  const initial = await page.evaluate(() => {
    const demo = document.querySelector("[data-demo]")
    return demo?.outerHTML.slice(0, 1500) ?? "no demo"
  })
  console.log("INITIAL", initial)

  const records = await page.evaluate(async () => {
    const trigger = document.querySelector('[data-demo] button[aria-expanded="false"]') as HTMLButtonElement
    const out: Array<string> = []
    const start = performance.now()
    const ts = () => Math.round(performance.now() - start)
    const isPanel = (n: HTMLElement) => n.classList.toString().includes("Panel") && n.parentElement?.classList.toString().includes("Collapsible")
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "childList") {
          for (const n of m.addedNodes as any) {
            if (n instanceof HTMLElement && isPanel(n)) {
              const cs = getComputedStyle(n)
              out.push(`+${ts()}ms MOUNT heightVar=${cs.getPropertyValue("--collapsible-panel-height").trim()} startingStyle=${n.hasAttribute("data-starting-style")} attrs="${[...n.attributes].map(a => a.name).join(",")}"`)
            }
          }
        }
        if (m.type === "attributes" && m.target instanceof HTMLElement && isPanel(m.target)) {
          const t = m.target
          const cs = getComputedStyle(t)
          out.push(`+${ts()}ms ATTR ${m.attributeName} heightVar=${cs.getPropertyValue("--collapsible-panel-height").trim()} startingStyle=${t.hasAttribute("data-starting-style")} computed-h=${cs.height}`)
        }
      }
    })
    obs.observe(document.body, { childList: true, subtree: true, attributes: true })
    trigger.click()
    await new Promise((r) => setTimeout(r, 400))
    obs.disconnect()
    return out
  })
  console.log("RECORDS\n  " + records.join("\n  "))
  expect(records.some((r) => /heightVar=\d+px/.test(r)), `expected px heightVar; saw:\n${records.join("\n")}`).toBe(true)
})
