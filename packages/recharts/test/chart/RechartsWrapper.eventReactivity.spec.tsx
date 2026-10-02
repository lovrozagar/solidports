/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource @solidjs/web */
import { describe, expect, it, vi } from "vitest"
import { flush } from "solid-js"
import { fireEvent } from "../helper/render"
import { BarChart } from "../../src"
import { renderWithSignals } from "../helper/renderWithSignals"
import { assertNotNull } from "../helper/assertNotNull"

/*
 * Regression tests for RechartsWrapper event handler reactivity.
 *
 * The fix wrapped every external-event dispatch as:
 *   ctx?.events.handleExternalEvent(e, props.onMouseMove)
 * where props.onMouseMove is read at call-time through the Solid props proxy.
 *
 * Before the fix, some handlers closed over the initial prop value at setup
 * (plain function reference captured once). Swapping the handler via a reactive
 * signal would not take effect — the stale handler kept firing.
 *
 * RechartsWrapper is tested through BarChart since it is the inner
 * implementation detail — every chart wraps it.
 */

describe("RechartsWrapper event handler reactivity", () => {
	/*
	 * onMouseMove: swap handler mid-flight, assert new handler fires.
	 * Without the fix: spyA fires on second move; spyB never called.
	 */
	it("calls the current onMouseMove handler after prop update", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onMouseMove: (e: MouseEvent) => void }) => (
				<BarChart width={400} height={300} onMouseMove={p.onMouseMove} />
			),
			{ onMouseMove: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const wrapper = container.querySelector(".recharts-wrapper")
		assertNotNull(wrapper)

		/* mousemove is rAF-throttled — flush pending timers to trigger the callback */
		fireEvent.mouseMove(wrapper)
		vi.runOnlyPendingTimers()
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)
		expect(spyB).not.toHaveBeenCalled()

		update({ onMouseMove: spyB })
		vi.advanceTimersByTime(0)
		flush()

		fireEvent.mouseMove(wrapper)
		vi.runOnlyPendingTimers()
		flush()

		expect(spyB).toHaveBeenCalledTimes(1)
		/* spyA must NOT have been called a second time */
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * onClick: swap handler, assert new handler fires.
	 */
	it("calls the current onClick handler after prop update", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onClick: (e: MouseEvent) => void }) => (
				<BarChart width={400} height={300} onClick={p.onClick} />
			),
			{ onClick: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const wrapper = container.querySelector(".recharts-wrapper")
		assertNotNull(wrapper)

		fireEvent.click(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)
		expect(spyB).not.toHaveBeenCalled()

		update({ onClick: spyB })
		vi.advanceTimersByTime(0)
		flush()

		fireEvent.click(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyB).toHaveBeenCalledTimes(1)
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * onMouseEnter: swap handler, assert new handler fires.
	 */
	it("calls the current onMouseEnter handler after prop update", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onMouseEnter: (e: MouseEvent) => void }) => (
				<BarChart width={400} height={300} onMouseEnter={p.onMouseEnter} />
			),
			{ onMouseEnter: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const wrapper = container.querySelector(".recharts-wrapper")
		assertNotNull(wrapper)

		fireEvent.mouseEnter(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)
		expect(spyB).not.toHaveBeenCalled()

		update({ onMouseEnter: spyB })
		/* Reset mouseEntered dedupe flag by leaving then re-entering */
		fireEvent.mouseLeave(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		fireEvent.mouseEnter(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyB).toHaveBeenCalledTimes(1)
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * onMouseLeave: swap handler, assert new handler fires.
	 */
	it("calls the current onMouseLeave handler after prop update", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onMouseLeave: (e: MouseEvent) => void }) => (
				<BarChart width={400} height={300} onMouseLeave={p.onMouseLeave} />
			),
			{ onMouseLeave: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const wrapper = container.querySelector(".recharts-wrapper")
		assertNotNull(wrapper)

		/* Enter first so leave can fire */
		fireEvent.mouseEnter(wrapper)
		vi.advanceTimersByTime(0)
		flush()
		fireEvent.mouseLeave(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)
		expect(spyB).not.toHaveBeenCalled()

		update({ onMouseLeave: spyB })
		vi.advanceTimersByTime(0)
		flush()

		/* Enter again so leave can fire */
		fireEvent.mouseEnter(wrapper)
		vi.advanceTimersByTime(0)
		flush()
		fireEvent.mouseLeave(wrapper)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyB).toHaveBeenCalledTimes(1)
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * Removing a handler (undefined) after it was set must stop calls.
	 * Without reactive reads: stale closure keeps calling the removed handler.
	 */
	it("stops calling handler when prop is removed (set to undefined)", () => {
		const spyA = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onMouseMove: ((e: MouseEvent) => void) | undefined }) => (
				<BarChart width={400} height={300} onMouseMove={p.onMouseMove} />
			),
			{ onMouseMove: spyA as ((e: MouseEvent) => void) | undefined },
		)

		vi.advanceTimersByTime(0)
		flush()

		const wrapper = container.querySelector(".recharts-wrapper")
		assertNotNull(wrapper)

		fireEvent.mouseMove(wrapper)
		vi.runOnlyPendingTimers()
		flush()
		expect(spyA).toHaveBeenCalledTimes(1)

		update({ onMouseMove: undefined })
		vi.advanceTimersByTime(0)
		flush()

		fireEvent.mouseMove(wrapper)
		vi.runOnlyPendingTimers()
		flush()

		/* Handler removed — must not be called again */
		expect(spyA).toHaveBeenCalledTimes(1)
	})
})
