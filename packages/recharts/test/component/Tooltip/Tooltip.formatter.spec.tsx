/* @jsxImportSource @solidjs/web */
import { describe, it, beforeEach } from "vitest"
import { BarChart, YAxis, XAxis, Tooltip, Bar } from "../../../src"
import { PageData } from "../../_data"
import { expectTooltipNotVisible, expectTooltipPayload, showTooltip } from "./tooltipTestHelpers"
import { barChartMouseHoverTooltipSelector } from "./tooltipMouseHoverSelectors"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { selectTooltipPayload } from "../../../src/state/selectors/selectors"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"

/* hoisted from beforeEach. */
const dataKeyAsFunction = (x: any) => x.pv

describe("Tooltip.formatter reproducing https://github.com/recharts/recharts/issues/5658", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
	})
	describe("with a name prop", () => {
		const renderTestCase = createSelectorTestCase((props: { children: any }) => (
			<BarChart
				width={500}
				height={300}
				data={PageData}
				margin={{
					bottom: 5,
					left: 20,
					right: 30,
					top: 5,
				}}
			>
				<XAxis dataKey="name" />
				<YAxis />
				<Tooltip formatter={() => "FORMATTED"} />
				<Bar dataKey={dataKeyAsFunction} name="ultraviolet" fill="#8884d8" id="bar-with-function" />
				<Bar dataKey="pv" fill="#8ff4d8" id="bar-pv" />
				{props.children}
			</BarChart>
		))

		it("should render inside tooltip value what the formatter returned", () => {
			const { container } = renderTestCase()

			expectTooltipNotVisible(container)

			showTooltip(container, barChartMouseHoverTooltipSelector)

			expectTooltipPayload(container, "Page B", ["pv : FORMATTED", "ultraviolet : FORMATTED"])
		})
		it("should select payload", () => {
			const { spy } = renderTestCase((state) => selectTooltipPayload(state, "axis", "hover", "1"))
			expectLastCalledWith(spy, [
				{
					color: "#8884d8",
					dataKey: dataKeyAsFunction,
					fill: "#8884d8",
					graphicalItemId: "bar-with-function",
					hide: false,
					name: "ultraviolet",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: undefined,
					strokeWidth: undefined,
					type: undefined,
					unit: undefined,
					value: 4567,
				},
				{
					color: "#8ff4d8",
					dataKey: "pv",
					fill: "#8ff4d8",
					graphicalItemId: "bar-pv",
					hide: false,
					name: "pv",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: undefined,
					strokeWidth: undefined,
					type: undefined,
					unit: undefined,
					value: 4567,
				},
			])
		})
	})
	describe("without name prop", () => {
		const renderTestCase = createSelectorTestCase((props: { children: any }) => (
			<BarChart
				width={500}
				height={300}
				data={PageData}
				margin={{
					bottom: 5,
					left: 20,
					right: 30,
					top: 5,
				}}
			>
				<XAxis dataKey="name" />
				<YAxis />
				<Tooltip formatter={() => "FORMATTED"} />
				<Bar dataKey={dataKeyAsFunction} fill="#8884d8" id="bar-with-function" />
				<Bar dataKey="pv" fill="#8ff4d8" id="bar-pv" />
				{props.children}
			</BarChart>
		))

		it("should render inside tooltip value what the formatter returned", () => {
			const { container } = renderTestCase()

			expectTooltipNotVisible(container)

			showTooltip(container, barChartMouseHoverTooltipSelector)

			expectTooltipPayload(container, "Page B", ["pv : FORMATTED", "FORMATTED"])
		})
		it("should select payload", () => {
			const { spy } = renderTestCase((state) => selectTooltipPayload(state, "axis", "hover", "1"))
			expectLastCalledWith(spy, [
				{
					color: "#8884d8",
					dataKey: dataKeyAsFunction,
					fill: "#8884d8",
					graphicalItemId: "bar-with-function",
					hide: false,
					name: undefined,
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: undefined,
					strokeWidth: undefined,
					type: undefined,
					unit: undefined,
					value: 4567,
				},
				{
					color: "#8ff4d8",
					dataKey: "pv",
					fill: "#8ff4d8",
					graphicalItemId: "bar-pv",
					hide: false,
					name: "pv",
					nameKey: undefined,
					payload: {
						amt: 2400,
						name: "Page B",
						pv: 4567,
						uv: 300,
					},
					stroke: undefined,
					strokeWidth: undefined,
					type: undefined,
					unit: undefined,
					value: 4567,
				},
			])
		})
	})
})
