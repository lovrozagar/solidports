import { test, expect } from "@playwright/test"

test("context menu opens on first right-click", async ({ page }) => {
  await page.goto("/solid/components/context-menu", { waitUntil: "networkidle" })

  const trigger = page.locator('[data-demo] [class*="Trigger"]').first()
  await trigger.scrollIntoViewIfNeeded()
  const box = await trigger.boundingBox()
  if (!box) throw new Error("no trigger")

  /* one right-click should open menu */
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" })
  await page.waitForTimeout(400)

  const popupVisible = await page.evaluate(() => {
    const popup = document.querySelector('[class*="MenuPopup"], [class*="Popup"]') as HTMLElement | null
    if (!popup) return { error: "no popup found" }
    const positioner = popup.parentElement as HTMLElement
    const pr = positioner.getBoundingClientRect()
    const popRect = popup.getBoundingClientRect()
    return {
      popup: { top: Math.round(popRect.top), left: Math.round(popRect.left), width: Math.round(popRect.width), height: Math.round(popRect.height) },
      positioner: { top: Math.round(pr.top), left: Math.round(pr.left), inlineStyle: positioner.getAttribute("style")?.slice(0, 300) },
    }
  })
  console.log("AFTER_FIRST_RIGHT_CLICK", JSON.stringify(popupVisible))

  expect("error" in popupVisible, "menu should be in DOM after first right-click").toBe(false)
  const result = popupVisible as { popup: { width: number; top: number; left: number } }
  expect(result.popup.width).toBeGreaterThan(0)
  expect(result.popup.top, "popup must not be stuck at viewport top").toBeGreaterThan(50)
})
