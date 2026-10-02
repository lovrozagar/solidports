import { createEffect, onCleanup } from 'solid-js';
import { useOptionalChartState } from "./useChartState"
import { initialEventSettingsState } from "./eventSettingsSlice"
import type { EventThrottlingProps } from "../util/types"
import { teardownWrite } from "./teardownWrite"

export function ReportEventSettings(props: EventThrottlingProps): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	createEffect(
		() => ({
			throttleDelay: props.throttleDelay ?? initialEventSettingsState.throttleDelay,
			throttledEvents: props.throttledEvents ?? initialEventSettingsState.throttledEvents,
		}),
		(settings) => {
			ctx.setState("eventSettings", settings)
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			ctx.setState("eventSettings", { ...initialEventSettingsState })
		})
	})

	return null
}
