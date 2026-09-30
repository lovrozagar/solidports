import { describe, expect, it } from "vitest"
import { selectTooltipState } from "../../../src/state/selectors/selectTooltipState"
import { createInitialState } from "../../../src/state/store"
import { createInitialChartState } from "../../../src/state/_solid/chartState"
import type { TooltipInteractionState } from "../../../src/state/tooltipSlice"

const activeInteraction: TooltipInteractionState = {
	active: true,
	coordinate: { x: 100, y: 50 },
	dataKey: undefined,
	graphicalItemId: undefined,
	index: "1",
}

const inactiveInteraction: TooltipInteractionState = {
	active: false,
	coordinate: undefined,
	dataKey: undefined,
	graphicalItemId: undefined,
	index: null,
}

/* Builds a legacy-only state (no _solid) — mimics sacred-test fixture shape. */
function makeLegacyOnlyState() {
	return createInitialState()
}

/* Builds a state with _solid populated. `_solid` is the ChartState proxy reference
   that RechartsStoreProvider wires in at mount. */
function makeStateWithNewTooltip(
	overrides: Partial<ReturnType<typeof createInitialChartState>["tooltip"]> = {},
) {
	const newChartState = createInitialChartState()
	newChartState.tooltip = { ...newChartState.tooltip, ...overrides }
	const state = createInitialState()
	state._solid = newChartState
	return state
}

describe("Phase 5b — selectTooltipState full-merge: new-state-first, legacy fallback", () => {
	it("returns legacy tooltip when _solid is absent", () => {
		/* When no new state context is present (legacy-only mount), selector must
		   return legacy tooltip unchanged. Sacred-test fixture shape. */
		const state = makeLegacyOnlyState()
		state.tooltip.axisInteraction.hover = activeInteraction

		const result = selectTooltipState(state)

		expect(result.axisInteraction.hover.active).toBe(true)
		expect(result.axisInteraction.hover.index).toBe("1")
	})

	it("returns new-state interaction when new axisInteraction.hover is active", () => {
		/* Phase 5b RED: current selectTooltipState ALWAYS uses legacy interaction
		   sub-trees (cherry-pick only does settings + tooltipItemPayloads).
		   After GREEN (D27): when any new-state interaction is active, selector
		   returns new-state axisInteraction. */
		const state = makeStateWithNewTooltip({
			axisInteraction: {
				click: inactiveInteraction,
				hover: activeInteraction,
			},
		})
		/* Legacy store has no active interaction — verifies new state wins */
		state.tooltip.axisInteraction.hover = inactiveInteraction

		const result = selectTooltipState(state)

		/* RED: result.axisInteraction.hover.active is false — selector ignores new state interaction */
		expect(result.axisInteraction.hover.active).toBe(true)
		expect(result.axisInteraction.hover.index).toBe("1")
	})

	it("falls back to legacy interaction when all new-state interactions are inactive", () => {
		/* D27 guard: newInteractionActive=false → spread legacy. Sacred tests drive
		   legacy directly (store.dispatch) without touching new state. */
		const state = makeStateWithNewTooltip()
		/* New state all inactive (default). Legacy has active hover. */
		state.tooltip.axisInteraction.hover = activeInteraction

		const result = selectTooltipState(state)

		/* Must keep legacy active interaction so sacred tests pass unchanged */
		expect(result.axisInteraction.hover.active).toBe(true)
	})

	it("returns new-state itemInteraction when new itemInteraction.hover is active", () => {
		/* Phase 5b RED: itemInteraction always sourced from legacy even when new state
		   has active item hover. After GREEN: new-state-first merge covers itemInteraction. */
		const state = makeStateWithNewTooltip({
			itemInteraction: {
				click: inactiveInteraction,
				hover: {
					...activeInteraction,
					dataKey: "value",
					graphicalItemId: "line-0",
					index: "2",
				},
			},
		})
		state.tooltip.itemInteraction.hover = inactiveInteraction

		const result = selectTooltipState(state)

		/* RED: result.itemInteraction.hover.active is false — new state not used */
		expect(result.itemInteraction.hover.active).toBe(true)
		expect(result.itemInteraction.hover.index).toBe("2")
	})

	it("returns new-state keyboardInteraction when keyboard is active in new state", () => {
		/* Phase 5b RED: keyboardInteraction always sourced from legacy.
		   After GREEN: active keyboard in new state → full new-state merge. */
		const state = makeStateWithNewTooltip({
			keyboardInteraction: {
				...activeInteraction,
				dataKey: undefined,
				graphicalItemId: undefined,
				index: "0",
			},
		})
		state.tooltip.keyboardInteraction = inactiveInteraction

		const result = selectTooltipState(state)

		/* RED: keyboardInteraction.active is false — legacy wins */
		expect(result.keyboardInteraction.active).toBe(true)
	})

	it("preserves legacy-fallback for sacred-test fixture with legacy-only dispatch", () => {
		/* Sacred tests: Treemap/Sankey dispatch setActiveMouseOverItemIndex to legacy
		   store only (no new-state context). selectTooltipState must still return the
		   legacy itemInteraction so those tests stay green.
		   This test exercises the exact fallback path D27 protects. */
		const state = makeLegacyOnlyState()
		state.tooltip.itemInteraction.hover = {
			active: true,
			coordinate: { x: 200, y: 80 },
			dataKey: "value",
			graphicalItemId: "scatter-0",
			index: "3",
		}

		const result = selectTooltipState(state)

		expect(result.itemInteraction.hover.active).toBe(true)
		expect(result.itemInteraction.hover.graphicalItemId).toBe("scatter-0")
		expect(result.itemInteraction.hover.index).toBe("3")
	})
})
