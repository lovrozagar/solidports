import { createEffect, onCleanup, useContext } from "solid-js"
import { RechartsStoreContext } from "./RechartsStoreContext"
import { initialEventSettingsState } from "./eventSettingsSlice"
import type { EventThrottlingProps } from "../util/types"

export function ReportEventSettings(props: EventThrottlingProps): null {
	const ctx = useContext(RechartsStoreContext)
	if (ctx == null) {
		return null
	}

	createEffect(() => {
		ctx.setStore("eventSettings", {
			throttleDelay: props.throttleDelay ?? initialEventSettingsState.throttleDelay,
			throttledEvents: props.throttledEvents ?? initialEventSettingsState.throttledEvents,
		})
	})

	onCleanup(() => {
		ctx.setStore("eventSettings", { ...initialEventSettingsState })
	})

	return null
}
