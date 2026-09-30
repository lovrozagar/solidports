import { describe, expect, it } from "vitest"
import { selectScatterPoints } from "../../../src/state/selectors/scatterSelectors"
import { Pie, PieChart, Scatter, ScatterChart } from "../../../src"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import { RechartsRootState } from "../../../src/state/store"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { pageData } from "../../_data"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"

describe("selectScatterPoints", () => {
	const selector = (state: RechartsRootState) => {
		return selectScatterPoints(state, 0, 0, 0, "scatter-id", undefined, false)
	}

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, undefined)

	describe("in a chart that does not support Scatter", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<PieChart width={100} height={200}>
				<Pie
					data={pageData}
					dataKey="uv"
					isAnimationActive={false}
					cx="50%"
					cy="50%"
					outerRadius={80}
				/>
				{props.children}
			</PieChart>
		))

		it("should return undefined", async () => {
			const { spy } = renderTestCase(selector)
			expect(spy).toHaveBeenCalledWith(undefined)
			expect(spy).toHaveBeenCalledTimes(1)
		})
	})
	describe("when data is defined on Scatter child", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<ScatterChart width={100} height={200}>
				<Scatter data={pageData} dataKey="uv" id="scatter-id" />
				{props.children}
			</ScatterChart>
		))

		it("should return computed scatter points", () => {
			const { spy } = renderTestCase(selector)
			// this really should be ReadonlyArray<ScatterPointItem> but because Scatter expands all properties of everything, the type does not really match the object.
			const expectedPoints: ReadonlyArray<any> = [
				{
					amt: 1400,
					cx: 11.428571428571429,
					cy: 124.9375,
					height: 9.0270333367641,
					name: "Page A",
					node: {
						x: 590,
						y: 590,
						z: "-",
					},
					payload: {
						amt: 1400,
						name: "Page A",
						pv: 800,
						uv: 590,
					},
					pv: 800,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1400,
								name: "Page A",
								pv: 800,
								uv: 590,
							},
							unit: "",
							value: 590,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1400,
								name: "Page A",
								pv: 800,
								uv: 590,
							},
							unit: "",
							value: 590,
						},
					],
					tooltipPosition: {
						x: 11.428571428571429,
						y: 124.9375,
					},
					uv: 590,
					width: 9.0270333367641,
					x: 6.915054760189379,
					y: 120.42398333161795,
				},
				{
					amt: 1400,
					cx: 24.285714285714285,
					cy: 124.9375,
					height: 9.0270333367641,
					name: "Page B",
					node: {
						x: 590,
						y: 590,
						z: "-",
					},
					payload: {
						amt: 1400,
						name: "Page B",
						pv: 800,
						uv: 590,
					},
					pv: 800,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1400,
								name: "Page B",
								pv: 800,
								uv: 590,
							},
							unit: "",
							value: 590,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1400,
								name: "Page B",
								pv: 800,
								uv: 590,
							},
							unit: "",
							value: 590,
						},
					],
					tooltipPosition: {
						x: 24.285714285714285,
						y: 124.9375,
					},
					uv: 590,
					width: 9.0270333367641,
					x: 19.772197617332235,
					y: 120.42398333161795,
				},
				{
					amt: 1506,
					cx: 37.142857142857146,
					cy: 91.92500000000001,
					height: 9.0270333367641,
					name: "Page C",
					node: {
						x: 868,
						y: 868,
						z: "-",
					},
					payload: {
						amt: 1506,
						name: "Page C",
						pv: 967,
						uv: 868,
					},
					pv: 967,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1506,
								name: "Page C",
								pv: 967,
								uv: 868,
							},
							unit: "",
							value: 868,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1506,
								name: "Page C",
								pv: 967,
								uv: 868,
							},
							unit: "",
							value: 868,
						},
					],
					tooltipPosition: {
						x: 37.142857142857146,
						y: 91.92500000000001,
					},
					uv: 868,
					width: 9.0270333367641,
					x: 32.62934047447509,
					y: 87.41148333161796,
				},
				{
					amt: 989,
					cx: 50,
					cy: 29.106249999999992,
					height: 9.0270333367641,
					name: "Page D",
					node: {
						x: 1397,
						y: 1397,
						z: "-",
					},
					payload: {
						amt: 989,
						name: "Page D",
						pv: 1098,
						uv: 1397,
					},
					pv: 1098,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 989,
								name: "Page D",
								pv: 1098,
								uv: 1397,
							},
							unit: "",
							value: 1397,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 989,
								name: "Page D",
								pv: 1098,
								uv: 1397,
							},
							unit: "",
							value: 1397,
						},
					],
					tooltipPosition: {
						x: 50,
						y: 29.106249999999992,
					},
					uv: 1397,
					width: 9.0270333367641,
					x: 45.48648333161795,
					y: 24.592733331617943,
				},
				{
					amt: 1228,
					cx: 62.85714285714286,
					cy: 19.249999999999993,
					height: 9.0270333367641,
					name: "Page E",
					node: {
						x: 1480,
						y: 1480,
						z: "-",
					},
					payload: {
						amt: 1228,
						name: "Page E",
						pv: 1200,
						uv: 1480,
					},
					pv: 1200,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1228,
								name: "Page E",
								pv: 1200,
								uv: 1480,
							},
							unit: "",
							value: 1480,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1228,
								name: "Page E",
								pv: 1200,
								uv: 1480,
							},
							unit: "",
							value: 1480,
						},
					],
					tooltipPosition: {
						x: 62.85714285714286,
						y: 19.249999999999993,
					},
					uv: 1480,
					width: 9.0270333367641,
					x: 58.34362618876081,
					y: 14.736483331617944,
				},
				{
					amt: 1100,
					cx: 75.71428571428572,
					cy: 14.500000000000009,
					height: 9.0270333367641,
					name: "Page F",
					node: {
						x: 1520,
						y: 1520,
						z: "-",
					},
					payload: {
						amt: 1100,
						name: "Page F",
						pv: 1108,
						uv: 1520,
					},
					pv: 1108,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1100,
								name: "Page F",
								pv: 1108,
								uv: 1520,
							},
							unit: "",
							value: 1520,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1100,
								name: "Page F",
								pv: 1108,
								uv: 1520,
							},
							unit: "",
							value: 1520,
						},
					],
					tooltipPosition: {
						x: 75.71428571428572,
						y: 14.500000000000009,
					},
					uv: 1520,
					width: 9.0270333367641,
					x: 71.20076904590367,
					y: 9.986483331617958,
				},
				{
					amt: 1700,
					cx: 88.57142857142857,
					cy: 28.75,
					height: 9.0270333367641,
					name: "Page G",
					node: {
						x: 1400,
						y: 1400,
						z: "-",
					},
					payload: {
						amt: 1700,
						name: "Page G",
						pv: 680,
						uv: 1400,
					},
					pv: 680,
					size: 64,
					tooltipPayload: [
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1700,
								name: "Page G",
								pv: 680,
								uv: 1400,
							},
							unit: "",
							value: 1400,
						},
						{
							dataKey: "uv",
							graphicalItemId: "scatter-id",
							payload: {
								amt: 1700,
								name: "Page G",
								pv: 680,
								uv: 1400,
							},
							unit: "",
							value: 1400,
						},
					],
					tooltipPosition: {
						x: 88.57142857142857,
						y: 28.75,
					},
					uv: 1400,
					width: 9.0270333367641,
					x: 84.05791190304652,
					y: 24.23648333161795,
				},
			]
			expect(spy).toHaveBeenCalledTimes(2)
			expectLastCalledWith(spy, expectedPoints)
		})
	})
})
