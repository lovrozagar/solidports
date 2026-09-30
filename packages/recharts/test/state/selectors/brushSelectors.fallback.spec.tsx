import { describe, expect, it } from "vitest"
import { selectBrushSettings } from "../../../src/state/selectors/brushSelectors"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
import type { BrushSettings } from "../../../src/state/brushSlice"

const baseBrushSettings: BrushSettings = {
	height: 40,
	padding: { bottom: 0, left: 0, right: 0, top: 0 },
	width: 300,
	x: 10,
	y: 150,
}

function makeStateWithBrush(opts: {
	newBrushHeight?: number
	legacyBrushHeight?: number
	omitNewBrush?: boolean
}): RechartsRootState {
	const base = createInitialState()

	if (opts.legacyBrushHeight !== undefined) {
		base.brush = { ...baseBrushSettings, height: opts.legacyBrushHeight }
	}

	/* New _solid state — Phase 5 adds chartState.brush to RechartsRootState._solid.
	   Cast needed for RED tests because _solid.brush is not yet defined on the type. */
	if (!opts.omitNewBrush && opts.newBrushHeight !== undefined) {
		const current = (base as Record<string, unknown>)["_solid"] as Record<string, unknown> | undefined
		;(base as Record<string, unknown>)["_solid"] = {
			...current,
			brush: { ...baseBrushSettings, height: opts.newBrushHeight },
		}
	}

	return base
}

describe("Phase 5 — brushSelectors new-state-first / legacy-fallback", () => {
	it("selectBrushSettings reads new _solid state when populated", () => {
		/* Phase 5 RED: selectBrushSettings reads state.brush (legacy) only — _solid.brush
		   branch does not exist yet. After GREEN: selector prefers _solid.brush when set. */
		const state = makeStateWithBrush({
			legacyBrushHeight: 20,
			newBrushHeight: 40,
		})
		const result = selectBrushSettings(state)
		expect(result.height).toBe(40)
	})

	it("selectBrushSettings falls back to legacy when new state is absent", () => {
		/* Phase 5 RED: fallback branch not yet added — when _solid.brush is undefined the
		   selector must return legacy state.brush. Currently returns legacy anyway (no new
		   branch), but after GREEN the fallback path must be explicitly present and tested. */
		const state = makeStateWithBrush({
			legacyBrushHeight: 30,
			omitNewBrush: true,
		})
		const result = selectBrushSettings(state)
		expect(result.height).toBe(30)
	})

	it("selectBrushSettings new-state height takes precedence over legacy height", () => {
		/* Phase 5 RED: new-state override branch absent — both heights present, legacy wins.
		   After GREEN: new state height (99) wins over legacy height (1). */
		const state = makeStateWithBrush({
			legacyBrushHeight: 1,
			newBrushHeight: 99,
		})
		const result = selectBrushSettings(state)
		expect(result.height).toBe(99)
	})
})
