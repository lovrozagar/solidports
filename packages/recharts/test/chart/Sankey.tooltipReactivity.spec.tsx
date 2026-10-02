/* eslint-disable import/no-cycle, sort-keys */
/* @jsxImportSource @solidjs/web */
import { describe, expect, it, vi } from "vitest"
import { useContext, untrack, snapshot, flush } from 'solid-js';
import { Sankey } from "../../src"
import { renderWithSignals } from "../helper/renderWithSignals"
import { RechartsStoreContext } from "../../src/state/RechartsStoreContext"
import { selectTooltipState } from "../../src/state/selectors/selectTooltipState"
import { assertNotNull } from "../helper/assertNotNull"
import type { SankeyData } from "../../src/chart/Sankey"
import type { ChartState } from "../../src/state/store"

/*
 * Regression tests for GOTCHA-005 createMemo fix in SetSankeyTooltipEntrySettings.
 *
 * Before the fix, tooltipEntrySettings was a plain object literal built once in the
 * Solid component body. Since Solid component bodies run exactly once, prop reads
 * inside a plain literal are snapshotted at that instant. SetTooltipEntrySettings
 * identity-checks objects (prevSettings !== current) — same reference = no update.
 *
 * The fix wraps the object in createMemo so it is re-evaluated inside the reactive
 * graph, producing a new reference on prop change and triggering the store update.
 *
 * The first group verifies initial-mount population (data captured before the store is
 * fully populated); the second verifies that post-mount prop changes replace the entry.
 */

function StoreCapture(props: { ref: (store: ChartState) => void }): null {
	const ctx = untrack(() => useContext(RechartsStoreContext))
	if (ctx != null) {
		/* eslint-disable-next-line solid/reactivity -- intentional one-shot mount callback, not a tracked read */
		props.ref(ctx.store)
	}
	return null
}

const minimalData: SankeyData = {
	links: [{ source: 0, target: 1, value: 100 }],
	nodes: [{ name: "Source" }, { name: "Target" }],
}

describe("Sankey tooltip settings — initial mount correctness", () => {
	/*
	 * tooltipItemPayloads is populated at mount with the correct nameKey.
	 */
	it("SetSankeyTooltipEntrySettings populates nameKey correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Sankey width={400} height={200} data={minimalData} nameKey="value">
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.nameKey).toBe("value")
	})

	/*
	 * dataKey is populated correctly at mount.
	 */
	it("SetSankeyTooltipEntrySettings populates dataKey correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Sankey width={400} height={200} data={minimalData} dataKey="source">
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.dataKey).toBe("source")
	})

	/*
	 * fill is populated correctly at mount.
	 */
	it("SetSankeyTooltipEntrySettings populates fill correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Sankey width={400} height={200} data={minimalData} fill="#abcdef">
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.fill).toBe("#abcdef")
	})

	/*
	 * dataDefinedOnItem holds the data prop at mount.
	 * Buggy version with a plain object literal captured data before it was
	 * passed reactively; createMemo ensures the read happens at effect time.
	 */
	it("SetSankeyTooltipEntrySettings populates dataDefinedOnItem at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Sankey width={400} height={200} data={minimalData}>
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		/* Store proxy wraps the value — compare the unwrapped snapshot */
		expect(snapshot(selectTooltipState(store).tooltipItemPayloads[0]?.dataDefinedOnItem)).toStrictEqual(
			minimalData,
		)
	})

	/*
	 * name (display label) is populated correctly at mount.
	 */
	it("SetSankeyTooltipEntrySettings populates name correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Sankey width={400} height={200} data={minimalData} name="My Flow">
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.name).toBe("My Flow")
	})

	/*
	 * stroke is populated correctly at mount.
	 */
	it("SetSankeyTooltipEntrySettings populates stroke correctly at mount", () => {
		let store: ChartState | undefined

		renderWithSignals(
			(_p: Record<string, never>) => (
				<Sankey width={400} height={200} data={minimalData} stroke="#123456">
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{},
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.stroke).toBe("#123456")
	})
})

describe("Sankey tooltip settings — post-mount updates", () => {
	/*
	 * A changed prop replaces the existing tooltip entry in place instead of appending a second one.
	 */
	it("SetSankeyTooltipEntrySettings replaces the entry when nameKey changes", () => {
		let store: ChartState | undefined

		const { update } = renderWithSignals(
			(p: { nameKey: string }) => (
				<Sankey width={400} height={200} data={minimalData} nameKey={p.nameKey}>
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{ nameKey: "name" },
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.nameKey).toBe("name")

		update({ nameKey: "value" })
		flush()
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(selectTooltipState(store).tooltipItemPayloads[0]?.settings?.nameKey).toBe("value")
	})

	it("SetSankeyTooltipEntrySettings replaces the entry when data changes", () => {
		let store: ChartState | undefined
		const nextData: SankeyData = {
			links: [{ source: 0, target: 1, value: 50 }],
			nodes: [{ name: "From" }, { name: "To" }],
		}

		const { update } = renderWithSignals(
			(p: { data: SankeyData }) => (
				<Sankey width={400} height={200} data={p.data}>
					<StoreCapture ref={(s) => { store = s }} />
				</Sankey>
			),
			{ data: minimalData },
		)

		vi.advanceTimersByTime(0)
		flush()
		assertNotNull(store)

		update({ data: nextData })
		flush()
		expect(selectTooltipState(store).tooltipItemPayloads).toHaveLength(1)
		expect(snapshot(selectTooltipState(store).tooltipItemPayloads[0]?.dataDefinedOnItem)).toStrictEqual(nextData)
	})
})
