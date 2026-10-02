import { describe, expect, test, vi } from "vitest"
import { trackSpy } from "../helper/trackSpy"
import { fireEvent, render, screen, waitFor } from "../helper/render"
import {
	BarChart,
	Brush,
	BrushProps,
	ComposedChart,
	Customized,
	Line,
	LineChart,
	ReferenceLine,
} from "../../src"
import { assertNotNull } from "../helper/assertNotNull"
import { useAppSelector } from "../helper/legacyDispatch"
import {
	selectAxisRangeWithReverse,
	selectDisplayedData,
} from "../../src/state/selectors/axisSelectors"
import { pageData } from "../_data"
import { useViewBox } from "../../src/context/chartLayoutContext"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { selectChartDataWithIndexes } from "../../src/state/selectors/dataSelectors"
import { useIsPanorama } from "../../src/context/PanoramaContext"
import { expectBrush } from "../helper/expectBrush"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"
import { userEventSetup } from "../helper/userEventSetup"
import { createSignal, untrack } from "solid-js"
import type { JSX } from "@solidjs/web"
describe("<Brush />", () => {
	const data = [
		{ date: "2023-01-01", name: "A", value: 10 },
		{ date: "2023-01-02", name: "B", value: 20 },
		{ date: "2023-01-03", name: "C", value: 10 },
		{ date: "2023-01-04", name: "D", value: 30 },
		{ date: "2023-01-05", name: "E", value: 50 },
		{ date: "2023-01-06", name: "F", value: 10 },
		{ date: "2023-01-07", name: "G", value: 30 },
		{ date: "2023-01-08", name: "H", value: 20 },
		{ date: "2023-01-09", name: "I", value: 10 },
		{ date: "2023-01-10", name: "J", value: 70 },
		{ date: "2023-01-11", name: "K", value: 40 },
		{ date: "2023-01-12", name: "L", value: 20 },
		{ date: "2023-01-13", name: "M", value: 10 },
		{ date: "2023-01-14", name: "N", value: 10 },
	]

	describe("with panorama", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<LineChart width={400} height={100} data={data}>
				<Line dataKey="value" dot isAnimationActive={false} />
				<Brush dataKey="value" x={100} y={50} width={400} height={40}>
					<LineChart>
						<Line dataKey="value" dot isAnimationActive={false} />
					</LineChart>
				</Brush>
				{props.children}
			</LineChart>
		))

		function selectAllDotsInMainChart(container: Element) {
			return container.querySelectorAll(".recharts-line-dot:not(.recharts-brush *)")
		}

		function selectAllDotsInPanorama(container: Element) {
			return container.querySelectorAll(".recharts-brush .recharts-line-dot")
		}

		it("should render two lines, one for the big chart another in the panorama", () => {
			const { container } = renderTestCase()

			const dotsInPanorama = selectAllDotsInPanorama(container)
			expect(dotsInPanorama).toHaveLength(data.length)

			const dotsInMainChart = selectAllDotsInMainChart(container)
			expect(dotsInMainChart).toHaveLength(data.length)
		})

		it("should hide dots in the main chart after moving the slider, but keep all dots in the panorama visible", () => {
			const { container, spy } = renderTestCase(selectChartDataWithIndexes)

			expectLastCalledWith(spy, {
				chartData: data,
				computedData: undefined,
				dataEndIndex: data.length - 1,
				dataStartIndex: 0,
			})

			const slider = container.querySelector(".recharts-brush-traveller") as SVGRectElement
			fireEvent.mouseDown(slider)
			fireEvent.mouseMove(slider, { clientX: 200 })
			fireEvent.mouseUp(slider)

			expectLastCalledWith(spy, {
				chartData: data,
				computedData: undefined,
				dataEndIndex: data.length - 1,
				dataStartIndex: 6,
			})

			const dotsInPanorama = selectAllDotsInPanorama(container)
			expect(dotsInPanorama).toHaveLength(data.length)

			const dotsInMainChart = selectAllDotsInMainChart(container)
			expect(dotsInMainChart).toHaveLength(data.length - 6)
		})
	})

	test("Render 2 travelers and 1 slide in simple Brush", async () => {
		const { container } = render(() => (
			<BarChart width={400} height={100} data={data}>
				<Brush dataKey="value" x={100} y={50} width={400} height={40} />
			</BarChart>
		))

		expectBrush(container, {
			height: "40",
			width: "400",
			x: "100",
			y: "50",
		})

		const allTravellers = container.querySelectorAll(".recharts-brush-traveller")
		expect(allTravellers).toHaveLength(2)
		expect(container.querySelectorAll(".recharts-brush-slide")).toHaveLength(1)

		const traveller1 = allTravellers[0]
		expect(traveller1.getAttributeNames()).toEqual([
			"class",
			"tabindex",
			"role",
			"aria-label",
			"aria-valuemin",
			"aria-valuemax",
			"aria-valuenow",
			"style",
		])
		expect(traveller1.getAttribute("class")).toBe("recharts-layer recharts-brush-traveller")
		expect(traveller1.getAttribute("tabindex")).toBe("0")
		expect(traveller1.getAttribute("role")).toBe("slider")
		// sic! the label says "value" but it actually renders `name` property, not the dataKey, why?
		expect(traveller1.getAttribute("aria-label")).toBe("Min value: A, Max value: N")
		// this is using X in pixels, not value, why? Doesn't sound very accessible
		expect(traveller1.getAttribute("aria-valuenow")).toBe("100")
		expect(traveller1.getAttribute("style")).toBe("cursor: col-resize;")
		await expect(traveller1.innerHTML).toMatchFileSnapshot("snapshots/brush-traveller1.svg")

		const traveller2 = allTravellers[1]
		expect(traveller2.getAttributeNames()).toEqual([
			"class",
			"tabindex",
			"role",
			"aria-label",
			"aria-valuemin",
			"aria-valuemax",
			"aria-valuenow",
			"style",
		])
		expect(traveller2.getAttribute("class")).toBe("recharts-layer recharts-brush-traveller")
		expect(traveller2.getAttribute("tabindex")).toBe("0")
		expect(traveller2.getAttribute("role")).toBe("slider")
		// sic! the label says "value" but it actually renders `name` property, not the dataKey, why?
		expect(traveller2.getAttribute("aria-label")).toBe("Min value: A, Max value: N")
		// this is using X in pixels, not value, why? Doesn't sound very accessible
		expect(traveller2.getAttribute("aria-valuenow")).toBe("495")
		expect(traveller2.getAttribute("style")).toBe("cursor: col-resize;")
		await expect(traveller2.innerHTML).toMatchFileSnapshot("snapshots/brush-traveller2.svg")
	})

	test("custom traveller Element should receive extra sneaky props", () => {
		const { container } = render(() => (
			<BarChart width={400} height={100} data={data}>
				<Brush
					dataKey="value"
					x={100}
					y={50}
					width={400}
					height={40}
					traveller={<div data-testid="custom-traveller-element" />}
				/>
			</BarChart>
		))

		expectBrush(container, {
			height: "40",
			width: "400",
			x: "100",
			y: "50",
		})

		const customTraveller = container.querySelector('[data-testid="custom-traveller-element"]')
		assertNotNull(customTraveller)
		expect(customTraveller).toBeInTheDocument()
		expect(customTraveller).toBeVisible()
		expect(customTraveller.getAttributeNames()).toEqual([
			"data-testid",
			"x",
			"y",
			"width",
			"height",
			"fill",
			"stroke",
		])
		expect(customTraveller.getAttribute("data-testid")).toBe("custom-traveller-element")
		expect(customTraveller.getAttribute("x")).toBe("100")
		expect(customTraveller.getAttribute("y")).toBe("50")
		expect(customTraveller.getAttribute("width")).toBe("5")
		expect(customTraveller.getAttribute("height")).toBe("40")
		expect(customTraveller.getAttribute("fill")).toBe("#fff")
		expect(customTraveller.getAttribute("stroke")).toBe("#666")
	})

	test("custom traveller component receives props", () => {
		const spy = vi.fn()
		const CustomTraveller = (props: unknown) => {
			spy(props)
			return <div data-testid="custom-traveller-element" />
		}
		const { container } = render(() => (
			<BarChart width={400} height={100} data={data}>
				<Brush
					dataKey="value"
					x={100}
					y={50}
					width={400}
					height={40}
					fill="#abc"
					stroke="#def"
					traveller={CustomTraveller}
				/>
			</BarChart>
		))
		const customTraveller = container.querySelector('[data-testid="custom-traveller-element"]')
		expect(customTraveller).toBeInTheDocument()
		expect(customTraveller).toBeVisible()
		/* Brush settings reach the store after mount, so travellers render once more with the
		   settled width; the latest call per traveller carries the final props. */
		expect(spy.mock.calls.slice(-2)).toEqual([
			[{ fill: "#abc", height: 40, stroke: "#def", width: 5, x: 100, y: 50 }],
			[{ fill: "#abc", height: 40, stroke: "#def", width: 5, x: 495, y: 50 }],
		])
	})

	test("Should not filter out the value 0 in scaleValues and cause indices to be off by 1", async () => {
		const { container } = render(() => (
			<ComposedChart
				width={200}
				height={100}
				data={data.slice(0, 6)}
				margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
			>
				<Brush>
					<LineChart>
						<Line dataKey="name" dot isAnimationActive={false} />
					</LineChart>
				</Brush>
			</ComposedChart>
		))
		const traveller = container.querySelectorAll(".recharts-brush-traveller")[1] as SVGGElement
		expect(traveller).toBeDefined()
		fireEvent.focus(traveller)

		const text = container.querySelector(
			'.recharts-brush-texts text[text-anchor="start"]',
		) as SVGGElement
		expect(text.textContent).toBe("5")

		fireEvent.keyDown(traveller, {
			key: "ArrowLeft",
		})
		expect(text.textContent).toBe("4")
		fireEvent.keyDown(traveller, {
			key: "ArrowRight",
		})

		// there are 6 data points, left and then right should have index 5
		expect(text.textContent).toBe("5")
	})

	test("Don't render any travellers or slide when data is empty in simple Brush", () => {
		const { container } = render(() => (
			<BarChart width={400} height={100} data={[]}>
				<Brush x={100} y={50} width={400} height={40} />
			</BarChart>
		))
		expect(container.querySelectorAll(".recharts-brush-traveller")).toHaveLength(0)
		expect(container.querySelectorAll(".recharts-brush-slide")).toHaveLength(0)
	})

	test("Renders Brush in a custom component", () => {
		const CustomBrush = (props: BrushProps) => {
			return <Brush {...props} />
		}

		const { container } = render(() => (
			<BarChart width={400} height={100} data={[]}>
				<CustomBrush x={100} y={50} width={400} height={40} />
			</BarChart>
		))
		expect(container.querySelectorAll(".recharts-brush-traveller")).toHaveLength(0)
		expect(container.querySelectorAll(".recharts-brush-slide")).toHaveLength(0)
	})

	test("Render panorama when specified LineChart as child", () => {
		const { container } = render(() => (
			<BarChart width={400} height={100} data={data}>
				<Brush x={90} y={40} width={300} height={50}>
					<LineChart>
						<Line dataKey="value" />
					</LineChart>
				</Brush>
			</BarChart>
		))

		expectBrush(container, {
			height: "50",
			width: "300",
			x: "90",
			y: "40",
		})

		expect(container.querySelectorAll(".recharts-line")).toHaveLength(1)
	})

	test("mouse over on traveller will trigger the brush text display", () => {
		// wrap brush with a bar chart to make brush traveler work
		const { container } = render(() => (
			<BarChart width={500} height={100} data={data}>
				<Brush dataKey="date" height={90} stroke="#8884d8" />
			</BarChart>
		))

		expectBrush(container, {
			height: "90",
			width: "490",
			x: "5",
			y: "5",
		})

		const brushSlide = container.querySelector(".recharts-brush-slide") as SVGRectElement
		fireEvent.mouseOver(brushSlide, { pageX: 0, pageY: 0 })

		expect(container.querySelectorAll(".recharts-brush-texts")).toHaveLength(1)
		expect(screen.getAllByText(data[0].date)).toHaveLength(1)
		expect(screen.getAllByText(data[data.length - 1].date)).toHaveLength(1)
	})

	test("mouse down on traveller will trigger the brush text display, and mouse move out will hide the brush text", () => {
		// wrap brush with a bar chart to make brush traveler work
		const { container } = render(() => (
			<BarChart
				width={500}
				height={100}
				data={data}
				margin={{
					left: 100,
					right: 100,
				}}
			>
				<Brush dataKey="date" height={90} stroke="#8884d8" />
			</BarChart>
		))

		expectBrush(container, {
			height: "90",
			width: "300",
			x: "100",
			y: "10",
		})

		const brushSlide = container.querySelector(".recharts-brush-slide")
		assertNotNull(brushSlide)
		fireEvent.mouseDown(brushSlide)

		expect(container.querySelectorAll(".recharts-brush-texts")).toHaveLength(1)
		expect(screen.getAllByText(data[0].date)).toHaveLength(1)
		expect(screen.getAllByText(data[data.length - 1].date)).toHaveLength(1)

		fireEvent.mouseUp(window)

		expect(container.querySelectorAll(".recharts-brush-texts")).toHaveLength(0)
	})

	test("render text when alwaysShowText is true", () => {
		const { container } = render(() => (
			<BarChart width={500} height={100} data={data}>
				<Brush x={100} y={50} width={400} height={40} alwaysShowText />
			</BarChart>
		))

		expect(container.querySelectorAll(".recharts-layer.recharts-brush-texts")).toHaveLength(1)
	})

	describe("Brush a11y features", () => {
		test("Brush travellers should be marked up correctly", () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="value" x={100} y={50} width={400} height={40} />
				</BarChart>
			))

			const travellers = container.querySelectorAll(".recharts-brush-traveller")
			expect(travellers).toHaveLength(2)
			travellers.forEach((travellerElement) => {
				// tabIndex=0 is necessary for a keyboard user to tab to an element.
				// If this fails, the component ceases to be accessible in any way.
				expect(travellerElement).toHaveProperty("tabIndex", 0)
			})
		})

		test("Brush text should appear while travellers are in focus", async () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="value" x={100} y={50} width={400} height={40} />
				</BarChart>
			))

			// By default, no text should appear
			expect(container.querySelector(".recharts-brush-texts")).toBeNull()

			// After focusing on a traveller, the text should appear
			const traveller = container.querySelector(".recharts-brush-traveller") as SVGGElement
			fireEvent.focus(traveller)

			expect(container.querySelector(".recharts-brush-texts")).not.toBeNull()

			// After blurring that traveller, the text should disappear again
			fireEvent.blur(traveller)

			expect(container.querySelector(".recharts-brush-texts")).toBeNull()
		})

		test("Travellers should move when valid keyboard events are fired", async () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="value" x={100} y={50} width={400} height={40} />
				</BarChart>
			))

			const traveller = container.querySelector(".recharts-brush-traveller") as SVGGElement
			fireEvent.focus(traveller)

			expect(container.querySelector(".recharts-brush-texts")).not.toBeNull()

			const text = container.querySelector(
				'.recharts-brush-texts text[text-anchor="end"]',
			) as SVGGElement
			expect(text?.textContent).toBe("10")

			fireEvent.keyDown(traveller, {
				key: "ArrowRight",
			})
			expect(text.textContent).toBe("20")

			fireEvent.keyDown(traveller, {
				key: "ArrowLeft",
			})
			expect(text.textContent).toBe("10")
		})

		test("Travellers should move when valid keyboard events are fired AFTER mouse interaction", async () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="value" x={100} y={50} width={400} height={40} />
				</BarChart>
			))

			const traveller = container.querySelector(".recharts-brush-traveller") as SVGGElement

			fireEvent.mouseDown(traveller)
			fireEvent.mouseMove(traveller, { clientX: 30 })
			fireEvent.mouseUp(traveller)

			fireEvent.focus(traveller)

			expect(container.querySelector(".recharts-brush-texts")).not.toBeNull()

			const text = container.querySelector(
				'.recharts-brush-texts text[text-anchor="end"]',
			) as SVGGElement
			expect(text?.textContent).toBe("10")

			fireEvent.keyDown(traveller, {
				key: "ArrowRight",
			})
			expect(text.textContent).toBe("20")

			fireEvent.keyDown(traveller, {
				key: "ArrowLeft",
			})
			expect(text.textContent).toBe("10")
		})

		const ControlledPanoramicBrush = () => {
			const [startIndex, setStartIndex] = createSignal<number | undefined>(3)
			const [endIndex, setEndIndex] = createSignal<number | undefined>(data.length - 1)

			return (
				<>
					<ComposedChart data={data} height={400} width={400}>
						<Line dataKey="value" isAnimationActive={false} />
						<ReferenceLine y={30} />

						<Brush
							startIndex={startIndex()}
							endIndex={endIndex()}
							onChange={(e) => {
								setEndIndex(e.endIndex)
								setStartIndex(e.startIndex)
							}}
							alwaysShowText
						>
							<ComposedChart>
								<Line dataKey="value" isAnimationActive={false} />
								<ReferenceLine y={30} />
							</ComposedChart>
						</Brush>
					</ComposedChart>
					<input
						type="number"
						aria-label="startIndex"
						value={startIndex()}
						/* React onChange = native input event */
						onInput={(evt) => {
							const num = Number(evt.target.value)
							if (Number.isInteger(num)) setStartIndex(num)
						}}
					/>
					<input
						aria-label="endIndex"
						value={endIndex()}
						/* React onChange = native input event */
						onInput={(evt) => {
							const num = Number(evt.target.value)
							if (Number.isInteger(num)) setEndIndex(num)
						}}
					/>
				</>
			)
		}

		test("Travellers should move and chart should update when brush start and end indexes are controlled", async () => {
			const user = userEventSetup()
			const { container } = render(() => <ControlledPanoramicBrush />)
			assertNotNull(container)

			const traveller = container.querySelector(".recharts-brush-traveller") as SVGGElement
			fireEvent.focus(traveller)

			const startIndexInput = screen.getByLabelText<HTMLInputElement>("startIndex")
			const endIndexInput = screen.getByLabelText<HTMLInputElement>("endIndex")

			await user.clear(startIndexInput)
			await user.type(startIndexInput, "2")
			await user.clear(endIndexInput)
			await user.type(endIndexInput, "5")

			const brushTexts = container.getElementsByClassName("recharts-brush-texts").item(0)?.children
			assertNotNull(brushTexts)
			expect(brushTexts.item(0)).toBeInTheDocument()

			expect(brushTexts.item(0)?.textContent).toContain("2")
			expect(brushTexts.item(1)?.textContent).toContain("5")
		})

		test("Should render panorama in brush", async () => {
			const { container } = render(() => <ControlledPanoramicBrush />)

			const svgs = container.getElementsByTagName("svg")
			expect(svgs).toHaveLength(2)

			const lines = container.getElementsByClassName("recharts-line")
			expect(lines).toHaveLength(2)

			const referenceLines = container.getElementsByClassName("recharts-reference-line-line")
			expect(referenceLines).toHaveLength(2)

			const chartReferenceLineY1 = referenceLines[0].getAttribute("y1")
			const chartReferenceLineY2 = referenceLines[0].getAttribute("y2")

			const panoReferenceLineY1 = referenceLines[1].getAttribute("y1")
			const panoReferenceLineY2 = referenceLines[1].getAttribute("y2")

			// reference lines should be created on different scales and therefore have different values
			expect(chartReferenceLineY1).not.toEqual(panoReferenceLineY1)
			expect(chartReferenceLineY2).not.toEqual(panoReferenceLineY2)
		})
	})

	describe("panorama and state integration", () => {
		it("should select data from the parent chart", () => {
			const rootDataSpy = vi.fn()
			const panoramaDataSpy = vi.fn()

			const RootComp = (): null => {
				const isPanorama = untrack(() => useIsPanorama())
				trackSpy(rootDataSpy, () => useAppSelector((state) => selectDisplayedData(state, "xAxis", 0, isPanorama)))
				return null
			}

			const PanoramaComp = (): null => {
				const isPanorama = untrack(() => useIsPanorama())
				trackSpy(panoramaDataSpy, () => useAppSelector((state) => selectDisplayedData(state, "xAxis", 1, isPanorama)))
				return null
			}

			const { container } = render(() => (
				<ComposedChart
					height={100}
					width={200}
					margin={{ bottom: 40, left: 30, right: 20, top: 10 }}
					data={pageData}
				>
					<Customized component={<RootComp />} />
					<Brush>
						<ComposedChart>
							<Customized component={<PanoramaComp />} />
						</ComposedChart>
					</Brush>
				</ComposedChart>
			))

			expectBrush(container, {
				height: "40",
				width: "150",
				x: "30",
				y: "20",
			})

			expect(rootDataSpy).toHaveBeenLastCalledWith(pageData)
			expect(panoramaDataSpy).toHaveBeenLastCalledWith(pageData)
		})

		it("should have its own viewBox, and its own YAxis range", () => {
			const rootViewBoxSpy = vi.fn()
			const rootYAxisRangeSpy = vi.fn()
			const panoramaViewBoxSpy = vi.fn()
			const panoramaYAxisRangeSpy = vi.fn()

			const RootComp = (): null => {
				trackSpy(rootViewBoxSpy, () => useViewBox())
				trackSpy(rootYAxisRangeSpy, () => useAppSelector((state) => selectAxisRangeWithReverse(state, "yAxis", 0, false)))
				return null
			}

			const PanoramaComp = (): null => {
				trackSpy(panoramaViewBoxSpy, () => useViewBox())
				trackSpy(panoramaYAxisRangeSpy, () => useAppSelector((state) => selectAxisRangeWithReverse(state, "yAxis", 0, true)))
				return null
			}

			const { container } = render(() => (
				<ComposedChart
					height={300}
					width={500}
					data={pageData}
					margin={{ bottom: 44, left: 33, right: 22, top: 11 }}
				>
					<Customized component={<RootComp />} />
					<Brush>
						<ComposedChart>
							<Customized component={<PanoramaComp />} />
						</ComposedChart>
					</Brush>
				</ComposedChart>
			))

			expectBrush(container, {
				height: "40",
				width: "445",
				x: "33",
				y: "216",
			})

			expect(rootViewBoxSpy).toHaveBeenLastCalledWith({
				height: 205,
				width: 445,
				x: 33,
				y: 11,
			})
			expect(panoramaViewBoxSpy).toHaveBeenLastCalledWith({
				height: 38,
				width: 443,
				x: 1,
				y: 1,
			})

			expect(rootYAxisRangeSpy).toHaveBeenLastCalledWith([216, 11])
			expect(panoramaYAxisRangeSpy).toHaveBeenLastCalledWith([39, 1])
		})
	})

	describe("dragging the slide when start/endIndex are controlled from props", () => {
		test("should not snap the slide back to its original position on mouseup", () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data}>
					<Brush
						dataKey="value"
						x={100}
						y={50}
						width={400}
						height={40}
						startIndex={3}
						endIndex={6}
					/>
				</BarChart>
			))

			const slide = container.querySelector(".recharts-brush-slide") as SVGRectElement
			const travellers = () => container.querySelectorAll(".recharts-brush-traveller")
			const positionsOf = (elements: NodeListOf<Element>) =>
				Array.from(elements).map((el) => el.getAttribute("aria-valuenow"))

			fireEvent.mouseDown(slide, { clientX: 200 })
			fireEvent.mouseMove(slide, { clientX: 220 })
			const positionsWhileDragging = positionsOf(travellers())

			fireEvent.mouseUp(slide)
			const positionsAfterMouseUp = positionsOf(travellers())

			expect(positionsAfterMouseUp).toEqual(positionsWhileDragging)
		})
	})

	describe("controlled startIndex and endIndex across data updates", () => {
		function ControlledBrushWithChangingData(props: { children?: JSX.Element }) {
			const [chartData, setChartData] = createSignal(data)
			return (
				<>
					<BarChart width={400} height={100} data={chartData()}>
						{props.children}
						<Brush
							dataKey="value"
							startIndex={2}
							endIndex={5}
							x={100}
							y={50}
							width={400}
							height={40}
						/>
					</BarChart>
					<button
						type="button"
						onClick={() => setChartData(data.map((entry) => ({ ...entry })))}
					>
						change data
					</button>
				</>
			)
		}

		it("should preserve the controlled startIndex and endIndex when the data array identity changes but the length stays the same", () => {
			const renderTestCase = createSelectorTestCase(ControlledBrushWithChangingData)
			const { spy, container } = renderTestCase(selectChartDataWithIndexes)

			expectLastCalledWith(spy, {
				chartData: data,
				dataStartIndex: 2,
				dataEndIndex: 5,
				computedData: undefined,
			})

			const button = container.querySelector("button") as HTMLButtonElement
			fireEvent.click(button)

			const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0]
			expect(lastCall.chartData).not.toBe(data)
			expect(lastCall.dataStartIndex).toBe(2)
			expect(lastCall.dataEndIndex).toBe(5)
		})
	})

	describe("dy props", () => {
		it("should added its given y value", () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="value" x={100} y={50} dy={30} width={400} height={40} />
				</BarChart>
			))

			expectBrush(container, {
				height: "40",
				width: "400",
				x: "100",
				y: "80",
			})
		})

		it("should added its automatically calculated y value", () => {
			const { container } = render(() => (
				<BarChart width={400} height={100} data={data} margin={{ bottom: 0, top: 0 }}>
					<Brush dataKey="value" x={100} dy={30} width={400} height={40} />
				</BarChart>
			))

			expectBrush(container, {
				height: "40",
				width: "400",
				x: "100",
				y: "90",
			})
		})
	})
})
