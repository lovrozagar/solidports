import { describe, it, expect } from "vitest"
import { getErrorDomainByDataKey } from "../../src/state/selectors/axisSelectors"
import { ErrorBarsSettings } from "../../src/state/errorBarSlice"

describe("getErrorDomainByDataKey", () => {
	describe.each([null, undefined])("when entry = %s", (entry) => {
		it("should return empty array when errorBar.dataKey is string", () => {
			const errorBars: ReadonlyArray<ErrorBarsSettings> = [{ dataKey: "uv", direction: "x" }]
			expect(getErrorDomainByDataKey(entry, 1, errorBars)).toEqual([])
		})
		it(`should return empty array even when errorBars.dataKey returns a number anyway;
              this behaviour is inherited from getValueByDataKey and is not technically required here but here we are`, () => {
			const errorBars: ReadonlyArray<ErrorBarsSettings> = [{ dataKey: () => 7, direction: "x" }]
			expect(getErrorDomainByDataKey(entry, 1, errorBars)).toEqual([])
		})
	})
	it("should return empty array when errorBars is empty", () => {
		expect(getErrorDomainByDataKey(1, 1, [])).toEqual([])
	})
	it.each([null, undefined])(
		"should return empty array when errorBars.dataKey is %s",
		(dataKey) => {
			/* testing runtime behavior with invalid input */
			const errorBars: ReadonlyArray<ErrorBarsSettings> = [
				{ dataKey: dataKey as never, direction: "x" },
			]
			expect(getErrorDomainByDataKey(1, 1, errorBars)).toEqual([])
		},
	)
	it("should return all ErrorValues in a single array when the errorBar.dataKey results in a number", () => {
		const entry = {
			errX: 3,
			errY: 7,
			val: 2,
		}
		const errorBars: ReadonlyArray<ErrorBarsSettings> = [
			{ dataKey: "errX", direction: "x" },
			{ dataKey: "errY", direction: "y" },
		]
		expect(getErrorDomainByDataKey(entry, 2, errorBars)).toEqual([-1, 5, -5, 9])
	})
	it("should return array of all errors when the errorBar.dataKey results in an array", () => {
		const entry = {
			errX: [3, 7],
			errY: [11, 13],
			val: 2,
		}
		const errorBars: ReadonlyArray<ErrorBarsSettings> = [
			{ dataKey: "errX", direction: "x" },
			{ dataKey: "errY", direction: "y" },
		]
		expect(getErrorDomainByDataKey(entry, 2, errorBars)).toEqual([-1, 9, -9, 15])
	})
	it("should return empty array if errorBars are undefined", () => {
		const entry = {
			errX: [3, 7],
			errY: [11, 13],
			val: 2,
		}
		const errorBars: ReadonlyArray<ErrorBarsSettings> | undefined = undefined
		expect(getErrorDomainByDataKey(entry, 2, errorBars)).toEqual([])
	})
})
