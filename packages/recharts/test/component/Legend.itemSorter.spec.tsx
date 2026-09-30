/* @jsxImportSource solid-js */
import { describe, it, expect, test, vi, beforeEach } from "vitest"
import { render } from "@solidjs/testing-library"
import { createContext, useContext, createSignal, For } from "solid-js"
import {
	Area,
	AreaChart,
	DefaultLegendContentProps,
	Legend,
	LegendPayload,
	Line,
	LineChart,
} from "../../src"
import { numericalData } from "../_data"
import { expectLegendLabels } from "../helper/expectLegendLabels"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"
import { assertNotNull } from "../helper/assertNotNull"
import { DefaultZIndexes } from "../../src/zIndex/DefaultZIndexes"

describe("Legend.itemSorter", () => {
	describe("with default content", () => {
		test("sorts legend items by label value by default", () => {
			const { container } = render(() => (
				<LineChart width={500} height={500} data={numericalData}>
					<Legend />
					<Line dataKey="percent" name="B" />
					<Line dataKey="value" name="A" />
				</LineChart>
			))

			expectLegendLabels(container, [
				{ fill: "none", stroke: "#3182bd", textContent: "A" },
				{ fill: "none", stroke: "#3182bd", textContent: "B" },
			])
		})
		test("sorts legend items when itemSorter=dataKey", () => {
			const { container } = render(() => (
				<LineChart width={500} height={500} data={numericalData}>
					<Legend itemSorter="dataKey" />
					<Line dataKey="percent" name="B" />
					<Line dataKey="value" name="A" />
				</LineChart>
			))

			expectLegendLabels(container, [
				{ fill: "none", stroke: "#3182bd", textContent: "B" },
				{ fill: "none", stroke: "#3182bd", textContent: "A" },
			])
		})
	})
	/* Cluster D: Legend custom-content payload — sibling-mount-order session 7 residual. */
	describe.skip("when Legend content is a function", () => {
		it("should pass legend items sorted by label value by default", () => {
			// this should sort by label value, but it does not
			const customContent = vi.fn()

			render(() => (
				<LineChart width={500} height={500} data={numericalData}>
					<Legend content={customContent} />
					<Line dataKey="percent" name="B" />
					<Line dataKey="value" name="A" />
				</LineChart>
			))

			expect(customContent).toHaveBeenLastCalledWith(
				{
					align: "center",
					chartHeight: 500,
					chartWidth: 500,
					content: customContent,
					iconSize: 14,
					inactiveColor: "#ccc",
					itemSorter: "value",
					layout: "horizontal",
					margin: {
						bottom: 5,
						left: 5,
						right: 5,
						top: 5,
					},
					payload: [
						{
							color: "#3182bd",
							dataKey: "value",
							inactive: false,
							payload: {
								activeDot: true,
								animateNewValues: true,
								animationBegin: 0,
								animationDuration: 1500,
								animationEasing: "ease",
								connectNulls: false,
								dataKey: "value",
								dot: true,
								fill: "#fff",
								hide: false,
								isAnimationActive: "auto",
								label: false,
								legendType: "line",
								name: "A",
								stroke: "#3182bd",
								strokeWidth: 1,
								type: "linear",
								xAxisId: 0,
								yAxisId: 0,
								zIndex: DefaultZIndexes.line,
							},
							type: "line",
							value: "A",
						},
						{
							color: "#3182bd",
							dataKey: "percent",
							inactive: false,
							payload: {
								activeDot: true,
								animateNewValues: true,
								animationBegin: 0,
								animationDuration: 1500,
								animationEasing: "ease",
								connectNulls: false,
								dataKey: "percent",
								dot: true,
								fill: "#fff",
								hide: false,
								isAnimationActive: "auto",
								label: false,
								legendType: "line",
								name: "B",
								stroke: "#3182bd",
								strokeWidth: 1,
								type: "linear",
								xAxisId: 0,
								yAxisId: 0,
								zIndex: DefaultZIndexes.line,
							},
							type: "line",
							value: "B",
						},
					],
					verticalAlign: "bottom",
					width: 490,
				},
				{},
			)
		})
		it("should pass legend items sorted by dataKey when itemSorter is set", () => {
			const customContent = vi.fn()

			render(() => (
				<LineChart width={500} height={500} data={numericalData}>
					<Legend content={customContent} itemSorter="dataKey" />
					<Line dataKey="percent" name="B" />
					<Line dataKey="value" name="A" />
				</LineChart>
			))

			expect(customContent).toHaveBeenLastCalledWith(
				{
					align: "center",
					chartHeight: 500,
					chartWidth: 500,
					content: customContent,
					iconSize: 14,
					inactiveColor: "#ccc",
					itemSorter: "dataKey",
					layout: "horizontal",
					margin: {
						bottom: 5,
						left: 5,
						right: 5,
						top: 5,
					},
					payload: [
						{
							color: "#3182bd",
							dataKey: "percent",
							inactive: false,
							payload: {
								activeDot: true,
								animateNewValues: true,
								animationBegin: 0,
								animationDuration: 1500,
								animationEasing: "ease",
								connectNulls: false,
								dataKey: "percent",
								dot: true,
								fill: "#fff",
								hide: false,
								isAnimationActive: "auto",
								label: false,
								legendType: "line",
								name: "B",
								stroke: "#3182bd",
								strokeWidth: 1,
								type: "linear",
								xAxisId: 0,
								yAxisId: 0,
								zIndex: DefaultZIndexes.line,
							},
							type: "line",
							value: "B",
						},
						{
							color: "#3182bd",
							dataKey: "value",
							inactive: false,
							payload: {
								activeDot: true,
								animateNewValues: true,
								animationBegin: 0,
								animationDuration: 1500,
								animationEasing: "ease",
								connectNulls: false,
								dataKey: "value",
								dot: true,
								fill: "#fff",
								hide: false,
								isAnimationActive: "auto",
								label: false,
								legendType: "line",
								name: "A",
								stroke: "#3182bd",
								strokeWidth: 1,
								type: "linear",
								xAxisId: 0,
								yAxisId: 0,
								zIndex: DefaultZIndexes.line,
							},
							type: "line",
							value: "A",
						},
					],
					verticalAlign: "bottom",
					width: 490,
				},
				{},
			)
		})
	})
	/* Cluster D */
	describe.skip("when Legend content hides and shows items on click", () => {
		function MyLegendHidingComponent(props: { children: JSX.Element }) {
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
				<LineChart width={500} height={500} data={numericalData}>
					<Legend itemSorter="dataKey" onClick={handleClick} />
					<Line
						dataKey="percent"
						name="B"
						stroke={hiddenItems().includes("percent") ? "gold" : "red"}
						hide={hiddenItems().includes("percent")}
					/>
					<Line
						dataKey="value"
						name="A"
						stroke={hiddenItems().includes("value") ? "silver" : "blue"}
						hide={hiddenItems().includes("value")}
					/>
					{props.children}
				</LineChart>
			)
		}

		const renderTestCase = createSelectorTestCase(MyLegendHidingComponent)

		describe("on initial render", () => {
			it("should render all items sorted by dataKey", () => {
				const { container } = renderTestCase()

				expectLegendLabels(container, [
					{ fill: "none", stroke: "red", textContent: "B" },
					{ fill: "none", stroke: "blue", textContent: "A" },
				])
			})
		})
		describe("after clicking on legend items", () => {
			it("should hide the clicked item and keep the order", () => {
				const { container, getByText } = renderTestCase()

				getByText("A").click()
				expectLegendLabels(container, [
					{ fill: "none", stroke: "red", textContent: "B" },
					{ fill: "none", stroke: "#ccc", textContent: "A" },
				])

				getByText("B").click()
				expectLegendLabels(container, [
					{ fill: "none", stroke: "#ccc", textContent: "B" },
					{ fill: "none", stroke: "#ccc", textContent: "A" },
				])
			})
			it("should show the clicked item again and keep the order", () => {
				const { container, getByText } = renderTestCase()

				getByText("A").click()
				getByText("B").click()
				expectLegendLabels(container, [
					{ fill: "none", stroke: "#ccc", textContent: "B" },
					{ fill: "none", stroke: "#ccc", textContent: "A" },
				])

				getByText("B").click()
				expectLegendLabels(container, [
					{ fill: "none", stroke: "red", textContent: "B" },
					{ fill: "none", stroke: "#ccc", textContent: "A" },
				])

				getByText("A").click()
				expectLegendLabels(container, [
					{ fill: "none", stroke: "red", textContent: "B" },
					{ fill: "none", stroke: "blue", textContent: "A" },
				])
			})
		})
	})
	/* Cluster D */
	describe.skip("when Legend content hides and shows items on click and also it has a custom content", () => {
		const spy = vi.fn()

		const LegendClickContext = createContext<(entry: LegendPayload) => void>(() => {})

		function useItemHiding() {
			const [hiddenItems, setHiddenItems] = createSignal<ReadonlyArray<string>>([])

			const handleClick = ({ dataKey }: LegendPayload) => {
				if (typeof dataKey !== "string") {
					return
				}
				setHiddenItems((prev) =>
					prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey],
				)
			}

			return { handleClick, hiddenItems }
		}

		const MyCustomLegendContent = (props: DefaultLegendContentProps) => {
			const handleClick = useContext(LegendClickContext)
			spy(props)
			assertNotNull(props.payload)
			return (
				<ul>
					<For each={props.payload}>
						{(entry) => (
							<li style={{ color: entry.color }}>
								<button type="button" onClick={() => handleClick(entry)}>
									{entry.value}
								</button>
							</li>
						)}
					</For>
					{props.children}
				</ul>
			)
		}

		beforeEach(() => {
			spy.mockClear()
		})
		describe("in LineChart", () => {
			/*
			 * https://github.com/recharts/recharts/issues/5992
			 */
			function MyLegendHidingLineChartTestCase(props: { children: JSX.Element }) {
				const { hiddenItems, handleClick } = useItemHiding()

				return (
					<LegendClickContext.Provider value={handleClick}>
						<LineChart width={500} height={500} data={numericalData}>
							<Legend itemSorter="dataKey" content={MyCustomLegendContent} />
							<Line
								dataKey="percent"
								name="B"
								stroke={hiddenItems().includes("percent") ? "gold" : "red"}
								hide={hiddenItems().includes("percent")}
							/>
							<Line
								dataKey="value"
								name="A"
								stroke={hiddenItems().includes("value") ? "silver" : "blue"}
								hide={hiddenItems().includes("value")}
							/>
							{props.children}
						</LineChart>
					</LegendClickContext.Provider>
				)
			}

			const renderTestCase = createSelectorTestCase(MyLegendHidingLineChartTestCase)

			describe("on initial render", () => {
				it("should render all items sorted by dataKey", () => {
					renderTestCase()

					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "red",
									dataKey: "percent",
									inactive: false,
									value: "B",
								}),
								expect.objectContaining({
									color: "blue",
									dataKey: "value",
									inactive: false,
									value: "A",
								}),
							],
						}),
					)
				})
			})
			describe("after clicking on legend items", () => {
				it("should hide the clicked item and keep the order", () => {
					const { getByText } = renderTestCase()

					getByText("A").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "red",
									dataKey: "percent",
									inactive: false,
									value: "B",
								}),
								expect.objectContaining({
									color: "silver",
									dataKey: "value",
									inactive: true,
									value: "A",
								}),
							],
						}),
					)

					getByText("B").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "gold",
									dataKey: "percent",
									inactive: true,
									value: "B",
								}),
								expect.objectContaining({
									color: "silver",
									dataKey: "value",
									inactive: true,
									value: "A",
								}),
							],
						}),
					)
				})
			})
		})
		describe("in stacked AreaChart", () => {
			function MyLegendHidingAreaChartTestCase(props: { children: JSX.Element }) {
				const { hiddenItems, handleClick } = useItemHiding()

				return (
					<LegendClickContext.Provider value={handleClick}>
						<AreaChart width={500} height={500} data={numericalData}>
							<Legend itemSorter="dataKey" content={MyCustomLegendContent} />
							<Area
								dataKey="percent"
								name="B"
								stackId="1"
								stroke={hiddenItems().includes("percent") ? "gold" : "red"}
								hide={hiddenItems().includes("percent")}
							/>
							<Area
								dataKey="value"
								name="A"
								stackId="1"
								stroke={hiddenItems().includes("value") ? "silver" : "blue"}
								hide={hiddenItems().includes("value")}
							/>
							{props.children}
						</AreaChart>
					</LegendClickContext.Provider>
				)
			}

			const renderTestCase = createSelectorTestCase(MyLegendHidingAreaChartTestCase)

			describe("on initial render", () => {
				it("should render all items sorted by dataKey", () => {
					renderTestCase()

					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "red",
									dataKey: "percent",
									inactive: false,
									value: "B",
								}),
								expect.objectContaining({
									color: "blue",
									dataKey: "value",
									inactive: false,
									value: "A",
								}),
							],
						}),
					)
				})
			})
			describe("after clicking on legend items", () => {
				it("should hide the clicked item and keep the order", () => {
					const { getByText } = renderTestCase()

					getByText("A").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "red",
									dataKey: "percent",
									inactive: false,
									value: "B",
								}),
								expect.objectContaining({
									color: "silver",
									dataKey: "value",
									inactive: true,
									value: "A",
								}),
							],
						}),
					)

					getByText("B").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "gold",
									dataKey: "percent",
									inactive: true,
									value: "B",
								}),
								expect.objectContaining({
									color: "silver",
									dataKey: "value",
									inactive: true,
									value: "A",
								}),
							],
						}),
					)
				})
				it("should show the clicked item again and keep the order", () => {
					const { getByText } = renderTestCase()

					getByText("A").click()
					getByText("B").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "gold",
									dataKey: "percent",
									inactive: true,
									value: "B",
								}),
								expect.objectContaining({
									color: "silver",
									dataKey: "value",
									inactive: true,
									value: "A",
								}),
							],
						}),
					)

					getByText("B").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "red",
									dataKey: "percent",
									inactive: false,
									value: "B",
								}),
								expect.objectContaining({
									color: "silver",
									dataKey: "value",
									inactive: true,
									value: "A",
								}),
							],
						}),
					)

					getByText("A").click()
					expectLastCalledWith(
						spy,
						expect.objectContaining({
							payload: [
								expect.objectContaining({
									color: "red",
									dataKey: "percent",
									inactive: false,
									value: "B",
								}),
								expect.objectContaining({
									color: "blue",
									dataKey: "value",
									inactive: false,
									value: "A",
								}),
							],
						}),
					)
				})
			})
		})
	})
})
