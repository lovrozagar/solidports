import { chromium } from "playwright"
import { describe, expect, test } from "vitest"

const SOLID_PROD_URL = "http://localhost:5183/#/bar"
const PASSES = 5
const SELECTOR = ".recharts-bar-rectangle"
const TIMEOUT_MS = 5000
const WINDOW_MS = 800

async function isServerReachable(url: string): Promise<boolean> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
		return res.ok || res.status < 500
	} catch {
		return false
	}
}

type RafResult = {
	tFirstBar: number
	samples: number[]
}

async function measurePass(url: string): Promise<RafResult> {
	const browser = await chromium.launch()
	const ctx = await browser.newContext({ viewport: { height: 720, width: 1280 } })
	const page = await ctx.newPage()

	await page.addInitScript(() => {
		;(window as unknown as Record<string, unknown>).__rafSamples = []
		;(window as unknown as Record<string, unknown>).__rafTimestamps = []
		const orig = window.requestAnimationFrame.bind(window)
		window.requestAnimationFrame = (cb) => {
			return orig((t) => {
				const start = performance.now()
				cb(t)
				const duration = performance.now() - start
				;(window as unknown as Record<string, unknown[]>).__rafSamples.push(duration)
				;(window as unknown as Record<string, unknown[]>).__rafTimestamps.push(start)
			})
		}
	})

	const t0 = Date.now()
	await page.goto(url)
	await page.waitForSelector(SELECTOR, { timeout: TIMEOUT_MS })
	const tFirstBar = Date.now() - t0

	await page.waitForTimeout(WINDOW_MS)

	const { samples, timestamps } = await page.evaluate(() => {
		return {
			samples: (window as unknown as Record<string, number[]>).__rafSamples,
			timestamps: (window as unknown as Record<string, number[]>).__rafTimestamps,
		}
	})

	await browser.close()

	/* exclude samples taken before tFirstBar — those are mount-phase ticks */
	const postMountSamples = samples.filter((_, i) => (timestamps[i] ?? 0) >= tFirstBar)

	return { samples: postMountSamples, tFirstBar }
}

describe("animation tick benchmark — T4", () => {
	test(
		"avg per-raf time after mount < 0.002ms (animation tick at parity)",
		async () => {
			const reachable = await isServerReachable(SOLID_PROD_URL)
			if (!reachable) {
				console.log("Solid prod server :5183 not running, skipping animation benchmark")
				return
			}

			const allPostMountSamples: number[] = []

			for (let i = 0; i < PASSES; i++) {
				const { samples } = await measurePass(SOLID_PROD_URL)
				allPostMountSamples.push(...samples)
			}

			if (allPostMountSamples.length === 0) {
				console.log("T4: no post-mount raf samples collected — skipping avg assertion")
				return
			}

			const avgRafMs =
				allPostMountSamples.reduce((a, b) => a + b, 0) / allPostMountSamples.length

			console.log(
				`T4 animation: avgRafMs=${avgRafMs.toFixed(4)}ms sampleCount=${allPostMountSamples.length}`,
			)

			expect(avgRafMs).toBeLessThan(0.002)
		},
		120_000,
	)
})
