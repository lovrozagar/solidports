import { createEffect, onCleanup } from 'solid-js';
import type { TooltipPayloadConfiguration } from "./tooltipSlice"
import { useIsPanorama } from "../context/PanoramaContext"
import { useOptionalChartState } from "./useChartState"
import { isSameStoreEntry } from "./storeIdentity"
import { teardownWrite } from "./teardownWrite"
import { markRawData } from "./rawData"

export function SetTooltipEntrySettings(props: {
	tooltipEntrySettings: TooltipPayloadConfiguration
}): null {
	const ctx = useOptionalChartState()
	const isPanorama = useIsPanorama()
	let prevSettings: TooltipPayloadConfiguration | null = null

	createEffect(
		() => props.tooltipEntrySettings,
		(current) => {
		if (isPanorama) {
			/* Panorama graphical items should never contribute to Tooltip payload. */
			return
		}
		/* Item data is served by reference like chart data, so payload rows keep their identity. */
		markRawData(current.dataDefinedOnItem)
		if (prevSettings === null) {
			ctx?.setState(
				"tooltip",
				"tooltipItemPayloads",
				(items) => {
					;(items as TooltipPayloadConfiguration[]).push(current)
				},
			)
		} else if (prevSettings !== current) {
			const prev = prevSettings
			ctx?.setState(
				"tooltip",
				"tooltipItemPayloads",
				(items) => {
					const mutableItems = items as TooltipPayloadConfiguration[]
					const idx = mutableItems.findIndex((e) => isSameStoreEntry(e, prev))
					if (idx !== -1) {
						mutableItems[idx] = current
					}
				},
			)
		}
		prevSettings = current
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			if (prevSettings) {
				const toRemove = prevSettings
				ctx?.setState(
					"tooltip",
					"tooltipItemPayloads",
					(items) => {
						const mutableItems = items as TooltipPayloadConfiguration[]
						const idx = mutableItems.findIndex((e) => isSameStoreEntry(e, toRemove))
						if (idx !== -1) {
							mutableItems.splice(idx, 1)
						}
					},
				)
				prevSettings = null
			}
		})
	})

	return null
}
