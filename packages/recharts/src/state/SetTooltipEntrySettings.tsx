import { createEffect, onCleanup } from "solid-js"
import { produce } from "solid-js/store"
import type { TooltipPayloadConfiguration } from "./tooltipSlice"
import { useIsPanorama } from "../context/PanoramaContext"
import { useOptionalChartState } from "./useChartState"

export function SetTooltipEntrySettings(props: {
	tooltipEntrySettings: TooltipPayloadConfiguration
}): null {
	const ctx = useOptionalChartState()
	const isPanorama = useIsPanorama()
	let prevSettings: TooltipPayloadConfiguration | null = null

	createEffect(() => {
		if (isPanorama) {
			/* Panorama graphical items should never contribute to Tooltip payload. */
			return
		}
		const current = props.tooltipEntrySettings
		if (prevSettings === null) {
			ctx?.setState(
				"tooltip",
				"tooltipItemPayloads",
				produce((items) => {
					;(items as TooltipPayloadConfiguration[]).push(current)
				}),
			)
		} else if (prevSettings !== current) {
			const prev = prevSettings
			ctx?.setState(
				"tooltip",
				"tooltipItemPayloads",
				produce((items) => {
					const mutableItems = items as TooltipPayloadConfiguration[]
					const idx = mutableItems.indexOf(prev)
					if (idx !== -1) {
						mutableItems[idx] = current
					}
				}),
			)
		}
		prevSettings = current
	})

	onCleanup(() => {
		if (prevSettings) {
			const toRemove = prevSettings
			ctx?.setState(
				"tooltip",
				"tooltipItemPayloads",
				produce((items) => {
					const mutableItems = items as TooltipPayloadConfiguration[]
					const idx = mutableItems.indexOf(toRemove)
					if (idx !== -1) {
						mutableItems.splice(idx, 1)
					}
				}),
			)
			prevSettings = null
		}
	})

	return null
}
