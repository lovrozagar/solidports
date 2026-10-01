import { expect, test } from "@playwright/test"

test("OTP field distributes one character per slot and advances focus", async ({ page }) => {
  await page.goto("/solid/components/otp-field", { waitUntil: "networkidle" })

  /* Slot 1 is the first visible input — it has no aria-label (covered by the <label>),
     so query by the known autocomplete attribute instead. */
  const slot0 = page.locator('[data-demo] input[autocomplete="one-time-code"]').first()
  await slot0.scrollIntoViewIfNeeded()
  await slot0.click()

  await page.keyboard.type("131431")

  /* Grab all 6 OTP inputs inside the demo section */
  const slots = page.locator('[data-demo] input[type="text"], [data-demo] input[type="password"]').filter({ hasNot: page.locator('[aria-hidden="true"]') })

  await expect(slots.nth(0)).toHaveValue("1")
  await expect(slots.nth(1)).toHaveValue("3")
  await expect(slots.nth(2)).toHaveValue("1")
  await expect(slots.nth(3)).toHaveValue("4")
  await expect(slots.nth(4)).toHaveValue("3")
  await expect(slots.nth(5)).toHaveValue("1")
})

test("OTP field paste populates all slots", async ({ page }) => {
  await page.goto("/solid/components/otp-field", { waitUntil: "networkidle" })

  const slot0 = page.locator('[data-demo] input[autocomplete="one-time-code"]').first()
  await slot0.scrollIntoViewIfNeeded()
  await slot0.click()

  /* Simulate paste via clipboard API */
  await page.evaluate(() => {
    const el = document.querySelector('[data-demo] input[autocomplete="one-time-code"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.setData("text/plain", "987654")
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }))
  })

  const slots = page.locator('[data-demo] input[type="text"], [data-demo] input[type="password"]').filter({ hasNot: page.locator('[aria-hidden="true"]') })

  await expect(slots.nth(0)).toHaveValue("9")
  await expect(slots.nth(1)).toHaveValue("8")
  await expect(slots.nth(2)).toHaveValue("7")
  await expect(slots.nth(3)).toHaveValue("6")
  await expect(slots.nth(4)).toHaveValue("5")
  await expect(slots.nth(5)).toHaveValue("4")
})
