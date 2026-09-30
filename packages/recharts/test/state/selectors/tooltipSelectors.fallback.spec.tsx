import { describe, expect, it } from "vitest"
import { selectTooltipSettings } from "../../../src/state/selectors/selectTooltipSettings"
import { selectTooltipState } from "../../../src/state/selectors/selectTooltipState"
import { selectTooltipAxisId } from "../../../src/state/selectors/selectTooltipAxisId"
import { createInitialState } from "../../../src/state/store"
import type { RechartsRootState } from "../../../src/state/store"
import type { TooltipSettingsState, TooltipState } from "../../../src/state/tooltipSlice"

const newSettings: TooltipSettingsState = {
	active: true,
	axisId: "primary",
	defaultIndex: "2",
	shared: false,
	trigger: "click",
}

const legacySettings: TooltipSettingsState = {
	active: false,
	axisId: 0,
	defaultIndex: undefined,
	shared: undefined,
	trigger: "hover",
}

function makeStateWithTooltip(opts: {
	newSettings?: TooltipSettingsState
	newPayloads?: TooltipState["tooltipItemPayloads"]
	legacySettings?: TooltipSettingsState
	omitNew?: boolean
}): RechartsRootState {
	const base = createInitialState()

	if (opts.legacySettings !== undefined) {
		base.tooltip.settings = opts.legacySettings
	}

	if (!opts.omitNew) {
		const solidTooltip: Record<string, unknown> = {}
		if (opts.newSettings !== undefined) solidTooltip["settings"] = opts.newSettings
		if (opts.newPayloads !== undefined) solidTooltip["tooltipItemPayloads"] = opts.newPayloads

		if (Object.keys(solidTooltip).length > 0) {
			const current = (base as Record<string, unknown>)["_solid"] as Record<string, unknown> | undefined
			const currentTooltip = (current?.["tooltip"] as Record<string, unknown> | undefined) ?? {}
			;(base as Record<string, unknown>)["_solid"] = {
				...current,
				tooltip: { ...currentTooltip, ...solidTooltip },
			}
		}
	}

	return base
}

describe("Phase 5 — tooltipSelectors new-state-first / legacy-fallback", () => {
	it("selectTooltipSettings reads new _solid state when populated", () => {
		/* Phase 5 RED: selectTooltipSettings reads state.tooltip.settings (legacy) only —
		   _solid.tooltip.settings branch not yet added. After GREEN: new state wins. */
		const state = makeStateWithTooltip({
			legacySettings,
			newSettings,
		})
		const result = selectTooltipSettings(state)
		expect(result.trigger).toBe("click")
	})

	it("selectTooltipSettings falls back to legacy when new state absent", () => {
		/* Phase 5 RED: explicit fallback branch absent. Must return legacy settings when
		   _solid is not populated. */
		const state = makeStateWithTooltip({
			legacySettings,
			omitNew: true,
		})
		const result = selectTooltipSettings(state)
		expect(result.trigger).toBe("hover")
	})

	it("selectTooltipSettings new trigger takes precedence over legacy trigger", () => {
		/* Phase 5 RED: new-state branch missing — legacy trigger wins. After GREEN: new
		   state trigger ('click') beats legacy ('hover'). */
		const state = makeStateWithTooltip({
			legacySettings,
			newSettings,
		})
		const result = selectTooltipSettings(state)
		expect(result.trigger).toBe("click")
		expect(result.trigger).not.toBe("hover")
	})

	it("selectTooltipAxisId reads axisId from new _solid settings when populated", () => {
		/* Phase 5 RED: selectTooltipAxisId reads state.tooltip.settings.axisId (legacy) —
		   _solid branch not yet consulted. After GREEN: new settings axisId ('primary') wins
		   over legacy (0). */
		const state = makeStateWithTooltip({
			legacySettings,
			newSettings,
		})
		const result = selectTooltipAxisId(state)
		expect(result).toBe("primary")
	})

	it("selectTooltipState settings field comes from new _solid state when populated", () => {
		/* Phase 5 RED: selectTooltipState returns state.tooltip which is the legacy slice —
		   the _solid.tooltip.settings cherry-pick merge is not yet implemented. After GREEN:
		   the merged result has settings from new state but interaction slices from legacy. */
		const state = makeStateWithTooltip({
			legacySettings,
			newSettings,
		})
		const result = selectTooltipState(state)
		/* New settings axisId should surface via selectTooltipState.settings */
		expect(result.settings.axisId).toBe("primary")
	})

	it("selectTooltipState interaction slices come from legacy when new state absent", () => {
		/* Phase 5 RED: when _solid.tooltip is absent the merged state must still include
		   the interaction slices from legacy (axisInteraction/itemInteraction/etc). */
		const state = makeStateWithTooltip({
			legacySettings,
			omitNew: true,
		})
		const result = selectTooltipState(state)
		/* axisInteraction and itemInteraction are always present on legacy state */
		expect(result.axisInteraction).toBeDefined()
		expect(result.itemInteraction).toBeDefined()
		expect(result.keyboardInteraction).toBeDefined()
	})
})
