import { createEffect, onCleanup } from "solid-js"
import { useOptionalChartState } from "./useChartState"
import { initialEventSettingsState } from "./eventSettingsSlice"
import type { EventThrottlingProps } from "../util/types"

export function ReportEventSettings(props: EventThrottlingProps): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	createEffect(() => {
		ctx.setState("eventSettings", {
			throttleDelay: props.throttleDelay ?? initialEventSettingsState.throttleDelay,
			throttledEvents: props.throttledEvents ?? initialEventSettingsState.throttledEvents,
		})
	})

	onCleanup(() => {
		ctx.setState("eventSettings", { ...initialEventSettingsState })
	})

	return null
}
