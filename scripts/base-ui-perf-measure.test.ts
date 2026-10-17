import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { type Browser, type CDPSession, type Page, chromium } from "playwright"
import { calibrateScript, evaluateInTask } from "../packages/base-ui/test/perf-solid/shared/measure.mjs"

// A positive control for the benches' `script` metric (CDP `ScriptDuration`), in a real Chromium.
// CI's script job installs no browser; the benches run the same check at startup.
const hasChromium = existsSync(chromium.executablePath())

let browser: Browser
let page: Page
let cdp: CDPSession
beforeAll(async () => {
	if (!hasChromium) return
	browser = await chromium.launch()
	page = await browser.newPage()
	cdp = await page.context().newCDPSession(page)
	await cdp.send("Performance.enable")
})
afterAll(async () => {
	await browser?.close()
})

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
