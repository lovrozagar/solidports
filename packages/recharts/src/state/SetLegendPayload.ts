/* eslint-disable import/no-cycle */
import { createEffect, onCleanup } from 'solid-js';
import type { LegendPayload } from "../component/DefaultLegendContent"
import { useIsPanorama } from "../context/PanoramaContext"
import { selectChartLayout } from "../context/chartLayoutContext"
import { useOptionalChartState } from "./useChartState"
import { useChartStore } from "./RechartsStoreContext"
import { isSameStoreEntry } from "./storeIdentity"
import { teardownWrite } from "./teardownWrite"

export function SetLegendPayload(props: { legendPayload: ReadonlyArray<LegendPayload> }): null {
	const ctx = useOptionalChartState()
	const isPanorama = useIsPanorama()
	let prevPayload: ReadonlyArray<LegendPayload> | null = null

	createEffect(
		() => props.legendPayload,
		(current) => {
		if (isPanorama) {
			return
		}
		if (prevPayload === null) {
			ctx?.setState(
				"legend",
				"payload",
				(items) => {
					;(items as ReadonlyArray<LegendPayload>[]).push(current)
				},
			)
		} else if (prevPayload !== current) {
			const prev = prevPayload
			ctx?.setState(
				"legend",
				"payload",
				(items) => {
					const mutableItems = items as ReadonlyArray<LegendPayload>[]
					const idx = mutableItems.findIndex((e) => isSameStoreEntry(e, prev))
					if (idx !== -1) {
						mutableItems[idx] = current
					}
				},
			)
		}
		prevPayload = current
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			if (prevPayload) {
				const toRemove = prevPayload
				ctx?.setState(
					"legend",
					"payload",
					(items) => {
						const mutableItems = items as ReadonlyArray<LegendPayload>[]
						const idx = mutableItems.findIndex((e) => isSameStoreEntry(e, toRemove))
						if (idx !== -1) {
							mutableItems.splice(idx, 1)
						}
					},
				)
				prevPayload = null
			}
		})
	})

	return null
}

export function SetPolarLegendPayload(props: {
	legendPayload: ReadonlyArray<LegendPayload>
}): null {
	const legacyCtx = useChartStore()
	const ctx = useOptionalChartState()
	let prevPayload: ReadonlyArray<LegendPayload> | null = null

	createEffect(
		() => ({
			current: props.legendPayload,
			layout: legacyCtx ? selectChartLayout(legacyCtx.store) : undefined,
		}),
		({ current, layout }) => {
		if (layout !== "centric" && layout !== "radial") {
			return
		}
		if (prevPayload === null) {
			ctx?.setState(
				"legend",
				"payload",
				(items) => {
					;(items as ReadonlyArray<LegendPayload>[]).push(current)
				},
			)
		} else if (prevPayload !== current) {
			const prev = prevPayload
			ctx?.setState(
				"legend",
				"payload",
				(items) => {
					const mutableItems = items as ReadonlyArray<LegendPayload>[]
					const idx = mutableItems.findIndex((e) => isSameStoreEntry(e, prev))
					if (idx !== -1) {
						mutableItems[idx] = current
					}
				},
			)
		}
		prevPayload = current
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			if (prevPayload) {
				const toRemove = prevPayload
				ctx?.setState(
					"legend",
					"payload",
					(items) => {
						const mutableItems = items as ReadonlyArray<LegendPayload>[]
						const idx = mutableItems.findIndex((e) => isSameStoreEntry(e, toRemove))
						if (idx !== -1) {
							mutableItems.splice(idx, 1)
						}
					},
				)
				prevPayload = null
			}
		})
	})

	return null
}
