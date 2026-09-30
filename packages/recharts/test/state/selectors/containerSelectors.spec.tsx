import { describe, expect, it, vi } from "vitest"
import { createEffect, createSignal } from "solid-js"
import { render } from "@solidjs/testing-library"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import { useAppSelector } from "../../helper/legacyDispatch"
import { setChartSize, setScale } from "../../../src/state/layoutSlice"
import {
	selectChartHeight,
	selectChartWidth,
	selectContainerScale,
	selectMargin,
} from "../../../src/state/selectors/containerSelectors"
import { createRechartsStore } from "../../../src/state/store"
import { BarChart, ComposedChart, Customized } from "../../../src"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
} from "../../helper/selectorTestHelpers"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { mockHTMLElementProperty } from "../../helper/mockHTMLElementProperty"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"

describe("selectContainerScale", () => {
	shouldReturnUndefinedOutOfContext(selectContainerScale)
	shouldReturnFromInitialState(selectContainerScale, 1)

	it("should return 1 in an initial state", () => {
		const store = createRechartsStore()
		expect(selectContainerScale(store.getState())).toBe(1)
	})

	it("should return scale after it was set using an action", () => {
		const store = createRechartsStore()
		store.dispatch(setScale(1.25))
		expect(selectContainerScale(store.getState())).toBe(1.25)
	})

	it("should return scale as the ratio of DOMRect / offsetWidth", () => {
		/*
     * This is a little bit of a case of "trust me" because:
     * jsdom returns zeroes everywhere so that doesn't test anything
     * and the browser spec is everything, so I went and tested it in Firefox version 126.0
     * In a browser devtools I select arbitrary element and run:
     *
        console.table({
         "getBoundingClientRect().width": $0.getBoundingClientRect().width,
         offsetWidth: $0.offsetWidth,
         scale: $0.getBoundingClientRect().width / $0.offsetWidth
        })
     *
     * This shows rect: 100, offsetWidth: 100, scale: 1
     * Then I went and changed the `scale` CSS property to 1.5 using devtools and
     * run the console.log again, and this time it shows
     * rect: 150, offsetWidth: 100, scale: 1.5
     * So there we go.
     */
		mockGetBoundingClientRect(
			{
				height: 4,
				width: 3,
				x: 1,
				y: 2,
			},
			false,
		)
		mockHTMLElementProperty("offsetWidth", 5)
		const renderTestCase = createSelectorTestCase((props) => (
			<ComposedChart width={5} height={6}>
				{props.children}
			</ComposedChart>
		))
		const { spy } = renderTestCase(selectContainerScale)
		expectLastCalledWith(spy, 3 / 5)
	})

	it("should return scale: 1 in jsdom because jsdom returns zeroes everywhere", () => {
		/*
		 * This is a little bit of optimization for the test environment
		 * but without this fix, like half of the tests start throwing an error.
		 * Perhaps instead we should enforce mocking proper DOMRect
		 * on the container, in all tests,
		 * but for now this workaround is easier and doesn't hurt anyone.
		 */
		const renderTestCase = createSelectorTestCase((props) => (
			<ComposedChart width={5} height={6}>
				{props.children}
			</ComposedChart>
		))
		const { spy } = renderTestCase(selectContainerScale)
		expectLastCalledWith(spy, 1)
	})
})

describe("selectMargin", () => {
	shouldReturnUndefinedOutOfContext(selectMargin)
	shouldReturnFromInitialState(selectMargin, {
		bottom: 5,
		left: 5,
		right: 5,
		top: 5,
	})

	it("should return margin from root chart props, and update it when props change", () => {
		const marginSpy = vi.fn()
		const Comp = (): null => {
			createEffect(() => marginSpy(useAppSelector(selectMargin)))
			return null
		}
		const [margin, setMargin] = createSignal({ bottom: 10, left: 10, right: 10, top: 10 })
		render(() => (
			<BarChart margin={margin()} width={500} height={300}>
				<Customized component={<Comp />} />
			</BarChart>
		))
		expect(marginSpy).toHaveBeenLastCalledWith({
			bottom: 10,
			left: 10,
			right: 10,
			top: 10,
		})

		setMargin({ bottom: 20, left: 20, right: 20, top: 20 })
		expect(marginSpy).toHaveBeenLastCalledWith({
			bottom: 20,
			left: 20,
			right: 20,
			top: 20,
		})
	})
})

describe("selectChartWidth", () => {
	shouldReturnUndefinedOutOfContext(selectChartWidth)
	shouldReturnFromInitialState(selectChartWidth, 0)

	it("should return width when set from action", () => {
		const store = createRechartsStore()
		store.dispatch(setChartSize({ height: 300, width: 500 }))
		expect(selectChartWidth(store.getState())).toBe(500)
	})

	it("should return width from root chart props, and update it when props change", () => {
		const widthSpy = vi.fn()
		const Comp = (): null => {
			createEffect(() => widthSpy(useAppSelector(selectChartWidth)))
			return null
		}
		const [width, setWidth] = createSignal(500)
		render(() => (
			<BarChart width={width()} height={300}>
				<Customized component={<Comp />} />
			</BarChart>
		))
		expect(widthSpy).toHaveBeenLastCalledWith(500)

		setWidth(600)
		expect(widthSpy).toHaveBeenLastCalledWith(600)
	})
})

describe("selectChartHeight", () => {
	shouldReturnUndefinedOutOfContext(selectChartHeight)
	shouldReturnFromInitialState(selectChartHeight, 0)

	it("should return height when set from action", () => {
		const store = createRechartsStore()
		store.dispatch(setChartSize({ height: 300, width: 500 }))
		expect(selectChartHeight(store.getState())).toBe(300)
	})

	it("should return height from root chart props, and update it when props change", () => {
		const heightSpy = vi.fn()
		const Comp = (): null => {
			createEffect(() => heightSpy(useAppSelector(selectChartHeight)))
			return null
		}
		const [height, setHeight] = createSignal(300)
		render(() => (
			<BarChart width={500} height={height()}>
				<Customized component={<Comp />} />
			</BarChart>
		))
		expect(heightSpy).toHaveBeenLastCalledWith(300)

		setHeight(400)
		expect(heightSpy).toHaveBeenLastCalledWith(400)
	})
})
