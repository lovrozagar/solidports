import { describe, it, expect } from "vitest"
import type {
	ReferenceAreaSettings,
	ReferenceDotSettings,
	ReferenceLineSettings,
} from "../../src/state/referenceElementsSlice"
import { createRechartsStore } from "../../src/state/store"
import { createActions } from "../../src/state/actions"

describe("referenceElementsSlice", () => {
	it("should add and remove reference dot", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		expect(store.referenceElements.dots).toEqual([])

		const dot: ReferenceDotSettings = {
			ifOverflow: "visible",
			r: 1,
			x: 2,
			xAxisId: 3,
			y: "category 4",
			yAxisId: 5,
		}

		actions.addDot(dot)
		expect(store.referenceElements.dots).toEqual([dot])

		actions.removeDot(dot)
		expect(store.referenceElements.dots).toEqual([])
	})
	it("should add and remove reference area", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		expect(store.referenceElements.areas).toEqual([])

		const area: ReferenceAreaSettings = {
			ifOverflow: "visible",
			x1: 1,
			x2: 2,
			xAxisId: 3,
			y1: "category 4",
			y2: "category 5",
			yAxisId: 6,
		}

		actions.addArea(area)
		expect(store.referenceElements.areas).toEqual([area])

		actions.removeArea(area)
		expect(store.referenceElements.areas).toEqual([])
	})
	it("should add and remove reference line", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		expect(store.referenceElements.lines).toEqual([])

		const line: ReferenceLineSettings = {
			ifOverflow: "visible",
			segment: undefined,
			x: 1,
			xAxisId: 2,
			y: "category 3",
			yAxisId: 4,
		}

		actions.addLine(line)
		expect(store.referenceElements.lines).toEqual([line])

		actions.removeLine(line)
		expect(store.referenceElements.lines).toEqual([])
	})
})
