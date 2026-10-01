/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import {
	Cursor,
	type CursorConnectedProps,
	CursorInternal,
	type CursorProps,
} from "../../src/component/Cursor"
import { assertNotNull } from "../helper/assertNotNull"
import type { ChartState } from "../../src/state/store"
import { RechartsStoreProvider } from "../../src/state/RechartsStoreProvider"
import { arrayTooltipSearcher } from "../../src/state/optionsSlice"
import { produceState } from "../helper/produceState"
import { emptyOffset } from "../helper/offsetHelpers"
import type { TooltipPayload } from "../../src/state/tooltipSlice"

const defaultProps: CursorProps = {
	coordinate: undefined,
	cursor: true,
	index: "0",
	payload: [],
	tooltipEventType: "axis",
}

const baseCoord = {
	x: 0,
	y: 0,
}

const connectedProps: CursorConnectedProps = {
	chartName: "",
	layout: "vertical",
	offset: emptyOffset,
	tooltipAxisBandSize: 0,
	...defaultProps,
}

const preloadedState: Partial<ChartState> = {
	options: {
		chartName: "",
		defaultTooltipEventType: "axis",
		eventEmitter: undefined,
		tooltipPayloadSearcher: arrayTooltipSearcher,
	},
}

const preloadedRadialState: Partial<ChartState> = produceState((draft) => {
	draft.layout.layoutType = "radial"
	draft.layout.margin = { bottom: 33, left: 4, right: 22, top: 11 }
	draft.tooltip.itemInteraction.hover.active = true
})

const preloadedScatterState: Partial<ChartState> = produceState((draft) => {
	draft.options.chartName = "ScatterChart"
	draft.options.tooltipPayloadSearcher = arrayTooltipSearcher
	draft.tooltip.itemInteraction.hover.active = true
})

describe("Cursor", () => {
	describe("Internal component", () => {
		it("should render a custom cursor", () => {
			function MyCustomCursor() {
				return <p>I am a cursor.</p>
			}
			const { getByText } = render(() => (
				<svg width={100} height={100}>
					<CursorInternal
						{...connectedProps}
						coordinate={baseCoord}
						cursor={<MyCustomCursor />}
					/>
				</svg>
			))
			expect(getByText("I am a cursor.")).toBeVisible()
		})

		it("should render rectangle cursor for bar chart", () => {
			const props: CursorConnectedProps = {
				layout: "horizontal",
				...defaultProps,
				tooltipAxisBandSize: 1,
				chartName: "BarChart",
				offset: emptyOffset,
				coordinate: baseCoord,
			}
			const { container } = render(() => (
				<svg width={100} height={100}>
					<CursorInternal {...props} />
				</svg>
			))
			const cursor = container.querySelector(".recharts-rectangle")
			assertNotNull(cursor)
			expect(cursor).toBeVisible()
		})

		it("should render sector cursor for radial layout charts", () => {
			const coordinate = { endAngle: 2, radius: 1, startAngle: 1, x: 0, y: 0 }
			const props: CursorConnectedProps = {
				chartName: "",
				offset: emptyOffset,
				tooltipAxisBandSize: 0,
				...defaultProps,
				layout: "radial",
				coordinate: {
					endAngle: 2,
					radius: 1,
					startAngle: 1,
					x: 0,
					y: 0,
				},
			}
			const { container } = render(() => (
				<svg width={100} height={100}>
					<CursorInternal {...props} coordinate={coordinate} zIndex={0} />
				</svg>
			))
			const cursor = container.querySelector(".recharts-sector")
			assertNotNull(cursor)
			expect(cursor).toBeVisible()
		})
	})

	describe("Connected component", () => {
		it("should render curve cursor by default", () => {
			const { container } = render(() => (
				<RechartsStoreProvider preloadedState={preloadedState}>
					<svg width={100} height={100}>
						<Cursor {...defaultProps} coordinate={baseCoord} zIndex={0} />
					</svg>
				</RechartsStoreProvider>
			))
			const cursor = container.querySelector(".recharts-curve")
			assertNotNull(cursor)
			expect(cursor).toBeVisible()
		})

		it("should render a custom cursor", () => {
			function MyCustomCursor() {
				return <p>I am a cursor.</p>
			}
			const { getByText } = render(() => (
				<RechartsStoreProvider preloadedState={preloadedState}>
					<svg width={100} height={100}>
						<Cursor
							{...defaultProps}
							coordinate={baseCoord}
							cursor={<MyCustomCursor />}
							zIndex={0}
						/>
					</svg>
				</RechartsStoreProvider>
			))
			expect(getByText("I am a cursor.")).toBeVisible()
		})

		it("should render cross cursor for scatter chart", () => {
			const { container } = render(() => (
				<RechartsStoreProvider preloadedState={preloadedScatterState}>
					<svg width={100} height={100}>
						<Cursor {...defaultProps} coordinate={baseCoord} zIndex={0} />
					</svg>
				</RechartsStoreProvider>
			))
			const cursor = container.querySelector(".recharts-cross")
			assertNotNull(cursor)
			expect(cursor).toBeVisible()
		})

		it("should render sector cursor for radial layout charts", () => {
			const coordinate = { endAngle: 2, radius: 1, startAngle: 1, x: 0, y: 0 }
			const payload: TooltipPayload = [{ graphicalItemId: "foo", name: "test", value: "test" }]
			const { container } = render(() => (
				<RechartsStoreProvider preloadedState={preloadedRadialState}>
					<svg width={100} height={100}>
						<Cursor {...defaultProps} coordinate={coordinate} payload={payload} zIndex={0} />
					</svg>
				</RechartsStoreProvider>
			))
			const cursor = container.querySelector(".recharts-sector")
			assertNotNull(cursor)
			expect(cursor).toBeVisible()
		})
	})
})
