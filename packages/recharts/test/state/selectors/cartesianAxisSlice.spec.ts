import { describe, it, expect } from "vitest"
import { flush } from "solid-js"
import type { YAxisSettings } from "../../../src/state/cartesianAxisSlice"
import { createRechartsStore } from "../../../src/state/store"
import { createActions } from "../../../src/state/actions"

describe("cartesianAxisSlice", () => {
	describe("updateYAxisWidth", () => {
		const yAxis: YAxisSettings = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: "test-axis",
			includeHidden: false,
			interval: "preserveEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			niceTicks: "auto",
			orientation: "left",
			padding: { bottom: 0, top: 0 },
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: 5,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
			width: "auto",
		}

		function setup() {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)
			/* Solid stores write through to the object they wrap; keep the shared fixture pristine. */
			actions.addYAxis({ ...yAxis })
			flush()
			const width = () => store.cartesianAxes.yAxis["test-axis"]?.settings.width
			const update = (w: number) => {
				actions.updateYAxisWidth({ id: "test-axis", width: w })
				flush()
			}
			return { update, width }
		}

		it("should stop updating width after oscillation is detected", () => {
			const { update, width } = setup()

			expect(width()).toBe("auto")

			update(50)
			expect(width()).toBe(50)

			update(51)
			expect(width()).toBe(51)

			update(50)
			expect(width()).toBe(50)

			// This is the 4th action. The oscillation should be detected and the update ignored.
			update(51)
			expect(width()).toBe(50)
		})

		it("should keep updating if the oscillation is larger than 1 pixel because that is likely to be intentional", () => {
			// https://github.com/recharts/recharts/issues/6424
			const { update, width } = setup()

			expect(width()).toBe("auto")

			update(50)
			expect(width()).toBe(50)

			update(52)
			expect(width()).toBe(52)

			update(50)
			expect(width()).toBe(50)

			// This is the 4th action. The oscillation is larger than 1 pixel, so the update should be accepted.
			update(52)
			expect(width()).toBe(52)
		})
	})
})
