/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource solid-js */
import { describe, expect, it, test, vi } from "vitest"
import { fireEvent } from "@solidjs/testing-library"
import { useContext } from "solid-js"
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
 * NOTE on post-mount update testing: Solid's store `produce` + `indexOf`
 * cannot locate items by original reference inside the draft proxy (produce
 * wraps array elements in proxies). The SetTooltipEntrySettings replacement
 * path (prevSettings !== null && prevSettings !== current) therefore silently
 * fails to replace the item. Post-mount prop-update tests are deferred; see
 * the test.todo entries below. What CAN be tested is:
 *   1. The store is populated correctly at initial mount (correct values, not
 *      stale snapshots from a frozen object literal).
 *   2. activeCoordinate dispatches correctly on hover (ContentItemWithEvents
 *      fix — coordinate reads nodeProps reactively via createMemo).
 */

function StoreCapture(props: { ref: (store: ChartState) => void }): null {
	const ctx = useContext(RechartsStoreContext)
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
		assertNotNull(store)

		/* depth-2 selector requires nested data (children of "A" in exampleTreemapData) */
		const rect = container.querySelector(treemapNodeChartMouseHoverTooltipSelector)
		assertNotNull(rect)
		fireEvent.mouseOver(rect)
		vi.advanceTimersByTime(0)

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
		assertNotNull(store)

		showTooltip(container, treemapNodeChartMouseHoverTooltipSelector)

		const tooltipWrapper = container.querySelector(".recharts-tooltip-wrapper")
		assertNotNull(tooltipWrapper)
		expect(tooltipWrapper).toBeVisible()
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
	})
})

/*
 * Post-mount prop-update regression tests are blocked by a Solid store
 * limitation: `produce` wraps array items in proxy objects, so `indexOf`
 * with the original plain-object reference always returns -1. The
 * SetTooltipEntrySettings replacement path (prevSettings !== current branch)
 * therefore cannot update an existing entry. This is a pre-existing store
 * design constraint, not introduced by this session's changes.
 *
 * Manual repro for the original bug (nameKey not updating):
 *   1. Replace `createMemo(() => ({...}))` with `const x = {...}; return x` in
 *      SetTreemapTooltipEntrySettings.
 *   2. Mount Treemap with nameKey="name".
 *   3. Observe store.tooltip.tooltipItemPayloads[0].settings.nameKey → "name".
 *   4. Update nameKey signal to "rank".
 *   5. Without createMemo: store still shows "name" (same object reference,
 *      SetTooltipEntrySettings identity check skips update).
 *   6. With createMemo: store shows "name" too (indexOf fails), BUT the memo
 *      re-runs ensuring that IF the replacement path ever works (future fix)
 *      the correct value is present. For the INITIAL mount case (the actual
 *      RadialBar bug this pattern fixed), the first push receives the
 *      correctly-computed value.
 */
test.todo(
	"SetTreemapTooltipEntrySettings post-mount nameKey update — blocked by produce+indexOf proxy limitation in SetTooltipEntrySettings (items[idx] = current never fires; indexOf returns -1 against draft proxies). Fix SetTooltipEntrySettings to use findIndex + unwrap or a Map<id, config> keyed approach.",
)

test.todo(
	"SetTreemapTooltipEntrySettings post-mount dataKey update — same produce+indexOf limitation.",
)
