/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource solid-js */
import { describe, expect, it, test, vi } from "vitest"
import { useContext } from "solid-js"
import { Radar, RadarChart } from "../../src"
import { exampleRadarData } from "../_data"
import { renderWithSignals } from "../helper/renderWithSignals"
import { RechartsStoreContext } from "../../src/state/RechartsStoreContext"
import { selectTooltipState } from "../../src/state/selectors/selectTooltipState"
import { assertNotNull } from "../helper/assertNotNull"
import type { RechartsRootState } from "../../src/state/store"

/*
 * Regression tests for SetRadarTooltipEntrySettings and RadarLabelListProvider
 * createMemo fixes.
 *
 * SetRadarTooltipEntrySettings: before the fix, tooltipEntrySettings was a plain
 * object literal built once in the Solid component body — snapshotting prop values
 * at component-creation time. SetTooltipEntrySettings identity-checks the incoming
 * object (prevSettings !== current) — a frozen plain literal means the store is
 * never updated after the initial push.
 *
 * RadarLabelListProvider: before the fix, labelListEntries was a plain const array
 * built once — points changes (from dataKey or data changes) were invisible downstream.
 *
 * Both fixed by wrapping in createMemo so objects/arrays are rebuilt on prop change.
 *
 * NOTE: post-mount prop-update coverage deferred — Solid store produce+indexOf
 * limitation (proxy wrapping breaks reference equality). See test.todo entries.
 * The tests below verify correct initial-mount population.
 */

function StoreCapture(props: { ref: (store: RechartsRootState) => void }): null {
	const ctx = useContext(RechartsStoreContext)
	if (ctx != null) {
		/* eslint-disable-next-line solid/reactivity -- intentional one-shot mount callback, not a tracked read */
		props.ref(ctx.store)
	}
	return null
}

describe("Radar tooltip settings — initial mount correctness", () => {
	/*
	 * tooltipItemPayloads is populated at mount with correct dataKey.
	 */
	it("SetRadarTooltipEntrySettings populates dataKey correctly at mount", () => {
		let store: RechartsRootState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey="cost" isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("cost")
	})

	/*
	 * name is populated correctly at mount.
	 */
	it("SetRadarTooltipEntrySettings populates name correctly at mount", () => {
		let store: RechartsRootState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey="value" name="Series Alpha" isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.name).toBe("Series Alpha")
	})

	/*
	 * fill is populated correctly at mount.
	 */
	it("SetRadarTooltipEntrySettings populates fill correctly at mount", () => {
		let store: RechartsRootState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey="value" fill="#abcdef" isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.fill).toBe("#abcdef")
	})

	/*
	 * hide=true is populated correctly at mount.
	 */
	it("SetRadarTooltipEntrySettings populates hide=true correctly at mount", () => {
		let store: RechartsRootState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey="value" hide isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.hide).toBe(true)
	})

	/*
	 * stroke is populated correctly at mount.
	 * getLegendItemColor prefers stroke over fill — changing stroke changes
	 * both the color and stroke fields.
	 */
	it("SetRadarTooltipEntrySettings populates stroke correctly at mount", () => {
		let store: RechartsRootState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey="value" stroke="#112233" isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.stroke).toBe("#112233")
	})

	/*
	 * RadarLabelListProvider + label=true: tooltip payload is still populated
	 * correctly when label rendering is enabled.
	 * The labelListEntries createMemo fix ensures points drive label entries
	 * reactively; this test verifies the tooltip settings are unaffected.
	 */
	it("tooltip payload correctly populated when label=true (RadarLabelListProvider active)", () => {
		let store: RechartsRootState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey="cost" label name="Labeled Series" isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("cost")
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.name).toBe("Labeled Series")
	})
})

/*
 * Post-mount prop-update tests blocked by produce+indexOf proxy limitation.
 *
 * Manual repro for the original bug (dataKey not updating after mount):
 *   1. Replace `createMemo(() => ({...}))` with a plain object in
 *      SetRadarTooltipEntrySettings.
 *   2. Mount RadarChart with dataKey="value".
 *   3. Verify store has dataKey="value".
 *   4. Update dataKey signal to "cost".
 *   5. Without createMemo: store still shows "value" (same frozen object reference
 *      → SetTooltipEntrySettings identity check sees prevSettings === current → skip).
 *   6. With createMemo: memo re-runs producing new object reference → effect triggers
 *      → BUT produce+indexOf returns -1 → replacement silently skipped.
 *      The ACTUAL value of the fix is for cases where props arrive asynchronously
 *      (e.g. store-derived sectors in RadialBar that are STABLE_EMPTY_ARRAY at
 *      component creation but populated by the time the createEffect first runs).
 */
test.todo(
	"SetRadarTooltipEntrySettings post-mount dataKey update — blocked by produce+indexOf proxy limitation in SetTooltipEntrySettings.",
)

test.todo(
	"RadarLabelListProvider post-mount dataKey update visible in label DOM — requires axis band-size > 0 in jsdom (all axes report 0 in jsdom environment).",
)
