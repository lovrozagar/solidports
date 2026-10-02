/* @jsxImportSource @solidjs/web */
import type { JSX } from '@solidjs/web';
import { beforeEach, describe, expect, it, type Mock } from "vitest"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { PageData } from "../../_data"
import { Area, AreaChart, Tooltip, type TooltipContentProps } from "../../../src"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { showTooltip } from "./tooltipTestHelpers"
import { areaChartMouseHoverTooltipSelector } from "./tooltipMouseHoverSelectors"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"

const commonChartProps = {
	height: 400,
	width: 400,
}

describe("Tooltip.content", () => {
	const spy: Mock<(props: TooltipContentProps) => JSX.Element> = vi.fn()

	/* hoisted from beforeEach. */
	const renderTestCase = createSelectorTestCase((props: { children: any }) => (
		<AreaChart {...commonChartProps} data={PageData}>
			<Area dataKey="uv" unit="kg" id="area-uv" />
			<Area dataKey="pv" unit="$$$" name="My custom name" id="area-pv" />
			<Area dataKey="amt" id="area-amt" />
			<Tooltip content={spy} />
			{props.children}
		</AreaChart>
	))

	beforeEach(() => {
		mockGetBoundingClientRect({ height: 100, width: 100 })
		spy.mockClear()
	})
	it("should be called and receive payload before any user interactions", () => {
		expect(spy).toHaveBeenCalledTimes(0)
		renderTestCase()
		/* Solid renders the content once at mount; upstream renders twice */
		expect(spy).toHaveBeenCalledTimes(1)
		expectLastCalledWith(
			spy,
			{
				accessibilityLayer: true,
				active: false,
				activeIndex: null,
				allowEscapeViewBox: {
					x: false,
					y: false,
				},
				animationDuration: 400,
				animationEasing: "ease",
				axisId: 0,
				content: spy,
				contentStyle: {},
				coordinate: undefined,
				cursor: true,
				filterNull: true,
				includeHidden: false,
				isAnimationActive: "auto",
				itemSorter: "name",
				itemStyle: {},
				label: undefined,
				labelStyle: {},
				offset: 10,
				payload: [],
				reverseDirection: {
					x: false,
					y: false,
				},
				separator: " : ",
				trigger: "hover",
				useTranslate3d: false,
				wrapperStyle: {},
			},
			/* Solid components receive props only; upstream also asserts React's second arg */
		)
	})
	it("should be called and receive payload on hover", () => {
		const { container, debug } = renderTestCase()
		showTooltip(container, areaChartMouseHoverTooltipSelector, debug)
		/* one fewer mount render than upstream (3) */
		expect(spy).toHaveBeenCalledTimes(2)
		expectLastCalledWith(
			spy,
			{
				accessibilityLayer: true,
				active: true,
				activeIndex: "2",
				allowEscapeViewBox: {
					x: false,
					y: false,
				},
				animationDuration: 400,
				animationEasing: "ease",
				axisId: 0,
				content: spy,
				contentStyle: {},
				coordinate: {
					x: 161,
					y: 200,
				},
				cursor: true,
				filterNull: true,
				includeHidden: false,
				isAnimationActive: "auto",
				itemSorter: "name",
				itemStyle: {},
				label: 2,
				labelStyle: {},
				offset: 10,
				payload: [
					{
						color: "#3182bd",
						dataKey: "uv",
						fill: "#3182bd",
						graphicalItemId: "area-uv",
						hide: false,
						name: "uv",
						nameKey: undefined,
						payload: {
							amt: 2400,
							name: "Page C",
							pv: 1398,
							uv: 300,
						},
						stroke: "#3182bd",
						strokeWidth: 1,
						type: undefined,
						unit: "kg",
						value: 300,
					},
					{
						color: "#3182bd",
						dataKey: "pv",
						fill: "#3182bd",
						graphicalItemId: "area-pv",
						hide: false,
						name: "My custom name",
						nameKey: undefined,
						payload: {
							amt: 2400,
							name: "Page C",
							pv: 1398,
							uv: 300,
						},
						stroke: "#3182bd",
						strokeWidth: 1,
						type: undefined,
						unit: "$$$",
						value: 1398,
					},
					{
						color: "#3182bd",
						dataKey: "amt",
						fill: "#3182bd",
						graphicalItemId: "area-amt",
						hide: false,
						name: "amt",
						nameKey: undefined,
						payload: {
							amt: 2400,
							name: "Page C",
							pv: 1398,
							uv: 300,
						},
						stroke: "#3182bd",
						strokeWidth: 1,
						type: undefined,
						unit: undefined,
						value: 2400,
					},
				],
				reverseDirection: {
					x: false,
					y: false,
				},
				separator: " : ",
				trigger: "hover",
				useTranslate3d: false,
				wrapperStyle: {},
			},
			/* Solid components receive props only; upstream also asserts React's second arg */
		)
	})
})
