/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource @solidjs/web */
import { describe, expect, it, vi } from "vitest"
import { useContext, untrack, flush } from 'solid-js';
import { Radar, RadarChart } from "../../src"
import { exampleRadarData } from "../_data"
import { renderWithSignals } from "../helper/renderWithSignals"
import { RechartsStoreContext } from "../../src/state/RechartsStoreContext"
import { selectTooltipState } from "../../src/state/selectors/selectTooltipState"
import { assertNotNull } from "../helper/assertNotNull"
import type { ChartState } from "../../src/state/store"

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
 * The first group verifies initial-mount population; the second verifies that a post-mount
 * dataKey change reaches both the tooltip entry and the rendered labels.
 */

function StoreCapture(props: { ref: (store: ChartState) => void }): null {
	const ctx = untrack(() => useContext(RechartsStoreContext))
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
		let store: ChartState | undefined

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
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("cost")
	})

	/*
	 * name is populated correctly at mount.
	 */
	it("SetRadarTooltipEntrySettings populates name correctly at mount", () => {
		let store: ChartState | undefined

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
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.name).toBe("Series Alpha")
	})

	/*
	 * fill is populated correctly at mount.
	 */
	it("SetRadarTooltipEntrySettings populates fill correctly at mount", () => {
		let store: ChartState | undefined

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
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.fill).toBe("#abcdef")
	})

	/*
	 * hide=true is populated correctly at mount.
	 */
	it("SetRadarTooltipEntrySettings populates hide=true correctly at mount", () => {
		let store: ChartState | undefined

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
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.hide).toBe(true)
	})

	/*
	 * stroke is populated correctly at mount.
	 * getLegendItemColor prefers stroke over fill — changing stroke changes
	 * both the color and stroke fields.
	 */
	it("SetRadarTooltipEntrySettings populates stroke correctly at mount", () => {
		let store: ChartState | undefined

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
		flush()
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
		let store: ChartState | undefined

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
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("cost")
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.name).toBe("Labeled Series")
	})
})

describe("Radar — post-mount dataKey updates", () => {
	it("SetRadarTooltipEntrySettings replaces the entry when dataKey changes", () => {
		let store: ChartState | undefined

		const { update } = renderWithSignals(
			(p: { dataKey: string }) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey={p.dataKey} isAnimationActive={false} />
					<StoreCapture ref={(s) => { store = s }} />
				</RadarChart>
			),
			{ dataKey: "value" },
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("value")

		update({ dataKey: "half" })
		flush()
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("half")
	})

	it("RadarLabelListProvider shows the new values in the label DOM when dataKey changes", () => {
		const { container, update } = renderWithSignals(
			(p: { dataKey: string }) => (
				<RadarChart width={400} height={400} data={exampleRadarData}>
					<Radar dataKey={p.dataKey} isAnimationActive={false} label />
				</RadarChart>
			),
			{ dataKey: "value" },
		)

		const labelTexts = () =>
			Array.from(container.querySelectorAll(".recharts-label")).map((el) => el.textContent)

		expect(labelTexts()).toEqual(exampleRadarData.map((d) => String(d.value)))

		update({ dataKey: "half" })
		flush()
		expect(labelTexts()).toEqual(exampleRadarData.map((d) => String(d.half)))
	})
})
