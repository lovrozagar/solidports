import type { SetStoreFunction } from "solid-js/store"
import type { EventThrottlingProps } from "../util/types"
import type { ChartState } from "./store"

export type EventSettingsState = Required<EventThrottlingProps>

export const initialEventSettingsState: EventSettingsState = {
	throttleDelay: "raf",
	throttledEvents: ["mousemove", "touchmove", "pointermove", "scroll", "wheel"],
}

export const setEventSettings =
	(settings: Partial<EventSettingsState>) =>
	(setStore: SetStoreFunction<ChartState>) => {
		if (settings.throttleDelay !== undefined) {
			setStore("eventSettings", "throttleDelay", settings.throttleDelay)
		}
		if (settings.throttledEvents !== undefined) {
			setStore("eventSettings", "throttledEvents", settings.throttledEvents)
		}
	}
