import type { CSSProperties } from 'solid-js';
import { observe } from "../helper/observe"
import type { JSX } from '@solidjs/web';
import { createSignal, untrack, flush } from 'solid-js'
import { Mock, MockInstance, vi } from "vitest"
import { render, screen } from "../helper/render"
import { ResponsiveContainer } from "../../src"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"
import { assertNotNull } from "../helper/assertNotNull"
import { useResponsiveContainerContext } from "../../src/component/ResponsiveContainer"

import { mergeProps } from '../../src/util/solid-1-compat';
declare global {
	interface Window {
		ResizeObserver: unknown
	}
}

describe("<ResponsiveContainer />", () => {
	/**
	 * Use this function to simulate a change fired by a window.ResizeObserver
	 * You just need to pass a param with ResizeObserverEntry structure like:
	 *
	 * @link https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry
	 */
	let notifyResizeObserverChange: (arg: unknown) => void,
		consoleWarnSpy: MockInstance<(...args: any[]) => void>,
		resizeObserverMock: Mock<(arg: any) => any>

	beforeEach(() => {
		/**
		 * ResizeObserver is not available, so we have to create a mock to avoid error coming
		 * from `react-resize-detector`.
		 * @link https://github.com/maslianok/react-resize-detector/issues/145
		 *
		 * This mock also allow us to use {@link notifyResizeObserverChange} to fire changes
		 * from inside our test.
		 */
		resizeObserverMock = vi.fn().mockImplementation(function (this: unknown, callback: unknown) {
			notifyResizeObserverChange = (arg: unknown) => {
				;(callback as (arg: unknown) => void)(arg)
				/* The observer callback writes signals; flush like a browser frame would. */
				flush()
			}

			return {
				disconnect: vi.fn(),
				observe: vi.fn(),
				unobserve: vi.fn(),
			}
		})
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((): void => undefined)

		// @ts-expect-error ResizeObserver is not defined in the JSDOM environment
		delete window.ResizeObserver

		window.ResizeObserver = resizeObserverMock
	})

	const DimensionSpy = (_props: { style?: CSSProperties }) => {
		const props = mergeProps({ style: {} as CSSProperties }, _props)
		const ctx = untrack(() => useResponsiveContainerContext())
		return (
			<div
				data-testid="inside"
				style={{
					...props.style,
					height: typeof ctx.height === "number" ? `${ctx.height}px` : ctx.height,
					width: typeof ctx.width === "number" ? `${ctx.width}px` : ctx.width,
				}}
			/>
		)
	}
	it("should not warn on initial render before dimensions are measured", () => {
		mockGetBoundingClientRect({ height: 200, width: 400 })

		render(() => (
			<ResponsiveContainer width="100%" height="100%">
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(consoleWarnSpy).not.toHaveBeenCalled()
	})


	it("Render a wrapper container in ResponsiveContainer", () => {
		const { container } = render(() => (
			<ResponsiveContainer>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).toBeTruthy()

		// should issue a warning since no dimension is set, therefore they are 0
		expect(consoleWarnSpy).toHaveBeenCalled()
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.any(String))
	})

	it("Renders with minHeight and minWidth when provided", () => {
		const { container } = render(() => (
			<ResponsiveContainer minWidth={200} minHeight={100}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).toHaveStyle({
			minHeight: "100px",
			minWidth: "200px",
		})
	})

	it("Renders the component inside", () => {
		render(() => (
			<ResponsiveContainer minWidth={200} minHeight={100}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		notifyResizeObserverChange([{ contentRect: { height: 100, width: 100 } }])

		expect(screen.getByTestId("inside")).toBeInTheDocument()
	})

	it("should ignore height completely if aspect+width are defined", () => {
		render(() => (
			<ResponsiveContainer height={Math.random() * 1000} aspect={2} width={300}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(screen.getByTestId("inside")).toHaveStyle({ height: "150px", width: "300px" })
	})

	it("should calculate width from aspect+height if width=0", () => {
		render(() => (
			<ResponsiveContainer height={300} aspect={2} width={0}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(screen.getByTestId("inside")).toHaveStyle({ height: "300px", width: "600px" })
	})

	// Note that we force height and width here which will trigger a warning.
	// Unfortunately ContainerDimensions does not measure with enzyme
	// so we have to force it to test aspect handling behaviors
	it("Preserves aspect ratio when oversized", () => {
		render(() => (
			<ResponsiveContainer aspect={2} height={100} width={300}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(screen.getByTestId("inside")).toHaveStyle({ height: "150px", width: "300px" })
	})

	it("Preserves aspect ratio when undersized", () => {
		render(() => (
			<ResponsiveContainer aspect={2} height={300} width={100}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(screen.getByTestId("inside")).toHaveStyle({ height: "50px", width: "100px" })
	})

	it("Renders without an id attribute when not passed", () => {
		const { container } = render(() => (
			<ResponsiveContainer>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).not.toHaveAttribute("id")
	})

	it("Renders with id attribute when passed", () => {
		const { container } = render(() => (
			<ResponsiveContainer id="testing-id-attr">
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).toHaveAttribute(
			"id",
			"testing-id-attr",
		)
	})

	it("should resize when ResizeObserver notify a change", () => {
		render(() => (
			<ResponsiveContainer width="100%" height={200}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		notifyResizeObserverChange([{ contentRect: { height: 10, width: 10 } }])

		const testDivBefore = screen.getByTestId("inside")
		assertNotNull(testDivBefore)
		expect(testDivBefore).toHaveStyle({ height: "200px", width: "10px" })

		notifyResizeObserverChange([{ contentRect: { height: 100, width: 100 } }])

		const testDivAfter = screen.getByTestId("inside")
		assertNotNull(testDivAfter)
		expect(testDivAfter).toHaveStyle({ height: "200px", width: "100px" })
	})

	it("should resize when debounced", () => {
		vi.useFakeTimers()
		render(() => (
			<ResponsiveContainer width="100%" height={200} debounce={200}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		notifyResizeObserverChange([{ contentRect: { height: 10, width: 10 } }])
		vi.advanceTimersByTime(300)
		flush()

		const testDivBefore = screen.getByTestId("inside")
		assertNotNull(testDivBefore)
		expect(testDivBefore).toHaveStyle({ height: "200px", width: "10px" })

		notifyResizeObserverChange([{ contentRect: { height: 50, width: 50 } }])

		const testDivInBetween = screen.getByTestId("inside")
		assertNotNull(testDivInBetween)
		// should still be the same since we haven't advanced the timers yet
		expect(testDivInBetween).toHaveStyle({ height: "200px", width: "10px" })

		// advance time by 100ms, should still be the same
		vi.advanceTimersByTime(100)
		flush()
		const testDivAfter100ms = screen.getByTestId("inside")
		assertNotNull(testDivAfter100ms)
		expect(testDivAfter100ms).toHaveStyle({ height: "200px", width: "10px" })

		// advance time by another 100ms (total of 200ms) and now it should resize
		vi.advanceTimersByTime(100)
		flush()
		const testDivAfter = screen.getByTestId("inside")
		assertNotNull(testDivAfter)
		// should have resized now
		expect(testDivAfter).toHaveStyle({ height: "200px", width: "50px" })
	})

	it("should call onResize when ResizeObserver notifies one or many changes", () => {
		const onResize = vi.fn()

		render(() => (
			<ResponsiveContainer width="100%" height={200} onResize={onResize}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		notifyResizeObserverChange([{ contentRect: { height: 100, width: 100 } }])

		expect(onResize).toHaveBeenCalledTimes(1)
		expect(onResize).toHaveBeenLastCalledWith(100, 100)

		notifyResizeObserverChange([{ contentRect: { height: 200, width: 200 } }])

		expect(onResize).toHaveBeenCalledTimes(2)
		expect(onResize).toHaveBeenLastCalledWith(200, 200)
	})

	it("should have a min-width of 0 when no minWidth is set", () => {
		const onResize = vi.fn()

		const { container } = render(() => (
			<ResponsiveContainer width="100%" height={200} onResize={onResize}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		const element = container.querySelector(".recharts-responsive-container")

		expect(element).toHaveStyle({ height: "200px", "min-width": "0px", width: "100%" })
	})

	it("should accept and render the style prop if it is set", () => {
		// looks like the ResponsiveContainer style.color prop converts from string to RGB representation
		// i.e. style.color = 'red' gets converted to rgb(255,0,0)
		// I checked and changing style.color from 'red' to 'blue' changed the resulting style from
		// rgb(255,0,0) to rgb(0,0,255) as expected
		const { container } = render(() => (
			<ResponsiveContainer
				style={{ "background-color": "#FF00FF", color: "red" }}
				data-testid="container"
			>
				<DimensionSpy />
			</ResponsiveContainer>
		))
		const responsiveContainer = container.getElementsByClassName("recharts-responsive-container")
		expect(responsiveContainer).toHaveLength(1)
		expect(responsiveContainer[0]).toHaveStyle("background-color: rgb(255, 0, 255)")
		expect(responsiveContainer[0]).toHaveStyle("color: rgb(255,0,0)")
	})

	it("should accept and render the style prop and any other specified outside of it", () => {
		const { container } = render(() => (
			<ResponsiveContainer
				style={{ "background-color": "red", color: "red" }}
				width="100%"
				height={100}
			>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).toHaveStyle({
			"background-color": "rgb(255,0,0)",
			color: "rgb(255,0,0)",
			height: "100px",
			width: "100%",
		})
	})

	it("should have a min-width of 200px when minWidth is 200", () => {
		const onResize = vi.fn()

		const { container } = render(() => (
			<ResponsiveContainer width="100%" height={200} minWidth={200} onResize={onResize}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		const element = container.querySelector(".recharts-responsive-container")

		expect(element).toHaveStyle({ height: "200px", "min-width": "200px", width: "100%" })
	})

	it("should render multiple children, even when nested", () => {
		const onResize = vi.fn()

		mockGetBoundingClientRect({ height: 200, width: 400 })

		const { container } = render(() => (
			<ResponsiveContainer width="100%" height={200} minWidth={200} onResize={onResize}>
				<div>
					<DimensionSpy style={{ "background-color": "blue" }} />
					<DimensionSpy />
					<DimensionSpy />
					<DimensionSpy />
				</div>
			</ResponsiveContainer>
		))

		const responsiveContainerDiv = container.querySelector(".recharts-responsive-container")
		expect(responsiveContainerDiv).toHaveStyle({
			height: "200px",
			"min-width": "200px",
			width: "100%",
		})

		const elementsInside = screen.getAllByTestId("inside")
		expect(elementsInside).toHaveLength(4)

		// all elements are using the same style besides their own style
		const expectedStyle = {
			height: "200px",
			width: "400px",
		}

		expect(elementsInside[0]).toHaveStyle({
			...expectedStyle,
			"background-color": "rgb(0, 0, 255)",
		})

		expect(elementsInside[1]).toHaveStyle(expectedStyle)
		expect(elementsInside[2]).toHaveStyle(expectedStyle)
		expect(elementsInside[3]).toHaveStyle(expectedStyle)
	})

	it("should not re-create ResizeObserver when onResize function instance changes", () => {
		const onResize1 = vi.fn()
		const onResize2 = vi.fn()
		const [onResize, setOnResize] = createSignal(() => onResize1)
		render(() => (
			<ResponsiveContainer onResize={onResize()}>
				<div />
			</ResponsiveContainer>
		))

		const initialObserverInstance = resizeObserverMock.mock.results[0].value
		expect(initialObserverInstance.disconnect).not.toHaveBeenCalled()
		expect(resizeObserverMock).toHaveBeenCalledTimes(1)

		setOnResize(() => onResize2)
		flush()

		expect(initialObserverInstance.disconnect).not.toHaveBeenCalled()
		expect(resizeObserverMock).toHaveBeenCalledTimes(1)

		notifyResizeObserverChange([{ contentRect: { height: 100, width: 100 } }])

		expect(onResize1).not.toHaveBeenCalled()
		expect(onResize2).toHaveBeenCalledTimes(1)
		expect(onResize2).toHaveBeenCalledWith(100, 100)
	})

	it("should render children straight, without any detector divs, when width and height are both fixed numbers", () => {
		const { container } = render(() => (
			<ResponsiveContainer width={100} height={100}>
				<DimensionSpy />
			</ResponsiveContainer>
		))
		expect(container.querySelector(".recharts-responsive-container")).not.toBeInTheDocument()
		expect(screen.getByTestId("inside")).toHaveStyle({ height: "100px", width: "100px" })
	})

	it("should warn when aspect is not greater than zero", () => {
		render(() => (
			<ResponsiveContainer aspect={-1} width="100%" height={100}>
				<div />
			</ResponsiveContainer>
		))
		expect(consoleWarnSpy).toHaveBeenCalledWith("The aspect(-1) must be greater than zero.")
	})

	it("should respect maxHeight when aspect ratio is used", () => {
		render(() => (
			<ResponsiveContainer aspect={2} width={400} maxHeight={150}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(screen.getByTestId("inside")).toHaveStyle({ height: "150px", width: "400px" })
	})

	it("should not re-render child if container size has not changed", () => {
		const childRenderSpy = vi.fn()
		function Child(): JSX.Element {
			const ctx = untrack(() => useResponsiveContainerContext())
			/* Solid reactivity: createEffect re-fires on size changes; same rounded value memoized at signal level so spy stays at last fire count */
			observe(() => {
				childRenderSpy(ctx.width, ctx.height)
			})
			return null
		}
		render(() => (
			<ResponsiveContainer>
				<Child />
			</ResponsiveContainer>
		))
		notifyResizeObserverChange([{ contentRect: { height: 10, width: 10 } }])

		expect(childRenderSpy).toHaveBeenCalledTimes(1)
		expect(childRenderSpy).toHaveBeenLastCalledWith(10, 10)
		childRenderSpy.mockClear()

		notifyResizeObserverChange([{ contentRect: { height: 100, width: 100 } }])

		expect(childRenderSpy).toHaveBeenCalledTimes(1)
		childRenderSpy.mockClear()

		notifyResizeObserverChange([{ contentRect: { height: 100, width: 100 } }])

		expect(childRenderSpy).not.toHaveBeenCalled()

		// What if size is slightly different but rounds to the same?
		notifyResizeObserverChange([{ contentRect: { height: 100.4, width: 100.4 } }])
		expect(childRenderSpy).not.toHaveBeenCalled()

		// And now with a different rounded value
		notifyResizeObserverChange([{ contentRect: { height: 101, width: 101 } }])
		expect(childRenderSpy).toHaveBeenCalledTimes(1)
	})

	it("should expose container div via forwardRef", () => {
		let capturedRef: HTMLDivElement | undefined
		render(() => (
			<ResponsiveContainer ref={(el) => (capturedRef = el)}>
				<div />
			</ResponsiveContainer>
		))

		expect(capturedRef).toBeInstanceOf(HTMLDivElement)
		expect(capturedRef?.classList.contains("recharts-responsive-container")).toBe(true)
	})

	it("Renders with id attribute when passed as a number", () => {
		const { container } = render(() => (
			<ResponsiveContainer id={123}>
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).toHaveAttribute("id", "123")
	})

	it("Renders with minHeight and minWidth as percentages when provided", () => {
		const { container } = render(() => (
			<ResponsiveContainer minWidth="50%" minHeight="50%">
				<DimensionSpy />
			</ResponsiveContainer>
		))

		expect(container.querySelector(".recharts-responsive-container")).toHaveStyle({
			minHeight: "50%",
			minWidth: "50%",
		})
	})

	it("should render with custom className", () => {
		const { container } = render(() => (
			<ResponsiveContainer className="my-custom-class">
				<div />
			</ResponsiveContainer>
		))
		expect(container.querySelector(".recharts-responsive-container")).toHaveClass("my-custom-class")
	})
})
