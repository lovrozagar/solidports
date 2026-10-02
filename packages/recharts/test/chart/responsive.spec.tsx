/* @jsxImportSource @solidjs/web */
import { render } from "../helper/render"
import { flush } from "solid-js"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"
import { ComposedChart, Line, ResponsiveContainer, useChartHeight, useChartWidth } from "../../src"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { PageData } from "../_data"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"

describe("responsive prop", () => {
	let resizeObserverCallback: (entries: ResizeObserverEntry[]) => void,
		resizeObserverMock: {
			observe: ReturnType<typeof vi.fn>
			unobserve: ReturnType<typeof vi.fn>
			disconnect: ReturnType<typeof vi.fn>
		}

	beforeEach(() => {
		resizeObserverMock = {
			disconnect: vi.fn(),
			observe: vi.fn(),
			unobserve: vi.fn(),
		}
		mockGetBoundingClientRect({ height: 400, width: 500 })
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(function ResizeObserverCtor(cb: (entries: ResizeObserverEntry[]) => void) {
				resizeObserverCallback = (entries) => {
					cb(entries)
					/* The observer callback writes signals; flush like a browser frame would. */
					flush()
				}
				return resizeObserverMock
			}),
		)
	})
	describe.each([false, undefined])("with responsive=%s", (responsive) => {
		describe("when width and height are not specified", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart responsive={responsive} data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should not render any SVG", () => {
				const { container } = renderTestCase()
				expect(container.querySelector("svg")).toBeNull()
			})
			it("should render wrapper div", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({ position: "relative" })
			})
			it("should not interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).not.toHaveBeenCalled()
			})
			it("should not render children", () => {
				const { spy } = renderTestCase(useChartWidth)
				expect(spy).not.toHaveBeenCalled()
			})
		})
		describe("when width and height are numbers", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart width={600} height={400} responsive={responsive} data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with given width and height", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "600")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({
					height: "400px",
					position: "relative",
					width: "600px",
				})
			})
			it("should not interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).not.toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 600)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		describe("when width and height are percentages", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart width="50%" height="50%" responsive={responsive} data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with dimensions from getBoundingClientRect", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "500")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({ height: "50%", position: "relative", width: "50%" })
			})
			it("should not interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).not.toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 500)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		describe("when width and height are passed in style prop as numbers", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart style={{ height: 200, width: 600 }} responsive={responsive} data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with given width and height", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "600")
				expect(svg).toHaveAttribute("height", "200")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({
					height: "200px",
					position: "relative",
					width: "600px",
				})
			})
			it("should not interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).not.toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 600)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 200)
			})
		})
		describe("when width and height are passed in style prop as percentages", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart
					style={{ height: "50%", width: "50%" }}
					responsive={responsive}
					data={PageData}
				>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with dimensions from getBoundingClientRect", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "500")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({ height: "50%", position: "relative", width: "50%" })
			})
			it("should not interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).not.toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 500)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		describe("when width is a prop and height is from style", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart width={600} style={{ height: 200 }} responsive={responsive} data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with combined width and height", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "600")
				expect(svg).toHaveAttribute("height", "200")
			})
		})
	})
	describe("with responsive=true", () => {
		describe("when width and height are not specified", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart responsive data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with dimensions from getBoundingClientRect", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "500")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({ position: "relative" })
			})
			it("should subscribe to ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).toHaveBeenCalled()
			})
			it("should unsubscribe from ResizeObserver on unmount", () => {
				const { unmount } = renderTestCase()
				unmount()
				expect(resizeObserverMock.disconnect).toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 500)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		describe("when width and height are numbers", () => {
			beforeEach(() => {
				mockGetBoundingClientRect({ height: 400, width: 600 })
			})
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart width={600} height={400} responsive data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))
			it("should render svg with given width and height", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "600")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({
					height: "400px",
					position: "relative",
					width: "600px",
				})
			})
			it("should interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 600)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		describe("when width and height are percentages", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart width="50%" height="50%" responsive data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with dimensions from getBoundingClientRect", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "500")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({ height: "50%", position: "relative", width: "50%" })
			})
			it("should interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 500)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		it("should resize the chart when the container size changes", () => {
			const ChartSize = () => {
				return (
					<div data-testid="chart-size">{`${useChartWidth()}x${useChartHeight()}`}</div>
				)
			}
			const { container, getByTestId } = render(() => (
				<ComposedChart responsive data={PageData}>
					<Line dataKey="uv" />
					<ChartSize />
				</ComposedChart>
			))

			const svg = container.querySelector("svg")
			expect(svg).toHaveAttribute("width", "500")
			expect(svg).toHaveAttribute("height", "400")
			expect(getByTestId("chart-size").textContent).toBe("500x400")

			resizeObserverCallback([
				{ contentRect: { height: 200, width: 300 } },
			] as ResizeObserverEntry[])

			expect(svg).toHaveAttribute("width", "300")
			expect(svg).toHaveAttribute("height", "200")
			expect(getByTestId("chart-size").textContent).toBe("300x200")
		})
		describe("when width and height are passed in style prop as numbers", () => {
			beforeEach(() => {
				mockGetBoundingClientRect({ height: 100, width: 700 })
			})
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart style={{ height: 100, width: 700 }} responsive data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))
			it("should render svg with given width and height", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "700")
				expect(svg).toHaveAttribute("height", "100")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({
					height: "100px",
					position: "relative",
					width: "700px",
				})
			})
			it("should interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 700)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 100)
			})
		})
		describe("when width and height are passed in style prop as percentages", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart style={{ height: "80%", width: "90%" }} responsive data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))

			it("should render svg with dimensions from getBoundingClientRect", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "500")
				expect(svg).toHaveAttribute("height", "400")
			})
			it("should render wrapper div with width and height", () => {
				const { container } = renderTestCase()
				const wrapperElement = container.querySelector(".recharts-wrapper")
				expect(wrapperElement).toBeInTheDocument()
				expect(wrapperElement).toHaveStyle({ height: "80%", position: "relative", width: "90%" })
			})
			it("should interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).toHaveBeenCalled()
			})
			it("should return the width from useChartWidth", () => {
				const { spy } = renderTestCase(useChartWidth)
				expectLastCalledWith(spy, 500)
			})
			it("should return the height from useChartHeight", () => {
				const { spy } = renderTestCase(useChartHeight)
				expectLastCalledWith(spy, 400)
			})
		})
		it("should resize the chart when the container size changes and size is in style", () => {
			const ChartSize = () => {
				return (
					<div data-testid="chart-size">{`${useChartWidth()}x${useChartHeight()}`}</div>
				)
			}
			const { container, getByTestId } = render(() => (
				<ComposedChart responsive data={PageData} style={{ height: "100%", width: "100%" }}>
					<Line dataKey="uv" />
					<ChartSize />
				</ComposedChart>
			))

			const svg = container.querySelector("svg")
			expect(svg).toHaveAttribute("width", "500")
			expect(svg).toHaveAttribute("height", "400")
			expect(getByTestId("chart-size").textContent).toBe("500x400")

			resizeObserverCallback([
				{ contentRect: { height: 200, width: 300 } },
			] as ResizeObserverEntry[])

			expect(svg).toHaveAttribute("width", "300")
			expect(svg).toHaveAttribute("height", "200")
			expect(getByTestId("chart-size").textContent).toBe("300x200")
		})
		describe("when width is a prop and height is from style", () => {
			beforeEach(() => {
				mockGetBoundingClientRect({ height: 200, width: 600 })
			})
			const renderTestCase = createSelectorTestCase((props) => (
				<ComposedChart width={600} style={{ height: 200 }} responsive data={PageData}>
					<Line dataKey="uv" />
					{props.children}
				</ComposedChart>
			))
			it("should render svg with combined width and height", () => {
				const { container } = renderTestCase()
				const svg = container.querySelector("svg")
				expect(svg).not.toBeNull()
				expect(svg).toHaveAttribute("width", "600")
				expect(svg).toHaveAttribute("height", "200")
			})
			it("should interact with ResizeObserver", () => {
				renderTestCase()
				expect(resizeObserverMock.observe).toHaveBeenCalled()
			})
		})
	})
	describe("Edge cases", () => {
		describe("when width and height are zero", () => {
			it("should not render an svg", () => {
				const { container } = render(() => (
					<ComposedChart width={0} height={0} data={PageData}>
						<Line dataKey="uv" />
					</ComposedChart>
				))
				expect(container.querySelector("svg")).toBeNull()
			})
		})
		describe("when width and height are negative", () => {
			it("should not render an svg", () => {
				const { container } = render(() => (
					<ComposedChart width={-100} height={-100} data={PageData}>
						<Line dataKey="uv" />
					</ComposedChart>
				))
				expect(container.querySelector("svg")).toBeNull()
			})
		})
	})
	describe("Interaction with ResponsiveContainer", () => {
		it("should prioritize dimensions from ResponsiveContainer over its own props", () => {
			const { container } = render(() => (
				<ResponsiveContainer width={800} height={600}>
					<ComposedChart width={100} height={100} data={PageData}>
						<Line dataKey="uv" />
					</ComposedChart>
				</ResponsiveContainer>
			))
			const svg = container.querySelector("svg")
			expect(svg).not.toBeNull()
			expect(svg).toHaveAttribute("width", "800")
			expect(svg).toHaveAttribute("height", "600")
		})
	})
})
