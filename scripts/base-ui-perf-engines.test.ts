import { describe, expect, test } from "bun:test"
import { engineSpec, measuredColumns, parseEngine } from "../packages/base-ui/test/perf-solid/shared/engines.mjs"

// The Chromium benchmark's engine matrix (plan 3, leaf 1.8). Every engine times steps in the page
// (sync, paint, settled); the main-thread split (script, layout, style) is CDP's
// `Performance.getMetrics` and the heap is Chromium's `performance.memory`, so Firefox and WebKit
// report those columns as not measured instead of zero.

describe("bench engines", () => {
	test("Chromium measures every column, through CDP and the precise heap", () => {
		const spec = engineSpec("chromium")
		expect(spec).toMatchObject({ name: "chromium", cdp: true, heap: true })
		expect(spec.launchArgs).toContain("--enable-precise-memory-info")
		expect(measuredColumns(spec)).toEqual(["sync", "paint", "settled", "script", "layout", "style", "heapKB", "heldKB"])
	})

	test("Firefox and WebKit measure the in-page columns only", () => {
		for (const name of ["firefox", "webkit"]) {
			const spec = engineSpec(name)
			expect(spec).toMatchObject({ name, cdp: false, heap: false, launchArgs: [] })
			expect(measuredColumns(spec)).toEqual(["sync", "paint", "settled"])
		}
	})

	test("the engine comes from ENGINE, Chromium by default, and an unknown one is an error", () => {
		expect(parseEngine(undefined)).toBe("chromium")
		expect(parseEngine("webkit")).toBe("webkit")
		expect(() => parseEngine("safari")).toThrow(/chromium, firefox or webkit/)
	})
})
