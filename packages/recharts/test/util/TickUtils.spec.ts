import { isVisible } from "../../src/util/TickUtils"

describe("isVisible", () => {
	test.each([
		{ end: 100, position: 50, sign: 1, size: 10, start: 0 },
		{ end: 100, position: 50, sign: 1, size: 50, start: 0 },
		{ end: 100, position: 50, sign: 1, size: 100, start: 0 },
		{ end: 100, position: 50, sign: 0, size: 10, start: 0 },
		{ end: 100, position: 50, sign: 0, size: 50, start: 0 },
		{ end: 100, position: 50, sign: 0, size: 100, start: 0 },
	])("is returns true if tick is inside limits: (%o)", ({ sign, position, size, start, end }) => {
		expect(isVisible(sign, position, () => size, start, end)).toBeTruthy()
	})
	test.each([
		{ end: 100, position: 50, sign: -1, size: 10, start: 0 },
		{ end: 100, position: 50, sign: -1, size: 50, start: 0 },
		{ end: 100, position: 50, sign: -1, size: 100, start: 0 },
		{ end: 100, position: 50, sign: 1, size: 101, start: 0 },
		{ end: 100, position: 10, sign: 1, size: 10_000, start: 50 },
		{ end: 100, position: 110, sign: 1, size: 10_000, start: 50 },
		{ end: 100, position: 50, sign: -1, size: 101, start: 0 },
		{ end: 100, position: 10, sign: -1, size: 10_000, start: 50 },
		{ end: 100, position: 110, sign: -1, size: 10_000, start: 50 },
	])("is returns false if tick is outside limits: (%o)", ({ sign, position, size, start, end }) => {
		expect(isVisible(sign, position, () => size, start, end)).toBeFalsy()
	})
})
