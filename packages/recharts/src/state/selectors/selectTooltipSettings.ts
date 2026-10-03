/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { TooltipSettingsState } from "../tooltipSlice"
import { chartSelector } from "./chartSelector"
import { readChartState } from "../chartState"

const normalizeIndex = (index: unknown): unknown => (typeof index === "number" ? String(index) : index)

/**
 * Live view over the settings store node that reports a numeric `defaultIndex` as a string.
 * Reads go through to the store, so the view never goes stale and keeps fine-grained tracking.
 */
const indexViewHandler: ProxyHandler<TooltipSettingsState> = {
	get(target, key) {
		const value = Reflect.get(target, key)
		return key === "defaultIndex" ? normalizeIndex(value) : value
	},
	getOwnPropertyDescriptor(target, key) {
		const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
		return key === "defaultIndex" && descriptor != null
			? { ...descriptor, value: normalizeIndex(descriptor.value) }
			: descriptor
	},
}

const indexViews = new WeakMap<TooltipSettingsState, TooltipSettingsState>()

export const selectTooltipSettings = chartSelector((state: ChartState): TooltipSettingsState => {
	const settings = readChartState(state).tooltip.settings
	if (typeof settings.defaultIndex !== "number") {
		return settings
	}
	let view = indexViews.get(settings)
	if (view == null) {
		view = new Proxy(settings, indexViewHandler)
		indexViews.set(settings, view)
	}
	return view
})
