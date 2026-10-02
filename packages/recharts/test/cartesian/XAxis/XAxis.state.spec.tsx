import { describe, expect, it, vi } from "vitest"
import { observe } from "../../helper/observe"

import { fireEvent, render } from "../../helper/render"
import { BarChart, Customized, XAxis } from "../../../src"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { useAppSelector } from "../../helper/legacyDispatch"
import {
	implicitXAxis,
	selectRenderableAxisSettings,
	selectRenderedTicksOfAxis,
	selectXAxisSettings,
} from "../../../src/state/selectors/axisSelectors"
import type { TickItem } from "../../../src/util/types"
import { XAxisSettings } from "../../../src/state/cartesianAxisSlice"
import { createSelectorTestCase, rechartsTestRender } from "../../helper/createSelectorTestCase"
import { assertNotNull } from "../../helper/assertNotNull"
import { createSignal } from 'solid-js'
describe("state integration", () => {
	it("should publish its configuration to redux store", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			observe(() => {
				const settings = useAppSelector((state) =>
					selectRenderableAxisSettings(state, "xAxis", "foo"),
				)
				spy(settings)
			})
			return null
		}
		const fakeTickFormatter = () => ""
		const { container } = render(() => (
			<BarChart width={100} height={100}>
				<XAxis
					xAxisId="foo"
					scale="log"
					type="number"
					includeHidden
					ticks={[4, 5, 6]}
					height={31}
					orientation="top"
					mirror
					name="axis name"
					unit="axis unit"
					interval={7}
					angle={13}
					minTickGap={9}
					tick={false}
					tickFormatter={fakeTickFormatter}
				/>
				<Customized component={Comp} />
			</BarChart>
		))
		expect(container.querySelector(".xAxis")).toBeVisible()
		/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(2) */
		const expectedSettings: XAxisSettings = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 13,
			dataKey: undefined,
			domain: undefined,
			height: 31,
			hide: false,
			id: "foo",
			includeHidden: true,
			interval: 7,
			minTickGap: 9,
			mirror: true,
			name: "axis name",
			orientation: "top",
			padding: {
				left: 0,
				right: 0,
			},
			niceTicks: "auto",
			reversed: false,
			scale: "log",
			tick: false,
			tickCount: 5,
			tickFormatter: fakeTickFormatter,
			ticks: [4, 5, 6],
			type: "number",
			unit: "axis unit",
		}
		expectLastCalledWith(spy, expectedSettings)
	})

	it("should remove the configuration from store when DOM element is removed", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			observe(() => {
				const foo = useAppSelector((state) =>
					selectRenderableAxisSettings(state, "xAxis", "foo"),
				)
				const bar = useAppSelector((state) =>
					selectRenderableAxisSettings(state, "xAxis", "bar"),
				)
				spy({ bar, foo })
			})
			return null
		}
		const { rerender } = rechartsTestRender(() => (
			<BarChart width={100} height={100}>
				<XAxis xAxisId="foo" scale="log" type="number" />
				<Customized component={Comp} />
			</BarChart>
		))
		const expectedSettings1: XAxisSettings = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: "foo",
			includeHidden: false,
			interval: "preserveEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom",
			padding: {
				left: 0,
				right: 0,
			},
			niceTicks: "auto",
			reversed: false,
			scale: "log",
			tick: true,
			tickCount: 5,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
		}
		expectLastCalledWith(spy, {
			bar: implicitXAxis,
			foo: expectedSettings1,
		})
		rerender(() => (
			<BarChart width={100} height={100}>
				<XAxis xAxisId="foo" scale="log" type="number" />
				<XAxis xAxisId="bar" scale="utc" type="category" />
				<Customized component={Comp} />
			</BarChart>
		))
		const expectedSettings2: {
			bar: XAxisSettings
			foo: XAxisSettings
		} = {
			bar: {
				allowDataOverflow: false,
				allowDecimals: true,
				allowDuplicatedCategory: true,
				angle: 0,
				dataKey: undefined,
				domain: undefined,
				height: 30,
				hide: false,
				id: "bar",
				includeHidden: false,
				interval: "preserveEnd",
				minTickGap: 5,
				mirror: false,
				name: undefined,
				orientation: "bottom",
				padding: {
					left: 0,
					right: 0,
				},
				niceTicks: "auto",
				reversed: false,
				scale: "utc",
				tick: true,
				tickCount: 5,
				tickFormatter: undefined,
				ticks: undefined,
				type: "category",
				unit: undefined,
			},
			foo: {
				allowDataOverflow: false,
				allowDecimals: true,
				allowDuplicatedCategory: true,
				angle: 0,
				dataKey: undefined,
				domain: undefined,
				height: 30,
				hide: false,
				id: "foo",
				includeHidden: false,
				interval: "preserveEnd",
				minTickGap: 5,
				mirror: false,
				name: undefined,
				orientation: "bottom",
				padding: {
					left: 0,
					right: 0,
				},
				niceTicks: "auto",
				reversed: false,
				scale: "log",
				tick: true,
				tickCount: 5,
				tickFormatter: undefined,
				ticks: undefined,
				type: "number",
				unit: undefined,
			},
		}
		expectLastCalledWith(spy, expectedSettings2)
		rerender(() => (
			<BarChart width={100} height={100}>
				<XAxis xAxisId="bar" scale="utc" type="category" />
				<Customized component={Comp} />
			</BarChart>
		))

		const expectedSettings3: XAxisSettings = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: "bar",
			includeHidden: false,
			interval: "preserveEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom",
			padding: {
				left: 0,
				right: 0,
			},
			niceTicks: "auto",
			reversed: false,
			scale: "utc",
			tick: true,
			tickCount: 5,
			tickFormatter: undefined,
			ticks: undefined,
			type: "category",
			unit: undefined,
		}
		expectLastCalledWith(spy, {
			bar: expectedSettings3,
			foo: implicitXAxis,
		})
		rerender(() => (
			<BarChart width={100} height={100}>
				<Customized component={Comp} />
			</BarChart>
		))

		expectLastCalledWith(spy, {
			bar: implicitXAxis,
			foo: implicitXAxis,
		})
	})

	it("should remove old ID configuration when the ID changes", () => {
		const IDChangingComponent = (props: { children: JSX.Element }) => {
			const [id, setId] = createSignal("1")
			const onClick = () => setId("2")
			return (
				<>
					<button type="button" class="pushbutton" onClick={onClick}>
						Change ID
					</button>
					<BarChart width={100} height={100}>
						<XAxis xAxisId={id()} scale="log" type="number" />
						{props.children}
					</BarChart>
				</>
			)
		}
		const renderTestCase = createSelectorTestCase(IDChangingComponent)

		const { spy, container } = renderTestCase((state) => state.cartesianAxes.xAxis)

		// only id "1" exists
		const lastCallArgs1 = spy.mock.lastCall?.[0]
		assertNotNull(lastCallArgs1)
		expect(Object.keys(lastCallArgs1)).toEqual(["1"])

		fireEvent.click(container.getElementsByClassName("pushbutton")[0])
		/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */

		// only id "2" exists
		const lastCallArgs2 = spy.mock.lastCall?.[0]
		assertNotNull(lastCallArgs2)
		expect(Object.keys(lastCallArgs2)).toEqual(["2"])
	})

	it("should return stable reference when chart re-renders", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={100} height={100}>
				<XAxis xAxisId="foo" scale="log" type="number" />
				{props.children}
			</BarChart>
		))

		const { spy, rerenderSameComponent } = renderTestCase((state) =>
			selectXAxisSettings(state, "foo"),
		)

		const expectedSettings: XAxisSettings = {
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: "foo",
			includeHidden: false,
			interval: "preserveEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom",
			padding: {
				left: 0,
				right: 0,
			},
			niceTicks: "auto",
			reversed: false,
			scale: "log",
			tick: true,
			tickCount: 5,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
		}
		expectLastCalledWith(spy, expectedSettings)

		const firstIdx = spy.mock.calls.length - 1
		rerenderSameComponent()
		expectLastCalledWith(spy, expectedSettings)
		/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */

		/* structural equality per GOTCHA-003 — no reselect memoization in Solid port */
		expect(spy.mock.calls[firstIdx][0]).toEqual(
			spy.mock.calls[spy.mock.calls.length - 1][0],
		)
	})

	it("should not render anything when attempting to render outside of Chart", () => {
		const { container } = render(() => <XAxis dataKey="x" name="stature" unit="cm" />)
		expect(container.querySelectorAll(".recharts-cartesian-axis-line")).toHaveLength(0)
	})

	it("should publish rendered ticks to the store", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={100} height={100} data={[{ x: "x-1" }, { x: "x-2" }, { x: "x-3" }]}>
				<XAxis xAxisId="foo" dataKey="x" />
				{props.children}
			</BarChart>
		))

		const { spy } = renderTestCase((state) => selectRenderedTicksOfAxis(state, "xAxis", "foo"))
		const expectedTicks: ReadonlyArray<TickItem> = [
			{ coordinate: 20, index: 0, offset: 15, value: "x-1" },
			{ coordinate: 50, index: 1, offset: 15, value: "x-2" },
			{ coordinate: 80, index: 2, offset: 15, value: "x-3" },
		]
		expectLastCalledWith(spy, expectedTicks)
	})

	it("should keep rendered ticks referentially stable when re-rendering with unchanged tick values", () => {
		// https://github.com/recharts/recharts/issues/7563
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={100} height={100} data={[{ x: "x-1" }, { x: "x-2" }, { x: "x-3" }]}>
				<XAxis xAxisId="foo" dataKey="x" />
				{props.children}
			</BarChart>
		))

		const { spy, rerenderSameComponent } = renderTestCase((state) =>
			selectRenderedTicksOfAxis(state, "xAxis", "foo"),
		)

		const ticksBefore = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
		assertNotNull(ticksBefore)

		rerenderSameComponent()

		const ticksAfter = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
		expect(ticksAfter).toBe(ticksBefore)
	})
})
