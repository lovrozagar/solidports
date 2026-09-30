import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { describe, expect, test } from "vitest"

const SOLID_PROD_URL = "http://localhost:5183/#/bar"
const PASSES = 5
const SELECTOR = ".recharts-bar-rectangle"
const TIMEOUT_MS = 5000

const dirname =
	typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url))

const BASELINE_PATH = path.resolve(dirname, ".baseline.json")

async function isServerReachable(url: string): Promise<boolean> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
		return res.ok || res.status < 500
	} catch {
		return false
	}
}

async function measurePass(url: string): Promise<number> {
	const browser = await chromium.launch()
	const ctx = await browser.newContext({ viewport: { height: 720, width: 1280 } })
	const page = await ctx.newPage()

	await page.addInitScript(() => {
		;(window as unknown as Record<string, unknown>).__rafSamples = []
		const orig = window.requestAnimationFrame.bind(window)
		window.requestAnimationFrame = (cb) => {
			return orig((t) => {
				const start = performance.now()
				cb(t)
				;(window as unknown as Record<string, unknown[]>).__rafSamples.push(
					performance.now() - start,
				)
			})
		}
	})

	const t0 = Date.now()
	await page.goto(url)
	await page.waitForSelector(SELECTOR, { timeout: TIMEOUT_MS })
	const tFirstBar = Date.now() - t0

	await browser.close()
	return tFirstBar
}

describe("baseline capture", () => {
	test("records 5-pass avg tFirstBar to .baseline.json — no assertion", async () => {
		const reachable = await isServerReachable(SOLID_PROD_URL)
		if (!reachable) {
			console.log("Solid prod server :5183 not running, skipping perf baseline")
			return
		}

		const samples: number[] = []
		for (let i = 0; i < PASSES; i++) {
			const t = await measurePass(SOLID_PROD_URL)
			samples.push(t)
		}

		const avg = samples.reduce((a, b) => a + b, 0) / samples.length

		writeFileSync(BASELINE_PATH, JSON.stringify({ samples, tFirstBar: avg }, null, 2))

		console.log(`Baseline recorded: avg=${avg.toFixed(1)}ms samples=${JSON.stringify(samples)}`)

		/* record-only — this always passes */
		expect(avg).toBeGreaterThan(0)
	}, 120_000)
})
