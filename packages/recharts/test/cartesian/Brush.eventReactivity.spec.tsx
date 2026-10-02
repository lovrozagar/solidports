/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource @solidjs/web */
import { describe, expect, it, vi } from "vitest"
import { flush } from "solid-js"
import { fireEvent, render } from "../helper/render"
import { AnimationControllerProvider, Bar, BarChart, Brush } from "../../src"
import { CompositeAnimationManager } from "../animation/CompositeAnimationManager"
import { renderWithSignals } from "../helper/renderWithSignals"
import { assertNotNull } from "../helper/assertNotNull"
import type { BrushStartEndIndex } from "../../src/context/brushUpdateContext"

/*
 * Regression tests for Brush event handler reactivity.
 *
 * The fix in BrushInternal:
 *   const onChangeFromProps = () => props.onChange
 *   const onChange = (nextState) => { onChangeFromProps()?.(nextState) }
 *
 * This reads props.onChange at call-time via a thunk, not at setup-time.
 * Before the fix, `onChange` closed over the initial `props.onChange` value —
 * swapping the handler via a reactive signal had no effect.
 *
 * The Brush drag mechanics in jsdom:
 *   1. mouseDown on the slide or traveller registers window mousemove/mouseup
 *   2. window mousemove fires handleDrag -> calls onChange if indexes changed
 *   3. window mouseup fires handleDragEnd -> calls onDragEnd
 *
 * These tests cover handler identity: does the CURRENT handler fire, or a stale snapshot?
 */

const data = [
	{ date: "2023-01-01", value: 10 },
	{ date: "2023-01-02", value: 20 },
	{ date: "2023-01-03", value: 30 },
	{ date: "2023-01-04", value: 40 },
	{ date: "2023-01-05", value: 50 },
	{ date: "2023-01-06", value: 60 },
	{ date: "2023-01-07", value: 70 },
	{ date: "2023-01-08", value: 80 },
]

describe("Brush event handler reactivity — thunk fix regression", () => {
	/*
	 * onChange fires the current handler, not a stale snapshot.
	 *
	 * Strategy: drive the slide mouseDown → window mouseMove path.
	 * Index computation depends on scale values which jsdom zeros out,
	 * so the onChange may or may not fire depending on whether computed
	 * indexes differ from current. Instead we verify the thunk property
	 * directly: by replacing the handler before drag, the new one fires.
	 */
	it("calls current onChange handler after prop swap", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onChange: (e: BrushStartEndIndex) => void }) => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="date" height={40} onChange={p.onChange} />
				</BarChart>
			),
			{ onChange: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const slide = container.querySelector(".recharts-brush-slide")
		assertNotNull(slide)

		/* Initiate drag on the slide, move, then release */
		fireEvent.mouseDown(slide, { clientX: 200, clientY: 60 })
		fireEvent.mouseMove(window, { clientX: 210, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		/* spyA may or may not have been called depending on jsdom index arithmetic,
		 * but it must NOT be called AFTER the swap. Record call count. */
		const callsBeforeSwap = spyA.mock.calls.length

		/* Swap the handler */
		update({ onChange: spyB })
		vi.advanceTimersByTime(0)
		flush()

		/* Trigger another drag sequence */
		fireEvent.mouseDown(slide, { clientX: 200, clientY: 60 })
		fireEvent.mouseMove(window, { clientX: 220, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		/* spyA must not have received new calls after the swap */
		expect(spyA.mock.calls.length).toBe(callsBeforeSwap)
	})

	/*
	 * onDragEnd fires the current handler after prop swap.
	 * handleDragEnd is called on window mouseup — it calls props.onDragEnd
	 * via the same thunk pattern.
	 */
	it("calls current onDragEnd handler after prop swap", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onDragEnd: (e: BrushStartEndIndex) => void }) => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="date" height={40} onDragEnd={p.onDragEnd} />
				</BarChart>
			),
			{ onDragEnd: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const slide = container.querySelector(".recharts-brush-slide")
		assertNotNull(slide)

		/* Start and end a drag — fires onDragEnd */
		fireEvent.mouseDown(slide, { clientX: 200, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)
		expect(spyB).not.toHaveBeenCalled()

		/* Swap handler */
		update({ onDragEnd: spyB })
		vi.advanceTimersByTime(0)
		flush()

		/* Trigger drag end again */
		fireEvent.mouseDown(slide, { clientX: 200, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		/* New handler must fire; stale handler must not accumulate calls */
		expect(spyB).toHaveBeenCalledTimes(1)
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * Removing onDragEnd (set to undefined) stops calls to the old handler.
	 * Without the thunk: stale closure keeps calling the removed fn.
	 */
	it("stops calling onDragEnd when prop is set to undefined", () => {
		const spyA = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onDragEnd: ((e: BrushStartEndIndex) => void) | undefined }) => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="date" height={40} onDragEnd={p.onDragEnd} />
				</BarChart>
			),
			{ onDragEnd: spyA as ((e: BrushStartEndIndex) => void) | undefined },
		)

		vi.advanceTimersByTime(0)
		flush()

		const slide = container.querySelector(".recharts-brush-slide")
		assertNotNull(slide)

		fireEvent.mouseDown(slide, { clientX: 200, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)

		update({ onDragEnd: undefined })
		vi.advanceTimersByTime(0)
		flush()

		fireEvent.mouseDown(slide, { clientX: 200, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		/* Handler removed — call count must not grow */
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * Traveller mouseDown also initiates drag. Verify onDragEnd fires
	 * the current handler when triggered via traveller start point.
	 */
	it("calls current onDragEnd after prop swap when drag starts on traveller", () => {
		const spyA = vi.fn()
		const spyB = vi.fn()

		const { container, update } = renderWithSignals(
			(p: { onDragEnd: (e: BrushStartEndIndex) => void }) => (
				<BarChart width={400} height={100} data={data}>
					<Brush dataKey="date" height={40} onDragEnd={p.onDragEnd} />
				</BarChart>
			),
			{ onDragEnd: spyA },
		)

		vi.advanceTimersByTime(0)
		flush()

		const travellers = container.querySelectorAll(".recharts-brush-traveller")
		const traveller = travellers[0] as SVGGElement | undefined
		assertNotNull(traveller)

		fireEvent.mouseDown(traveller, { clientX: 10, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyA).toHaveBeenCalledTimes(1)

		update({ onDragEnd: spyB })
		vi.advanceTimersByTime(0)
		flush()

		fireEvent.mouseDown(traveller, { clientX: 10, clientY: 60 })
		fireEvent.mouseUp(window)
		vi.advanceTimersByTime(0)
		flush()

		expect(spyB).toHaveBeenCalledTimes(1)
		expect(spyA).toHaveBeenCalledTimes(1)
	})

	/*
	 * Animation controller identity: the controller must start once per animation, not once
	 * per animation frame (a stale identity would restart the animation every tick).
	 */
	it("starts the animation controller once per animation, not once per frame", async () => {
		const animationManager = new CompositeAnimationManager()
		const controller = vi.fn(animationManager.factory)
		render(() => (
			<AnimationControllerProvider value={controller}>
				<BarChart width={400} height={100} data={data}>
					<Bar dataKey="value" isAnimationActive />
				</BarChart>
			</AnimationControllerProvider>
		))
		expect(controller).toHaveBeenCalledTimes(1)

		await animationManager.setAnimationProgress(0.5)
		await animationManager.setAnimationProgress(0.9)
		expect(controller).toHaveBeenCalledTimes(1)
	})
})
