import type { EventThrottlingProps } from "../util/types"

export type EventSettingsState = Required<EventThrottlingProps>

export const initialEventSettingsState: EventSettingsState = {
	throttleDelay: "raf",
	throttledEvents: ["mousemove", "touchmove", "pointermove", "scroll", "wheel"],
}
