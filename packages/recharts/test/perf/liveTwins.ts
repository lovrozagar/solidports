import { chromium } from "playwright"

/*
 * Live Solid-vs-React twin measurement for the perf gates. Both example apps must be served as
 * production previews: Solid on 5193 (`examples/basic`), React on 5184 (`examples/react`).
 * Passes alternate the framework order so drift hits both sides equally.
 */

export const TWIN_URLS = {
	react: "http://localhost:5184",
	solid: "http://localhost:5193",
} as const

export type Framework = keyof typeof TWIN_URLS

export type PassResult = {
	tFirstPaint: number
	/* rAF callback durations recorded after the first paint */
	rafSamples: number[]
}

export async function isServerReachable(url: string): Promise<boolean> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
		return res.ok || res.status < 500
	} catch {
		return false
	}
}

export async function twinsReachable(): Promise<boolean> {
	const [solid, react] = await Promise.all([isServerReachable(TWIN_URLS.solid), isServerReachable(TWIN_URLS.react)])
	if (!solid || !react) {
		console.log(`twin previews not running (solid ${TWIN_URLS.solid}: ${solid}, react ${TWIN_URLS.react}: ${react}); skipping`)
	}
	return solid && react
}

async function measurePass(url: string, selector: string, windowMs: number): Promise<PassResult> {
	const browser = await chromium.launch()
	try {
		const ctx = await browser.newContext({ viewport: { height: 720, width: 1280 } })
		const page = await ctx.newPage()
		await page.addInitScript(() => {
			const samples: number[] = []
			const timestamps: number[] = []
			Object.assign(window, { __rafSamples: samples, __rafTimestamps: timestamps })
			const orig = window.requestAnimationFrame.bind(window)
			window.requestAnimationFrame = (cb) =>
				orig((t) => {
					const start = performance.now()
					cb(t)
					samples.push(performance.now() - start)
					timestamps.push(start)
				})
		})
		const t0 = Date.now()
		await page.goto(url)
		await page.waitForSelector(selector, { timeout: 10_000 })
		const tFirstPaint = Date.now() - t0
		const paintedAt = await page.evaluate(() => performance.now())
		await page.waitForTimeout(windowMs)
		const { samples, timestamps } = await page.evaluate(() => {
			const store = window as unknown as { __rafSamples: number[]; __rafTimestamps: number[] }
			return { samples: store.__rafSamples, timestamps: store.__rafTimestamps }
		})
		return { rafSamples: samples.filter((_, i) => (timestamps[i] ?? 0) >= paintedAt), tFirstPaint }
	} finally {
		await browser.close()
	}
}

/** Runs `passes` cold mounts of `route` per framework, alternating order each pass. */
export async function measureTwins(
	route: string,
	selector: string,
	passes: number,
	windowMs: number,
): Promise<Record<Framework, PassResult[]>> {
	const out: Record<Framework, PassResult[]> = { react: [], solid: [] }
	for (let i = 0; i < passes; i++) {
		const order: Framework[] = i % 2 ? ["react", "solid"] : ["solid", "react"]
		for (const fw of order) {
			out[fw].push(await measurePass(`${TWIN_URLS[fw]}/#/${route}`, selector, windowMs))
		}
	}
	return out
}

export const average = (values: number[]): number =>
	values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
