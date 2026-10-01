import { expect, test } from "@playwright/test"

test.use({ colorScheme: "dark", viewport: { width: 1440, height: 900 } })

test("homepage team list has the top border above the names", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" })
  const list = page.getByRole("list", { name: "team members" })
  await expect(list).toBeVisible()
  const border = await list.evaluate((element) => {
    const style = getComputedStyle(element)
    return { width: style.borderTopWidth, color: style.borderTopColor }
  })
  expect(border.width, `border-top ${JSON.stringify(border)}`).toBe("1px")
  expect(border.color, `border-top ${JSON.stringify(border)}`).not.toBe("rgba(0, 0, 0, 0)")
})

test("toast appears when Create toast is clicked", async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/solid/components/toast", { waitUntil: "domcontentloaded" })
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 })
  const button = page.getByRole("button", { name: "Create toast" }).first()
  await expect(button, errors.join("\n") || "Create toast never rendered").toBeVisible({
    timeout: 20_000,
  })
  await button.click()
  await expect(page.getByText(/Toast \d+ created/)).toBeVisible()
})

test("nested checkbox rows indent by level", async ({ page }) => {
  await page.goto("/solid/components/checkbox-group", { waitUntil: "networkidle" })
  const demo = page.locator("[data-demo]").filter({ hasText: "Assign Roles" }).first()
  await demo.scrollIntoViewIfNeeded()

  const xOf = async (name: string) => {
    const box = await demo.getByText(name, { exact: true }).boundingBox()
    expect(box, name).not.toBeNull()
    return box!.x
  }

  const user = await xOf("User Permissions")
  const view = await xOf("View Dashboard")
  const create = await xOf("Create User")

  expect(view, `View Dashboard x=${view} User Permissions x=${user}`).toBeGreaterThan(user + 8)
  expect(create, `Create User x=${create} View Dashboard x=${view}`).toBeGreaterThan(view + 8)
})

test("navigation menu popup animates width and height between items", async ({ page }) => {
  await page.goto("/solid/components/navigation-menu", { waitUntil: "networkidle" })
  const demo = page.locator("[data-demo]").first()
  await demo.scrollIntoViewIfNeeded()

  const overview = demo.getByRole("button", { name: "Overview" })
  const handbook = demo.getByRole("button", { name: "Handbook" })
  await overview.hover()
  const popup = page.locator("nav[data-side]")
  await expect(popup).toBeVisible()
  const start = await popup.boundingBox()
  expect(start).not.toBeNull()

  const samples = page.evaluate(() => {
    return new Promise<Array<{ width: number; height: number }>>((resolve) => {
      const frames: Array<{ width: number; height: number }> = []
      const started = performance.now()
      const tick = () => {
        const node = document.querySelector("nav[data-side]") as HTMLElement | null
        if (node) {
          const box = node.getBoundingClientRect()
          frames.push({ width: Math.round(box.width), height: Math.round(box.height) })
        }
        if (performance.now() - started < 450) requestAnimationFrame(tick)
        else resolve(frames)
      }
      requestAnimationFrame(tick)
    })
  })

  await handbook.hover()
  const frames = await samples
  await expect(popup.getByRole("link", { name: "Styling Base UI components" })).toBeVisible()
  const end = await popup.boundingBox()
  expect(end).not.toBeNull()

  const widths = frames.map((frame) => frame.width)
  const heights = frames.map((frame) => frame.height)
  const widthDelta = Math.abs(end!.width - start!.width)
  const heightDelta = Math.abs(end!.height - start!.height)
  const dimension = heightDelta > widthDelta ? heights : widths
  const from = heightDelta > widthDelta ? start!.height : start!.width
  const to = heightDelta > widthDelta ? end!.height : end!.width
  const delta = Math.abs(to - from)
  expect(delta, `size did not change ${JSON.stringify(start)} -> ${JSON.stringify(end)}`).toBeGreaterThan(20)
  const maxStep = dimension.slice(1).reduce((max, value, index) => {
    return Math.max(max, Math.abs(value - dimension[index]!))
  }, 0)
  expect(
    maxStep,
    `size jumped from ${from} to ${to}; samples=${JSON.stringify(dimension)}`,
  ).toBeLessThan(delta * 0.6)
})
