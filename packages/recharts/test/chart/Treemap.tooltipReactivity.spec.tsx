/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource @solidjs/web */
import { describe, expect, it, vi } from "vitest"
import { fireEvent } from "../helper/render"
import { useContext, untrack, flush } from 'solid-js';
import { Tooltip, Treemap } from "../../src"
import { exampleTreemapData } from "../_data"
import { renderWithSignals } from "../helper/renderWithSignals"
import { RechartsStoreContext } from "../../src/state/RechartsStoreContext"
import { selectTooltipState } from "../../src/state/selectors/selectTooltipState"
import { selectActiveTooltipCoordinate } from "../../src/state/selectors/tooltipSelectors"
import { assertNotNull } from "../helper/assertNotNull"
import { showTooltip } from "../component/Tooltip/tooltipTestHelpers"
import { treemapNodeChartMouseHoverTooltipSelector } from "../component/Tooltip/tooltipMouseHoverSelectors"
import type { ChartState } from "../../src/state/store"

/*
 * Regression tests for GOTCHA-005 createMemo fix in Treemap.
 *
 * SetTreemapTooltipEntrySettings and ContentItemWithEvents both built plain
 * object literals in the component body. In Solid, the component body runs
 * ONCE at mount synchronously. A plain object literal snapshots prop values
 * at that instant. Since SetTooltipEntrySettings identity-checks incoming
 * objects (prevSettings !== current) to decide whether to update the store,
 * a frozen plain object whose reference never changes means the store is
 * never updated after the first push.
 *
 * The fix wraps both in createMemo so the object is built inside the Solid
 * reactive graph — re-evaluated whenever tracked props change — producing a
 * new reference that triggers the store update path.
 *
 * Covered here:
 *   1. The store is populated correctly at initial mount (correct values, not
 *      stale snapshots from a frozen object literal).
 *   2. activeCoordinate dispatches correctly on hover (ContentItemWithEvents
 *      fix — coordinate reads nodeProps reactively via createMemo).
 *   3. Post-mount prop changes replace the tooltip entry in place.
 */

function StoreCapture(props: { ref: (store: ChartState) => void }): null {
	const ctx = untrack(() => useContext(RechartsStoreContext))
	if (ctx != null) {
		/* eslint-disable-next-line solid/reactivity -- intentional one-shot mount callback, not a tracked read */
		props.ref(ctx.store)
	}
	return null
}

describe("Treemap tooltip settings — initial mount correctness", () => {
	/*
	 * tooltipItemPayloads is populated at mount with correct nameKey.
	 * Verifies the createMemo settings object is built and pushed to the store.
	 */
	it("SetTreemapTooltipEntrySettings populates nameKey correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Treemap
					width={500}
					height={250}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey="rank"
					dataKey="value"
				>
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.nameKey).toBe("rank")
	})

	/*
	 * dataKey is populated correctly at mount.
	 */
	it("SetTreemapTooltipEntrySettings populates dataKey correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Treemap
					width={500}
					height={250}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey="name"
					dataKey="rank"
				>
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("rank")
	})

	/*
	 * fill is populated correctly at mount.
	 */
	it("SetTreemapTooltipEntrySettings populates fill correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Treemap
					width={500}
					height={250}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey="name"
					dataKey="value"
					fill="#ff0000"
				>
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.fill).toBe("#ff0000")
	})

	/*
	 * dataDefinedOnItem holds a non-undefined currentRoot at mount.
	 * Buggy version with a plain object literal evaluated before the root
	 * signal is populated would capture undefined.
	 */
	it("SetTreemapTooltipEntrySettings populates dataDefinedOnItem at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Treemap
					width={500}
					height={250}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey="name"
					dataKey="value"
				>
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		/* currentRoot is computed from data; with createMemo it reflects the populated root. */
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.dataDefinedOnItem).not.toBe(undefined)
	})

	/*
	 * ContentItemWithEvents.activeCoordinate dispatches a valid non-zero coordinate
	 * when a node is hovered. The fix ensures coordinate reads nodeProps.x/y via
	 * createMemo rather than a plain object snapshotted at component body run time.
	 */
	it("ContentItemWithEvents dispatches valid activeCoordinate on hover", () => {
		let store: ChartState | undefined

		const { container } = renderWithSignals(
			(_p: Record<string, never>) => (
				<Treemap
					width={500}
					height={250}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey="name"
					dataKey="value"
				>
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)

		/* depth-2 selector requires nested data (children of "A" in exampleTreemapData) */
		const rect = container.querySelector(treemapNodeChartMouseHoverTooltipSelector)
		assertNotNull(rect)
		fireEvent.mouseOver(rect)
		vi.advanceTimersByTime(0)
		flush()

		const coord = selectActiveTooltipCoordinate(store)
		assertNotNull(coord)
		expect(coord.x).toBeGreaterThan(0)
		expect(coord.y).toBeGreaterThan(0)
	})

	/*
	 * Tooltip is visible on hover and the payload includes one item.
	 */
	it("tooltip is visible on hover and payload is populated", () => {
		let store: ChartState | undefined

		const { container } = renderWithSignals(
			(_p: Record<string, never>) => (
				<Treemap
					width={1000}
					height={500}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey="name"
					dataKey="value"
				>
					<Tooltip trigger="hover" />
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)

		showTooltip(container, treemapNodeChartMouseHoverTooltipSelector)

		const tooltipWrapper = container.querySelector(".recharts-tooltip-wrapper")
		assertNotNull(tooltipWrapper)
		expect(tooltipWrapper).toBeVisible()
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
	})
})

describe("Treemap tooltip settings — post-mount updates", () => {
	/*
	 * A changed prop rebuilds the settings memo, and SetTooltipEntrySettings replaces the
	 * existing entry in place instead of appending a second one.
	 */
	it.each([
		["nameKey", { nameKey: "name", dataKey: "value" }, { nameKey: "rank", dataKey: "value" }],
		["dataKey", { nameKey: "name", dataKey: "value" }, { nameKey: "name", dataKey: "rank" }],
	] as const)("SetTreemapTooltipEntrySettings replaces the entry when %s changes", (key, initial, next) => {
		let store: ChartState | undefined

		const { update } = renderWithSignals(
			(p: { nameKey: string; dataKey: string }) => (
				<Treemap
					width={500}
					height={250}
					data={exampleTreemapData}
					isAnimationActive={false}
					nameKey={p.nameKey}
					dataKey={p.dataKey}
				>
					<StoreCapture ref={(s) => { store = s }} />
				</Treemap>
			),
			{ ...initial },
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.[key]).toBe(initial[key])

		update({ ...next })
		flush()
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.[key]).toBe(next[key])
	})
})
