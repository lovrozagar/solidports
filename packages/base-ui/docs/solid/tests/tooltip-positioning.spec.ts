import { test } from "@playwright/test"

test("tooltip first hover position vs second", async ({ page }) => {
  await page.goto("/solid/components/tooltip", { waitUntil: "networkidle" })

  const trigger = page.locator('[data-demo] [class*="Panel"] button').first()
  await trigger.scrollIntoViewIfNeeded()
  const box = await trigger.boundingBox()
  if (!box) throw new Error("no trigger box")
  console.log("TRIGGER_BOX", JSON.stringify(box))

  /* first hover */
  await page.mouse.move(0, 0)
  await page.mouse.move(box.x - 50, box.y - 50)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
  await page.waitForTimeout(3500)
  const first = await page.evaluate(() => {
    const popup = document.querySelector('[class*="Popup"]') as HTMLElement | null
    if (!popup) return { error: "no popup" }
    const positioner = popup.parentElement as HTMLElement
    const pr = positioner.getBoundingClientRect()
    return { top: Math.round(pr.top), left: Math.round(pr.left), inlineStyle: positioner.getAttribute("style")?.slice(0, 250) }
  })
  console.log("FIRST", JSON.stringify(first))

  /* close + reopen */
  await page.mouse.move(box.x - 200, box.y - 200, { steps: 20 })
  await page.waitForTimeout(1500)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
  await page.waitForTimeout(2500)
  const second = await page.evaluate(() => {
    const popup = document.querySelector('[class*="Popup"]') as HTMLElement | null
    if (!popup) return { error: "no popup 2nd" }
    const positioner = popup.parentElement as HTMLElement
    const pr = positioner.getBoundingClientRect()
    return { top: Math.round(pr.top), left: Math.round(pr.left), inlineStyle: positioner.getAttribute("style")?.slice(0, 250) }
  })
  console.log("SECOND", JSON.stringify(second))
  const apply = await page.evaluate(() => (globalThis as any).__bu_apply ?? [])
  console.log("APPLY", JSON.stringify(apply, null, 2))
})
