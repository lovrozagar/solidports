import { describe, expect, test } from "vitest"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { Bar, BarChart, BarStack } from "../../../src"
import { PageData } from "../../_data"
import {
	expandRectangle,
	selectAllBarsInStack,
	selectStackRects,
} from "../../../src/state/selectors/barStackSelectors"
import type { BarStackItem } from "../../../src/state/selectors/barStackSelectors"
import type { BarRectangleItem } from "../../../src/cartesian/Bar"
import { assertNotNull } from "../../helper/assertNotNull"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { defaultAxisId } from "../../../src/state/cartesianAxisSlice"
import { selectBarRectangles } from "../../../src/state/selectors/barSelectors"

describe("BarStack Selectors", () => {
	describe("in chart with BarStack", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={200} height={200} data={PageData}>
				<BarStack stackId="mystackid">
					<Bar dataKey="uv" id="red" />
					<Bar dataKey="pv" id="green" />
					{props.children}
				</BarStack>
				<Bar dataKey="amt" id="blue" />
			</BarChart>
		))

		test("selectAllBarsInStack", () => {
			const { spy } = renderTestCase((state) => selectAllBarsInStack(state, "mystackid", false))
			expectLastCalledWith(spy, [
				expect.objectContaining({
					id: "red",
					stackId: "mystackid",
					type: "bar",
					xAxisId: defaultAxisId,
					yAxisId: defaultAxisId,
				}),
				expect.objectContaining({
					id: "green",
					stackId: "mystackid",
					type: "bar",
					xAxisId: defaultAxisId,
					yAxisId: defaultAxisId,
				}),
			])
		})
		test("selectBarRectangles for first bar", () => {
			const { spy } = renderTestCase((state) => selectBarRectangles(state, "red", false, undefined))
			expectLastCalledWith(spy, [
				expect.objectContaining({
					height: 7.600000000000023,
					width: 11,
					x: 8.166666666666668,
					y: 187.39999999999998,
				}),
				expect.objectContaining({
					height: 5.699999999999989,
					width: 11,
					x: 39.833333333333336,
					y: 189.3,
				}),
				expect.objectContaining({
					height: 5.699999999999989,
					width: 11,
					x: 71.50000000000001,
					y: 189.3,
				}),
				expect.objectContaining({
					height: 3.8000000000000114,
					width: 11,
					x: 103.16666666666667,
					y: 191.2,
				}),
				expect.objectContaining({
					height: 5.282000000000011,
					width: 11,
					x: 134.83333333333334,
					y: 189.718,
				}),
				expect.objectContaining({
					height: 3.591000000000008,
					width: 11,
					x: 166.5,
					y: 191.409,
				}),
			])
		})
		test("selectBarRectangles for second bar", () => {
			const { spy } = renderTestCase((state) =>
				selectBarRectangles(state, "green", false, undefined),
			)
			expectLastCalledWith(spy, [
				expect.objectContaining({
					height: 45.599999999999966,
					width: 11,
					x: 8.166666666666668,
					y: 141.8,
				}),
				expect.objectContaining({
					height: 86.77300000000002,
					width: 11,
					x: 39.833333333333336,
					y: 102.52699999999999,
				}),
				expect.objectContaining({
					height: 26.562000000000012,
					width: 11,
					x: 71.50000000000001,
					y: 162.738,
				}),
				expect.objectContaining({
					height: 186.2,
					width: 11,
					x: 103.16666666666667,
					y: 5,
				}),
				expect.objectContaining({
					height: 74.252,
					width: 11,
					x: 134.83333333333334,
					y: 115.466,
				}),
				expect.objectContaining({
					height: 91.19999999999999,
					width: 11,
					x: 166.5,
					y: 100.209,
				}),
			])
		})
		test("selectStackRects should select edges of all rectangles in this stack", () => {
			const { spy } = renderTestCase((state) => selectStackRects(state, "mystackid", false))
			expectLastCalledWith(spy, [
				{ height: 53.19999999999999, width: 11, x: 8.166666666666668, y: 141.8 },
				{ height: 92.47300000000001, width: 11, x: 39.833333333333336, y: 102.52699999999999 },
				{ height: 32.262, width: 11, x: 71.50000000000001, y: 162.738 },
				{ height: 190, width: 11, x: 103.16666666666667, y: 5 },
				{ height: 79.534, width: 11, x: 134.83333333333334, y: 115.466 },
				{ height: 94.791, width: 11, x: 166.5, y: 100.209 },
			])
		})
	})
	describe("in chart with stackOffset=sign and negative values", () => {
		// https://github.com/recharts/recharts/issues/6802
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart
				width={100}
				height={100}
				data={[{ name: "A", value1: -100, value2: 200 }]}
				margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
				stackOffset="sign"
			>
				<BarStack stackId="mystackid">
					<Bar dataKey="value1" id="red" />
					<Bar dataKey="value2" id="green" />
					{props.children}
				</BarStack>
				<Bar dataKey="amt" id="blue" />
			</BarChart>
		))

		test("selectStackRects should select edges of all rectangles in this stack", () => {
			const { spy } = renderTestCase((state) => selectStackRects(state, "mystackid", false))
			expectLastCalledWith(spy, [{ height: 75, width: 38, x: 10, y: 25 }])
		})
		test("selectBarRectangles should select rectangles with negative height", () => {
			const { spy } = renderTestCase((state) => selectBarRectangles(state, "red", false, undefined))
			expectLastCalledWith(spy, [
				expect.objectContaining({
					height: -25,
					value: [0, -100],
					width: 38,
					x: 10,
					y: 100,
				}),
			])
		})
		test("selectBarRectangles should select rectangles with positive height", () => {
			const { spy } = renderTestCase((state) =>
				selectBarRectangles(state, "green", false, undefined),
			)
			expectLastCalledWith(spy, [
				expect.objectContaining({
					height: 50,
					value: [0, 200],
					width: 38,
					x: 10,
					y: 25,
				}),
			])
		})
	})
	describe("with sparse BarStack data after zero-dimension filtering", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart
				width={200}
				height={200}
				data={[
					{ name: "A", value1: 0, value2: 0 },
					{ name: "B", value1: 10, value2: 20 },
				]}
			>
				<BarStack stackId="sparse">
					<Bar dataKey="value1" id="bar-one" isAnimationActive={false} />
					<Bar dataKey="value2" id="bar-two" isAnimationActive={false} />
					{props.children}
				</BarStack>
			</BarChart>
		))

		test("selectStackRects should preserve original data indices when combining filtered bars", () => {
			let stackRects: ReadonlyArray<BarStackItem | undefined> | undefined,
				firstRects: ReadonlyArray<BarRectangleItem> | undefined,
				secondRects: ReadonlyArray<BarRectangleItem> | undefined

			renderTestCase((state) => {
				stackRects = selectStackRects(state, "sparse", false)
				firstRects = selectBarRectangles(state, "bar-one", false, undefined)
				secondRects = selectBarRectangles(state, "bar-two", false, undefined)
			})

			assertNotNull(stackRects)
			assertNotNull(firstRects)
			assertNotNull(secondRects)

			expect(firstRects).toHaveLength(1)
			expect(secondRects).toHaveLength(1)
			expect(firstRects[0]).toEqual(expect.objectContaining({ originalDataIndex: 1 }))
			expect(secondRects[0]).toEqual(expect.objectContaining({ originalDataIndex: 1 }))

			expect(stackRects).toHaveLength(2)
			expect(stackRects?.[0]).toBeUndefined()
			expect(stackRects?.[1]).toEqual(expandRectangle(firstRects[0], secondRects[0]))
		})
	})


	describe("expandRectangle", () => {
		it("should return undefined if both rectangles are undefined", () => {
			const result = expandRectangle(undefined, undefined)
			expect(result).toBeUndefined()
		})
		it("should return the other rectangle if one is undefined", () => {
			const rect1 = { height: 10, width: 10, x: 0, y: 0 }
			const result1 = expandRectangle(rect1, undefined)
			expect(result1).toEqual(rect1)

			const rect2 = { height: 15, width: 15, x: 5, y: 5 }
			const result2 = expandRectangle(undefined, rect2)
			expect(result2).toEqual(rect2)
		})
		it("should expand two rectangles that are touching each other", () => {
			const rect1 = { height: 10, width: 25, x: 5, y: 0 }
			const rect2 = { height: 15, width: 20, x: 2, y: 10 }
			const result = expandRectangle(rect1, rect2)
			/*
			 * The resulting rectangle should start at (min x of both) and (min y of both)
			 * and should have width that both rectangles fit inside,
			 * and height that both rectangles fit inside.
			 *
			 * First rectangle width:
			 * from x=5 to x=30 (5 + 25)
			 *
			 * Second rectangle width:
			 * from x=2 to x=22 (2 + 20)
			 *
			 * First rectangle height:
			 * from y=0 to y=10 (0 + 10)
			 *
			 * Second rectangle height:
			 * from y=10 to y=25 (10 + 15)
			 */
			expect(result).toEqual({ height: 25, width: 28, x: 2, y: 0 })
		})
		it("should expand two rectangles that have a gap between them", () => {
			const rect1 = { height: 10, width: 10, x: 5, y: 0 }
			const rect2 = { height: 10, width: 10, x: 20, y: 15 }
			const result = expandRectangle(rect1, rect2)
			/*
			 * The resulting rectangle should start at (min x of both) and (min y of both)
			 * and should have width that both rectangles fit inside,
			 * and height that both rectangles fit inside.
			 *
			 * First rectangle width:
			 * from x=5 to x=15 (5 + 10)
			 *
			 * Second rectangle width:
			 * from x=20 to x=30 (20 + 10)
			 *
			 * First rectangle height:
			 * from y=0 to y=10 (0 + 10)
			 *
			 * Second rectangle height:
			 * from y=15 to y=25 (15 + 10)
			 */
			expect(result).toEqual({ height: 25, width: 25, x: 5, y: 0 })
		})
		it("should expand two overlapping rectangles", () => {
			const rect1 = { height: 20, width: 20, x: 5, y: 5 }
			const rect2 = { height: 20, width: 20, x: 15, y: 15 }
			const result = expandRectangle(rect1, rect2)
			/*
			 * The resulting rectangle should start at (min x of both) and (min y of both)
			 * and should have width that both rectangles fit inside,
			 * and height that both rectangles fit inside.
			 *
			 * First rectangle width:
			 * from x=5 to x=25 (5 + 20)
			 *
			 * Second rectangle width:
			 * from x=15 to x=35 (15 + 20)
			 *
			 * First rectangle height:
			 * from y=5 to y=25 (5 + 20)
			 *
			 * Second rectangle height:
			 * from y=15 to y=35 (15 + 20)
			 */
			expect(result).toEqual({ height: 30, width: 30, x: 5, y: 5 })
		})
		it("should expand rectangles with negative height", () => {
			const rect1 = { height: -25, width: 60, x: 10, y: 100 }
			/*
			 * With stackOffset=sign, height can be negative, that means the bar goes down from YAxis zero.
			 * In other words, y is the bottom edge, and height is negative going upwards.
			 */
			const rect2 = { height: 50, width: -50, x: 100, y: 25 }
			const result = expandRectangle(rect1, rect2)
			/*
			 * The resulting rectangle should start at (min x of both) and (min y of both)
			 * and should have width that both rectangles fit inside,
			 * and height that both rectangles fit inside.
			 *
			 * First rectangle width:
			 * from x=10 to x=70 (10 + 60)
			 *
			 * Second rectangle width:
			 * from x=50 (100 - 50) to x=100
			 *
			 * Total width: 10 -> 100 = 90
			 *
			 * First rectangle height:
			 * from y=75 (100 - 25) to y=100
			 *
			 * Second rectangle height:
			 * from y=25 to y=75 (25 + 50)
			 *
			 * Total height: 25 -> 100 = 75
			 */
			expect(result).toEqual({ height: 75, width: 90, x: 10, y: 25 })
		})
	})
})
