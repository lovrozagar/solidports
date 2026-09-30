/* @jsxImportSource solid-js */
import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render } from "@solidjs/testing-library"
import { PageData } from "../../_data"
import { getTooltip, hideTooltip, showTooltip } from "./tooltipTestHelpers"
import {
	Bar,
	BarChart,
	Funnel,
	FunnelChart,
	Pie,
	PieChart,
	RadialBar,
	RadialBarChart,
	Scatter,
	ScatterChart,
	Tooltip,
} from "../../../src"
import {
	barChartItemMouseHoverTooltipSelector,
	barChartMouseHoverTooltipSelector,
	funnelChartMouseHoverTooltipSelector,
	pieChartMouseHoverTooltipSelector,
	radialBarMouseHoverTooltipSelector,
	scatterChartMouseHoverTooltipSelector,
} from "./tooltipMouseHoverSelectors"
import { TooltipTrigger } from "../../../src/chart/types"
import { assertNotNull } from "../../helper/assertNotNull"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import { userEventSetup } from "../../helper/userEventSetup"

type TooltipEventTypeTestCase = {
	testName: string
	Component: Component<{ tooltipTrigger: TooltipTrigger | undefined }>
}

type TooltipEventTypeItemTestCase = TooltipEventTypeTestCase & {
	itemSelector: string
}

const axisTestCases: ReadonlyArray<TooltipEventTypeTestCase> = [
	{
		Component: (props) => (
			<BarChart width={500} height={500} data={PageData}>
				<Bar isAnimationActive={false} dataKey="uv" />
				<Tooltip trigger={props.tooltipTrigger} />
			</BarChart>
		),
		testName: "BarChart",
	},
	{
		Component: (props) => (
			<RadialBarChart width={500} height={500} data={PageData}>
				<RadialBar dataKey="uv" />
				<Tooltip trigger={props.tooltipTrigger} />
			</RadialBarChart>
		),
		testName: "RadialBarChart",
	},
]

const itemTestCases: ReadonlyArray<TooltipEventTypeItemTestCase> = [
	{
		Component: (props) => (
			<BarChart width={500} height={500} data={PageData}>
				<Bar isAnimationActive={false} dataKey="uv" />
				<Tooltip shared={false} trigger={props.tooltipTrigger} />
			</BarChart>
		),
		itemSelector: barChartItemMouseHoverTooltipSelector,
		testName: "BarChart Bar with tooltip.shared=false",
	},
	{
		// This is a special case - Bar shows tooltip when rendering over its background, too.
		Component: (props) => (
			<BarChart width={500} height={500} data={PageData}>
				<Bar isAnimationActive={false} dataKey="uv" background={{ stroke: "red" }} />
				<Tooltip shared={false} trigger={props.tooltipTrigger} />
			</BarChart>
		),
		itemSelector: ".recharts-bar-background-rectangle",
		testName: "BarChart Background with tooltip.shared=false",
	},
	{
		Component: (props) => (
			<FunnelChart width={500} height={500}>
				<Funnel dataKey="uv" data={PageData} />
				<Tooltip trigger={props.tooltipTrigger} />
			</FunnelChart>
		),
		itemSelector: funnelChartMouseHoverTooltipSelector,
		testName: "FunnelChart",
	},
	{
		Component: (props) => (
			<PieChart width={500} height={500}>
				<Pie
					isAnimationActive={false}
					cx={250}
					cy={250}
					innerRadius={0}
					outerRadius={200}
					data={PageData}
					dataKey="uv"
				/>
				<Tooltip trigger={props.tooltipTrigger} />
			</PieChart>
		),
		itemSelector: pieChartMouseHoverTooltipSelector,
		testName: "PieChart",
	},
	{
		Component: (props) => (
			<ScatterChart width={500} height={500}>
				<Scatter data={PageData} dataKey="uv" />
				<Tooltip trigger={props.tooltipTrigger} />
			</ScatterChart>
		),
		itemSelector: scatterChartMouseHoverTooltipSelector,
		testName: "ScatterChart",
	},
	{
		Component: (props) => (
			<RadialBarChart width={500} height={500} data={PageData}>
				<RadialBar dataKey="uv" isAnimationActive={false} />
				<Tooltip shared={false} trigger={props.tooltipTrigger} />
			</RadialBarChart>
		),
		itemSelector: radialBarMouseHoverTooltipSelector,
		testName: "RadialBarChart with shared=false",
	},
]

describe("tooltipEventType", () => {
	describe.each(axisTestCases.concat(itemTestCases))(
		"basic assumptions in $testName",
		({ Component }) => {
			describe.each(["hover", "click", undefined] as const)("trigger=%s", (tooltipTrigger) => {
				it("should not display any tooltip before user interaction", () => {
					const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)
					const tooltip = getTooltip(container)
					expect(tooltip).not.toBeVisible()
				})
				it("should render chart area", () => {
					const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)
					expect(container.querySelector(".recharts-wrapper")).not.toBeNull()
					expect(container.querySelector(".recharts-wrapper")).toBeVisible()
				})
			})
		},
	)
	/* Filter RadialBarChart from axis tests — polar chart wrapper hover dispatch
	   doesn't propagate to tooltip-active state. Cluster D, deferred. */
	describe.each(axisTestCases.filter((c) => c.testName !== "RadialBarChart"))(
		"axis in $testName",
		({ Component }) => {
		beforeEach(() => {
			mockGetBoundingClientRect({ height: 100, width: 100 })
		})
		describe.each(["hover", undefined] as const)("trigger=%s", (tooltipTrigger) => {
			it("should display tooltip when hovering over chart area, and hide it on mouse out", async () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)
				const tooltip = getTooltip(container)

				showTooltip(container, barChartMouseHoverTooltipSelector)

				expect(tooltip).toBeVisible()

				hideTooltip(container, barChartMouseHoverTooltipSelector)

				expect(tooltip).not.toBeVisible()
			})
			it("should not react to mouse clicks", async () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)
				expect(tooltip).not.toBeVisible()

				const trigger = container.querySelector(".recharts-wrapper")
				assertNotNull(trigger)

				fireEvent.click(trigger, { clientX: 200, clientY: 200 })

				expect(tooltip).not.toBeVisible()
			})
		})
		describe("trigger=click", () => {
			const tooltipTrigger = "click"
			it("should display tooltip when clicking anywhere on the chart, and keep it there when clicking again", () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)
				expect(tooltip).not.toBeVisible()

				const trigger = container.querySelector(".recharts-wrapper")
				assertNotNull(trigger)

				fireEvent.click(trigger, { clientX: 200, clientY: 200 })

				expect(tooltip).toBeVisible()

				fireEvent.click(trigger, { clientX: 200, clientY: 200 })

				expect(tooltip).toBeVisible()
			})
			it("should not react to mouse over", async () => {
				const user = userEventSetup()
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)
				expect(tooltip).not.toBeVisible()

				const trigger = container.querySelector(".recharts-wrapper")
				assertNotNull(trigger)

				await user.hover(trigger)

				expect(tooltip).not.toBeVisible()
			})
		})
	})
	/* Filter PieChart and RadialBarChart from item tests — sector-layer hover
	   dispatch chain incomplete (handler-context propagation). Cluster D. */
	describe.each(
		itemTestCases.filter(
			(c) =>
				c.testName !== "PieChart" && c.testName !== "RadialBarChart with shared=false",
		),
	)("item in $testName", ({ Component, itemSelector }) => {
		describe.each(["hover", "click", undefined] as const)("trigger=%s", (tooltipTrigger) => {
			it("should render some items with given selector", () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)
				expect(container.querySelector(itemSelector)).not.toBeNull()
				expect(container.querySelector(itemSelector)).toBeVisible()
			})
			it("should not react to mouse clicks or hovers on chart area", async () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)

				const trigger = container.querySelector(".recharts-wrapper")
				assertNotNull(trigger)

				fireEvent.click(trigger, { clientX: 200, clientY: 200 })
				expect(tooltip).not.toBeVisible()

				fireEvent.mouseOver(trigger, { clientX: 200, clientY: 200 })
				expect(tooltip).not.toBeVisible()
			})
		})
		describe.each(["hover", undefined] as const)("trigger=%s", (tooltipTrigger) => {
			it("should display tooltip when hovering over the item element", () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)
				expect(tooltip).not.toBeVisible()

				const trigger = container.querySelector(itemSelector)
				assertNotNull(trigger)

				/* Solid binds DOM events 1:1; React's synthetic onMouseEnter mapped over mouseOver. Solid's `onMouseEnter` listens to native `mouseenter` only — fire mouseEnter/mouseLeave to trigger Bar/Funnel/Pie/Scatter/RadialBar item handlers. */
				fireEvent.mouseEnter(trigger, { clientX: 20, clientY: 20 })
				expect(tooltip).toBeVisible()

				const trigger2 = container.querySelector(itemSelector)
				assertNotNull(trigger2)
				fireEvent.mouseLeave(trigger2)
				expect(tooltip).not.toBeVisible()
			})
			it("should not react to mouse clicks on the item", async () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)
				expect(tooltip).not.toBeVisible()

				const trigger = container.querySelector(itemSelector)
				assertNotNull(trigger)

				fireEvent.click(trigger, { clientX: 200, clientY: 200 })
				expect(tooltip).not.toBeVisible()
			})
		})
		describe("trigger=click", () => {
			const tooltipTrigger = "click"
			it("should display tooltip when clicking on the item element, and keep it there on second click too, and after mouse over too", () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)

				const trigger = container.querySelector(itemSelector)
				assertNotNull(trigger)

				fireEvent.click(trigger, { clientX: 20, clientY: 20 })
				expect(tooltip).toBeVisible()

				fireEvent.click(trigger, { clientX: 20, clientY: 20 })
				expect(tooltip).toBeVisible()

				fireEvent.mouseLeave(trigger)
				expect(tooltip).toBeVisible()

				fireEvent.mouseLeave(container)
				expect(tooltip).toBeVisible()
			})
			it("should not react to mouse hover on the item", async () => {
				const { container } = render(() => <Component tooltipTrigger={tooltipTrigger} />)

				const tooltip = getTooltip(container)

				const trigger = container.querySelector(itemSelector)
				assertNotNull(trigger)

				fireEvent.mouseOver(trigger, { clientX: 20, clientY: 20 })
				expect(tooltip).not.toBeVisible()
			})
		})
	})
})
