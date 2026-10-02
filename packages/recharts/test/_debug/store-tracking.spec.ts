import { describe, it, expect } from "vitest"
import { createMemo, createRoot, createRenderEffect, flush } from "solid-js"
import { createStore } from "../../src/util/solid-1-compat"

describe("Solid store tracking", () => {
	it("memo+effect re-runs on store array push", () => {
		let runs = 0
		let lastLen = -1
		const [state, setState] = createStore({ items: [] as number[] })
		const dispose = createRoot((dispose) => {
			const items = createMemo(() => state.items.length)
			createRenderEffect(items, (len) => {
				runs++
				lastLen = len
			})
			return dispose
		})
		flush()
		/* Writes happen outside the root; Solid 2 rejects writes from an owned scope. */
		setState("items", (arr: number[]) => {
			arr.push(1)
		})
		flush()
		expect(runs).toBeGreaterThan(1)
		expect(lastLen).toBe(1)
		dispose()
	})
})
