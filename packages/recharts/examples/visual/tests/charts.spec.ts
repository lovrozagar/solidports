import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

/* Route IDs come from examples/basic/src/App.tsx and examples/react/src/App.tsx — both apps mirror the same set. */
const CHARTS = [
	"line",
	"bar",
	"area",
	"composed",
	"pie",
	"radar",
	"radial",
	"scatter",
	"funnel",
	"sankey",
	"treemap",
	"sunburst",
] as const

const SOLID_BASE = "http://localhost:5173"
const REACT_BASE = "http://localhost:5174"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REFERENCE_DIR = join(__dirname, "__snapshots__", "react-reference")
const DIFF_DIR = join(__dirname, "__snapshots__", "diffs")
const SOLID_DIR = join(__dirname, "__snapshots__", "solid-actual")

const UPDATE_REFERENCE = process.env.UPDATE_REFERENCE === "1"
/* Tolerances tuned for SVG anti-aliasing/font hinting: ~5% pixel-ratio budget, per-pixel YIQ threshold 0.2. */
const MAX_DIFF_PIXEL_RATIO = 0.05
const PIXELMATCH_THRESHOLD = 0.2

for (const dir of [REFERENCE_DIR, DIFF_DIR, SOLID_DIR]) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/* Recharts animates entry over 1500ms via JS-driven RAF — Playwright `animations: "disabled"` only kills CSS transitions, not RAF reveals.
   Wait past the longest entry animation, then poll for two identical screenshots to confirm the surface settled. Without this Area's clipPath reveal lands at non-deterministic progress, drifting 5%+ between Solid and React captures. */
const ANIMATION_SETTLE_MS = 1700
const STABILITY_INTERVAL_MS = 120
const STABILITY_TIMEOUT_MS = 5000

async function captureChart(page: Page, base: string, id: string): Promise<Buffer> {
	await page.goto(`${base}/#/${id}`, { waitUntil: "networkidle" })
	const wrapper = page.locator(".recharts-wrapper").first()
	await wrapper.waitFor({ state: "visible", timeout: 15_000 })
	await page.waitForTimeout(ANIMATION_SETTLE_MS)
	const main = page.locator("main").first()
	let last = await main.screenshot({ animations: "disabled", caret: "hide" })
	const deadline = Date.now() + STABILITY_TIMEOUT_MS
	while (Date.now() < deadline) {
		await page.waitForTimeout(STABILITY_INTERVAL_MS)
		const next = await main.screenshot({ animations: "disabled", caret: "hide" })
		if (next.equals(last)) return next
		last = next
	}
	return last
}

type DiffResult = {
	width: number
	height: number
	diffPixels: number
	totalPixels: number
	ratio: number
	diffPng: Buffer
}

function diffPngs(reference: Buffer, actual: Buffer): DiffResult {
	const ref = PNG.sync.read(reference)
	const act = PNG.sync.read(actual)
	if (ref.width !== act.width || ref.height !== act.height) {
		throw new Error(
			`@solidports/recharts: dimension mismatch — ref ${ref.width}x${ref.height} vs actual ${act.width}x${act.height}`,
		)
	}
	const diff = new PNG({ width: ref.width, height: ref.height })
	const diffPixels = pixelmatch(
		ref.data,
		act.data,
		diff.data,
		ref.width,
		ref.height,
		{ threshold: PIXELMATCH_THRESHOLD },
	)
	const totalPixels = ref.width * ref.height
	return {
		width: ref.width,
		height: ref.height,
		diffPixels,
		totalPixels,
		ratio: diffPixels / totalPixels,
		diffPng: PNG.sync.write(diff),
	}
}

for (const id of CHARTS) {
	test(`${id} chart matches React reference`, async ({ page }) => {
		const referencePath = join(REFERENCE_DIR, `${id}.png`)
		const solidActualPath = join(SOLID_DIR, `${id}.png`)
		const diffPath = join(DIFF_DIR, `${id}.png`)

		const reactShot = await captureChart(page, REACT_BASE, id)
		expect(reactShot.length, `react capture for ${id} returned empty buffer`).toBeGreaterThan(0)

		/* React reference is the baseline; first run (or UPDATE_REFERENCE=1) writes it for review + commit. */
		if (UPDATE_REFERENCE || !existsSync(referencePath)) {
			writeFileSync(referencePath, reactShot)
		}

		const reference = readFileSync(referencePath)
		const solidShot = await captureChart(page, SOLID_BASE, id)
		writeFileSync(solidActualPath, solidShot)

		const result = diffPngs(reference, solidShot)
		writeFileSync(diffPath, result.diffPng)

		expect.soft(
			result.ratio,
			`${id}: ${result.diffPixels}/${result.totalPixels} px differ (${(result.ratio * 100).toFixed(2)}%) — see ${diffPath}`,
		).toBeLessThanOrEqual(MAX_DIFF_PIXEL_RATIO)
	})
}

test("react reference renders all 12 charts", async ({ page }) => {
	const missing: Array<string> = []
	for (const id of CHARTS) {
		await page.goto(`${REACT_BASE}/#/${id}`, { waitUntil: "networkidle" })
		const visible = await page
			.locator(".recharts-wrapper")
			.first()
			.isVisible()
			.catch(() => false)
		if (!visible) missing.push(id)
	}
	expect(missing, `react missing charts: ${missing.join(", ")}`).toEqual([])
})

test("solid port renders all 12 charts", async ({ page }) => {
	const missing: Array<string> = []
	for (const id of CHARTS) {
		await page.goto(`${SOLID_BASE}/#/${id}`, { waitUntil: "networkidle" })
		const visible = await page
			.locator(".recharts-wrapper")
			.first()
			.isVisible()
			.catch(() => false)
		if (!visible) missing.push(id)
	}
	expect(missing, `solid missing charts: ${missing.join(", ")}`).toEqual([])
})
