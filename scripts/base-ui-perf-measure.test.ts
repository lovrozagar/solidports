import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { type Browser, type CDPSession, type Page, chromium } from "playwright"
import { calibrateScript, collectGarbage, evaluateInTask } from "../packages/base-ui/test/perf-solid/shared/measure.mjs"

// A positive control for the benches' `script` metric (CDP `ScriptDuration`), in a real Chromium.
// CI's script job installs no browser; the benches run the same check at startup.
const hasChromium = existsSync(chromium.executablePath())

// Launching and closing a browser run under the stamp's `nice -n 19 ionice -c3`: a close under
// load 50 on 16 cores took up to 10.5 s there (12 closes; launches under 0.1 s), past Bun's 5 s
// default. Every hook and test here that launches or closes a browser gets this room.
const BROWSER_MS = 60_000

let browser: Browser
let page: Page
let cdp: CDPSession
beforeAll(async () => {
	if (!hasChromium) return
	browser = await chromium.launch()
	page = await browser.newPage()
	cdp = await page.context().newCDPSession(page)
	await cdp.send("Performance.enable")
}, BROWSER_MS)
afterAll(async () => {
	await browser?.close()
}, BROWSER_MS)

const scriptMs = async (run: () => Promise<unknown>) => {
	const read = async () =>
		(await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "ScriptDuration")!.value
	const before = await read()
	await run()
	return ((await read()) - before) * 1000
}

const burn = (ms: number) => {
	const end = performance.now() + ms
	while (performance.now() < end) {
		// Synchronous work, as a Solid step's flush.
	}
}

describe.skipIf(!hasChromium)("bench script metric (Chromium)", () => {
	test("leaves out script run inside a DevTools evaluate", async () => {
		// Why steps run in a task: this is the reading a synchronous step got before.
		expect(await scriptMs(() => page.evaluate(burn, 10))).toBeLessThan(1)
	})

	test("counts a synchronous step run in a task", async () => {
		expect(await scriptMs(() => evaluateInTask(page, burn, 10))).toBeGreaterThanOrEqual(9)
	})

	test("returns the step's result, async ones included", async () => {
		expect(await evaluateInTask(page, (value: number) => Promise.resolve(value * 2), 21)).toBe(42)
	})

	test("calibrates: a 10 ms burn reads at least 9 ms of script", async () => {
		expect(await calibrateScript(page, cdp)).toBeGreaterThanOrEqual(9)
	})
})

describe.skipIf(!hasChromium)("bench heap reading (Chromium)", () => {
	// A positive control for the heap samples: a full collection releases what nothing reaches
	// any more, with the flags the benches launch Chromium with.
	test(
		"collectGarbage releases an allocation once nothing reaches it",
		async () => {
			const gcBrowser = await chromium.launch({ args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"] })
			try {
				const gcPage = await gcBrowser.newPage()
				const gcCdp = await gcPage.context().newCDPSession(gcPage)
				const used = () =>
					gcPage.evaluate(
						() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024,
					)
				await gcPage.evaluate(() => {
					;(window as unknown as { held?: number[] }).held = Array.from({ length: 2_500_000 }, () => 1.5)
				})
				await collectGarbage(gcCdp)
				const held = await used()
				await gcPage.evaluate(() => {
					delete (window as unknown as { held?: number[] }).held
				})
				await collectGarbage(gcCdp)
				expect(held - (await used())).toBeGreaterThan(15_000)
			} finally {
				await gcBrowser.close()
			}
		},
		BROWSER_MS,
	)
})
