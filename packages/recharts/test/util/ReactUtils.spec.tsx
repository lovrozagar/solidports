import { vi } from "vitest"

import { getDisplayName } from "../../src/util/ReactUtils"
import { adaptEventHandlers, adaptEventsOfChild } from "../../src/util/types"

describe("ReactUtils", () => {
	describe("getDisplayName", () => {
		test("getDisplayName return empty string when has a null as input", () => {
			// added never casting to test runtime value
			const result = getDisplayName(null as never)

			expect(result).toEqual("")
		})

		test("getDisplayName return the same string when has a string as input", () => {
			const result = getDisplayName("test")

			expect(result).toEqual("test")
		})

		test('getDisplayName return the "Component" when has an object as input', () => {
			const test = {}
			// @ts-expect-error test runtime value
			const result = getDisplayName(test)

			expect(result).toEqual("Component")
		})
	})

	describe("adaptEventHandlers", () => {
		test("adaptEventHandlers return event attributes", () => {
			const result = adaptEventHandlers({
				a: 1,
				onMouseEnter: vi.fn(),
			})
			expect(Object.keys(result ?? {})).toContain("onMouseEnter")
			expect(Object.keys(result ?? {})).not.toContain("a")
		})

		test("adaptEventHandlers return null when input is not a react element", () => {
			expect(adaptEventHandlers(null as any)).toEqual(null)
			expect(adaptEventHandlers(vi.fn())).toEqual(null)
			expect(adaptEventHandlers(1 as any)).toEqual(null)
		})

		test("adaptEventHandlers skips event props that are not functions", () => {
			const result = adaptEventHandlers({
				onClick: vi.fn(),
				onMouseEnter: undefined,
				onMouseLeave: undefined,
			})
			expect(Object.keys(result ?? {})).toEqual(["onClick"])
		})
	})

	describe("adaptEventsOfChild", () => {
		test("adaptEventsOfChild return null when input is not a props", () => {
			expect(adaptEventsOfChild(null as any, undefined, 0)).toEqual(null)
			expect(adaptEventsOfChild(1 as any, undefined, 0)).toEqual(null)
		})
	})


})
