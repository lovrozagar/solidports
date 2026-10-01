import { test, expect } from "@playwright/test"

test("menubar nested submenu opens without RangeError", async ({ page }) => {
  const errs: string[] = []
  page.on("pageerror", (e) => errs.push(e.message))

  await page.goto("/solid/components/menubar", { waitUntil: "networkidle" })
  await page.locator("button", { hasText: "File" }).first().click()
  await page.locator("text=Export").first().hover()
  await page.waitForTimeout(800)

  expect(errs, "expected no pageerror after opening nested submenu").toEqual([])
})
