import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../../src/state/store"
import { createActions } from "../../../src/state/actions"
import { selectTooltipSettings } from "../../../src/state/selectors/selectTooltipSettings"
import type { TooltipSettingsState } from "../../../src/state/tooltipSlice"

const settings = (defaultIndex: TooltipSettingsState["defaultIndex"]): TooltipSettingsState => ({
	active: undefined,
	axisId: 0,
	defaultIndex,
	shared: undefined,
	trigger: "hover",
})

describe("selectTooltipSettings identity", () => {
	it("returns the same reference on consecutive reads of an unchanged store", () => {
		const [store] = createRechartsStore()
		expect(selectTooltipSettings(store)).toBe(selectTooltipSettings(store))
	})

	it("returns the same reference with a numeric defaultIndex and reports it as a string", () => {
		const [store, setStore] = createRechartsStore()
		createActions(store, setStore).setTooltipSettingsState(settings(2))
		flush()
		const first = selectTooltipSettings(store)
		expect(selectTooltipSettings(store)).toBe(first)
		expect(first.defaultIndex).toBe("2")
		expect({ ...first }.defaultIndex).toBe("2")
		expect(first.trigger).toBe("hover")
	})

	it("stays live when the numeric defaultIndex changes", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setTooltipSettingsState(settings(1))
		flush()
		const view = selectTooltipSettings(store)
		actions.setTooltipSettingsState(settings(4))
		flush()
		expect(view.defaultIndex).toBe("4")
		expect(selectTooltipSettings(store).defaultIndex).toBe("4")
	})

	it("passes string and undefined defaultIndex through untouched", () => {
		const [store, setStore] = createRechartsStore()
		const actions = createActions(store, setStore)
		actions.setTooltipSettingsState(settings("3"))
		flush()
		expect(selectTooltipSettings(store).defaultIndex).toBe("3")
		actions.setTooltipSettingsState(settings(undefined))
		flush()
		expect(selectTooltipSettings(store).defaultIndex).toBeUndefined()
	})
})
