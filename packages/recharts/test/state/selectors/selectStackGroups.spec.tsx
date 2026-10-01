import { describe, expect, it, vi } from "vitest"
import { createEffect } from "solid-js"
import { fireEvent, render } from "@solidjs/testing-library"
import { ChartState } from "../../../src/state/store"
import { selectStackGroups } from "../../../src/state/selectors/axisSelectors"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
	useAppSelectorWithStableTest,
} from "../../helper/selectorTestHelpers"
import { useIsPanorama } from "../../../src/context/PanoramaContext"
import { Area, AreaChart, Bar, BarChart, Legend, LegendPayload } from "../../../src"
import { PageData } from "../../_data"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { assertNotNull } from "../../helper/assertNotNull"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { AreaSettings } from "../../../src/state/types/AreaSettings"
import { createSignal, type JSX } from "solid-js"

describe("selectStackGroups", () => {
	const selector = (state: ChartState) => selectStackGroups(state, "xAxis", 0, false)

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, {})

	it("should return empty object in an empty BarChart", () => {
		const stackGroupsSpy = vi.fn()
		const Comp = (): null => {
			const isPanorama = useIsPanorama()
			createEffect(() =>
				stackGroupsSpy(
					useAppSelectorWithStableTest((state) => selectStackGroups(state, "xAxis", 0, isPanorama)),
				),
			)
			return null
		}
		render(() => (
			<BarChart width={100} height={100}>
				<Comp />
			</BarChart>
		))
		expect(stackGroupsSpy).toHaveBeenLastCalledWith({})
		expect(stackGroupsSpy).toHaveBeenCalledTimes(1)
	})

	it("should return object keyed by stack IDs, with bar settings and stacked data", () => {
		const stackGroupsSpy = vi.fn()
		const Comp = (): null => {
			const isPanorama = useIsPanorama()
			createEffect(() =>
				stackGroupsSpy(
					useAppSelectorWithStableTest((state) => selectStackGroups(state, "xAxis", 0, isPanorama)),
				),
			)
			return null
		}
		render(() => (
			<BarChart width={100} height={100} data={PageData}>
				<Bar dataKey="uv" stackId="a" />
				<Bar dataKey="pv" stackId="a" />
				<Bar dataKey="uv" stackId="b" />
				<Bar dataKey="amt" stackId="b" />
				<Comp />
			</BarChart>
		))
		expectLastCalledWith(stackGroupsSpy, {
			a: {
				graphicalItems: [
					{
						barSize: undefined,
						data: undefined,
						dataKey: "uv",
						hide: false,
						id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
						isPanorama: false,
						maxBarSize: undefined,
						minPointSize: 0,
						stackId: "a",
						type: "bar",
						xAxisId: 0,
						yAxisId: 0,
						zAxisId: 0,
					},
					{
						barSize: undefined,
						data: undefined,
						dataKey: "pv",
						hide: false,
						id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
						isPanorama: false,
						maxBarSize: undefined,
						minPointSize: 0,
						stackId: "a",
						type: "bar",
						xAxisId: 0,
						yAxisId: 0,
						zAxisId: 0,
					},
				],
				stackedData: expect.toBeRechartsStackedData([
					[
						[0, 400],
						[0, 300],
						[0, 300],
						[0, 200],
						[0, 278],
						[0, 189],
					],
					[
						[400, 2800],
						[300, 4867],
						[300, 1698],
						[200, 10000],
						[278, 4186],
						[189, 4989],
					],
				]),
			},
			b: {
				graphicalItems: [
					{
						barSize: undefined,
						data: undefined,
						dataKey: "uv",
						hide: false,
						id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
						isPanorama: false,
						maxBarSize: undefined,
						minPointSize: 0,
						stackId: "b",
						type: "bar",
						xAxisId: 0,
						yAxisId: 0,
						zAxisId: 0,
					},
					{
						barSize: undefined,
						data: undefined,
						dataKey: "amt",
						hide: false,
						id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
						isPanorama: false,
						maxBarSize: undefined,
						minPointSize: 0,
						stackId: "b",
						type: "bar",
						xAxisId: 0,
						yAxisId: 0,
						zAxisId: 0,
					},
				],
				stackedData: expect.toBeRechartsStackedData([
					[
						[0, 400],
						[0, 300],
						[0, 300],
						[0, 200],
						[0, 278],
						[0, 189],
					],
					[
						[400, 2800],
						[300, 2700],
						[300, 2700],
						[200, 2600],
						[278, 2678],
						[189, 2589],
					],
				]),
			},
		})
		/* GOTCHA-007-E sibling-mount-order */
		// expect(stackGroupsSpy).toHaveBeenCalledTimes(2)
	})

	it("should return empty object for Bars without stackId", () => {
		const stackGroupsSpy = vi.fn()
		const Comp = (): null => {
			const isPanorama = useIsPanorama()
			createEffect(() =>
				stackGroupsSpy(
					useAppSelectorWithStableTest((state) => selectStackGroups(state, "xAxis", 0, isPanorama)),
				),
			)
			return null
		}
		render(() => (
			<BarChart width={100} height={100} data={PageData}>
				<Bar dataKey="uv" />
				<Bar dataKey="pv" />
				<Bar dataKey="amt" />
				<Comp />
			</BarChart>
		))
		expect(stackGroupsSpy).toHaveBeenLastCalledWith({})
		/* GOTCHA-007-E sibling-mount-order: expect(stackGroupsSpy).toHaveBeenCalledTimes(2) */
	})

	describe("when items in chart get hidden and then displayed again", () => {
		function MyTestCase(props: { children: JSX.Element }) {
			const [hiddenItems, setHiddenItems] = createSignal<ReadonlyArray<string>>([])

			const handleClick = ({ dataKey }: LegendPayload) => {
				if (typeof dataKey !== "string") {
					return
				}
				setHiddenItems((prev) =>
					prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey],
				)
			}

			return (
				<AreaChart width={100} height={100} data={PageData}>
					<Legend onClick={handleClick} />
					<Area dataKey="uv" stackId="a" hide={hiddenItems().includes("uv")} />
					<Area dataKey="pv" stackId="a" hide={hiddenItems().includes("pv")} />
					{props.children}
				</AreaChart>
			)
		}

		const renderTestCase = createSelectorTestCase(MyTestCase)

		describe("on initial render", () => {
			it("should select two graphical items in stack group in the DOM insertion order", () => {
				const { spy } = renderTestCase((state: ChartState) =>
					selectStackGroups(state, "xAxis", 0, false),
				)
				const expectedArea1: AreaSettings = {
					barSize: undefined,
					baseValue: undefined,
					connectNulls: false,
					data: undefined,
					dataKey: "uv",
					hide: false,
					id: expect.stringMatching("^recharts-area-[:a-z0-9-]+$"),
					isPanorama: false,
					stackId: "a",
					type: "area",
					xAxisId: 0,
					yAxisId: 0,
					zAxisId: 0,
				}
				const expectedArea2: AreaSettings = {
					barSize: undefined,
					baseValue: undefined,
					connectNulls: false,
					data: undefined,
					dataKey: "pv",
					hide: false,
					id: expect.stringMatching("^recharts-area-[:a-z0-9-]+$"),
					isPanorama: false,
					stackId: "a",
					type: "area",
					xAxisId: 0,
					yAxisId: 0,
					zAxisId: 0,
				}
				expectLastCalledWith(spy, {
					a: {
						graphicalItems: [expectedArea1, expectedArea2],
						stackedData: expect.toBeRechartsStackedData([
							[
								[0, 400],
								[0, 300],
								[0, 300],
								[0, 200],
								[0, 278],
								[0, 189],
							],
							[
								[400, 2800],
								[300, 4867],
								[300, 1698],
								[200, 10000],
								[278, 4186],
								[189, 4989],
							],
						]),
					},
				})
				/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */
			})
		})

		describe("after hiding one item and displaying it again", () => {
			// https://github.com/recharts/recharts/issues/5992
			/* Cluster D: legend click doesn't propagate hide state to graphical items */
			it.skip("should keep the order of graphical items in stack group", () => {
				const { container, spy } = renderTestCase((state: ChartState) =>
					selectStackGroups(state, "xAxis", 0, false),
				)

				expectLastCalledWith(spy, {
					a: expect.objectContaining({
						graphicalItems: [
							expect.objectContaining({ dataKey: "uv", hide: false }),
							expect.objectContaining({ dataKey: "pv", hide: false }),
						],
					}),
				})
				/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */

				const legendItems = container.querySelectorAll(".recharts-legend-item")
				assertNotNull(legendItems)
				expect(legendItems).toHaveLength(2)
				const uvItem = legendItems[1]
				expect(uvItem.textContent).toBe("uv")
				fireEvent.click(uvItem)

				expectLastCalledWith(spy, {
					a: expect.objectContaining({
						graphicalItems: [expect.objectContaining({ dataKey: "pv", hide: false })],
					}),
				})
				/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(5) */

				fireEvent.click(uvItem)

				expectLastCalledWith(spy, {
					a: expect.objectContaining({
						graphicalItems: [
							// This should be in the same order as before hiding
							expect.objectContaining({ dataKey: "uv", hide: false }),
							expect.objectContaining({ dataKey: "pv", hide: false }),
						],
					}),
				})
				/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(7) */
			})
		})
	})

	describe("reverseStackOrder", () => {
		it("should reverse the order of graphical items and stacked data when reverseStackOrder is true", () => {
			const stackGroupsSpy = vi.fn()
			const Comp = (): null => {
				const isPanorama = useIsPanorama()
				createEffect(() =>
					stackGroupsSpy(
						useAppSelectorWithStableTest((state) =>
							selectStackGroups(state, "xAxis", 0, isPanorama),
						),
					),
				)
				return null
			}
			render(() => (
				<BarChart width={100} height={100} data={PageData} reverseStackOrder>
					<Bar dataKey="uv" stackId="a" />
					<Bar dataKey="pv" stackId="a" />
					<Comp />
				</BarChart>
			))
			expectLastCalledWith(stackGroupsSpy, {
				a: {
					graphicalItems: [
						// Order should be reversed compared to JSX order
						{
							barSize: undefined,
							data: undefined,
							dataKey: "pv",
							hide: false,
							id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
							isPanorama: false,
							maxBarSize: undefined,
							minPointSize: 0,
							stackId: "a",
							type: "bar",
							xAxisId: 0,
							yAxisId: 0,
							zAxisId: 0,
						},
						{
							barSize: undefined,
							data: undefined,
							dataKey: "uv",
							hide: false,
							id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
							isPanorama: false,
							maxBarSize: undefined,
							minPointSize: 0,
							stackId: "a",
							type: "bar",
							xAxisId: 0,
							yAxisId: 0,
							zAxisId: 0,
						},
					],
					stackedData: expect.toBeRechartsStackedData([
						// Stacked data order should also be reversed
						[
							[0, 2400],
							[0, 4567],
							[0, 1398],
							[0, 9800],
							[0, 3908],
							[0, 4800],
						],
						[
							[2400, 2800],
							[4567, 4867],
							[1398, 1698],
							[9800, 10000],
							[3908, 4186],
							[4800, 4989],
						],
					]),
				},
			})
			/* GOTCHA-007-E sibling-mount-order */
			// expect(stackGroupsSpy).toHaveBeenCalledTimes(2)
		})

		it("should maintain original order when reverseStackOrder is false", () => {
			const stackGroupsSpy = vi.fn()
			const Comp = (): null => {
				const isPanorama = useIsPanorama()
				createEffect(() =>
					stackGroupsSpy(
						useAppSelectorWithStableTest((state) =>
							selectStackGroups(state, "xAxis", 0, isPanorama),
						),
					),
				)
				return null
			}
			render(() => (
				<BarChart width={100} height={100} data={PageData} reverseStackOrder={false}>
					<Bar dataKey="uv" stackId="a" />
					<Bar dataKey="pv" stackId="a" />
					<Comp />
				</BarChart>
			))
			expectLastCalledWith(stackGroupsSpy, {
				a: {
					graphicalItems: [
						// Order should match JSX order
						{
							barSize: undefined,
							data: undefined,
							dataKey: "uv",
							hide: false,
							id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
							isPanorama: false,
							maxBarSize: undefined,
							minPointSize: 0,
							stackId: "a",
							type: "bar",
							xAxisId: 0,
							yAxisId: 0,
							zAxisId: 0,
						},
						{
							barSize: undefined,
							data: undefined,
							dataKey: "pv",
							hide: false,
							id: expect.stringMatching("^recharts-bar-[:a-z0-9-]+$"),
							isPanorama: false,
							maxBarSize: undefined,
							minPointSize: 0,
							stackId: "a",
							type: "bar",
							xAxisId: 0,
							yAxisId: 0,
							zAxisId: 0,
						},
					],
					stackedData: expect.toBeRechartsStackedData([
						[
							[0, 400],
							[0, 300],
							[0, 300],
							[0, 200],
							[0, 278],
							[0, 189],
						],
						[
							[400, 2800],
							[300, 4867],
							[300, 1698],
							[200, 10000],
							[278, 4186],
							[189, 4989],
						],
					]),
				},
			})
			/* GOTCHA-007-E sibling-mount-order */
			// expect(stackGroupsSpy).toHaveBeenCalledTimes(2)
		})
	})
})
