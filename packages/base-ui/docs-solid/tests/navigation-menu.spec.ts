import { test, expect } from "@playwright/test"

test("navigation menu shows content on hover", async ({ page }) => {
  await page.goto("/solid/components/navigation-menu", { waitUntil: "networkidle" })

  const trigger = page.locator('[data-demo] [class*="Trigger"]').first()
  await trigger.scrollIntoViewIfNeeded()
  const box = await trigger.boundingBox()
  if (!box) throw new Error("no trigger")

  /* hover overview trigger */
  await page.mouse.move(0, 0)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
  await page.waitForTimeout(800)
  const overview = await page.evaluate(() => {
    const popup = document.querySelector('nav[class*="Popup"]') as HTMLElement | null
    const positioner = popup?.parentElement as HTMLElement | undefined
    return {
      positioner: positioner ? { left: Math.round(positioner.getBoundingClientRect().left), inlineStyle: positioner.getAttribute("style")?.slice(0, 200) } : null,
    }
  })

  /* hover handbook (second trigger) */
  const triggers = page.locator('[data-demo] [class*="Trigger"]')
  const second = triggers.nth(1)
  const secondBox = await second.boundingBox()
  if (!secondBox) throw new Error("no 2nd trigger")
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 20 })
  await page.waitForTimeout(800)
  const handbook = await page.evaluate(() => {
    const popup = document.querySelector('nav[class*="Popup"]') as HTMLElement | null
    const positioner = popup?.parentElement as HTMLElement | undefined
    return {
      positioner: positioner ? { left: Math.round(positioner.getBoundingClientRect().left), inlineStyle: positioner.getAttribute("style")?.slice(0, 200) } : null,
    }
  })

  console.log("OVERVIEW", JSON.stringify(overview), "trigger:", JSON.stringify(box))
  console.log("HANDBOOK", JSON.stringify(handbook), "trigger:", JSON.stringify(secondBox))
})
