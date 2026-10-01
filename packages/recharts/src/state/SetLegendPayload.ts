/* eslint-disable import/no-cycle */
import { createEffect, onCleanup } from "solid-js"
import { produce } from "solid-js/store"
import type { LegendPayload } from "../component/DefaultLegendContent"
import { useIsPanorama } from "../context/PanoramaContext"
import { selectChartLayout } from "../context/chartLayoutContext"
import { useOptionalChartState } from "./useChartState"
import { useChartStore } from "./RechartsStoreContext"

export function SetLegendPayload(props: { legendPayload: ReadonlyArray<LegendPayload> }): null {
	const ctx = useOptionalChartState()
	const isPanorama = useIsPanorama()
	let prevPayload: ReadonlyArray<LegendPayload> | null = null

	createEffect(() => {
		if (isPanorama) {
			return
		}
		const current = props.legendPayload
		if (prevPayload === null) {
			ctx?.setState(
				"legend",
				"payload",
				produce((items) => {
					;(items as ReadonlyArray<LegendPayload>[]).push(current)
				}),
			)
		} else if (prevPayload !== current) {
			const prev = prevPayload
			ctx?.setState(
				"legend",
				"payload",
				produce((items) => {
					const mutableItems = items as ReadonlyArray<LegendPayload>[]
					const idx = mutableItems.indexOf(prev)
					if (idx !== -1) {
						mutableItems[idx] = current
					}
				}),
			)
		}
		prevPayload = current
	})

	onCleanup(() => {
		if (prevPayload) {
			const toRemove = prevPayload
			ctx?.setState(
				"legend",
				"payload",
				produce((items) => {
					const mutableItems = items as ReadonlyArray<LegendPayload>[]
					const idx = mutableItems.indexOf(toRemove)
					if (idx !== -1) {
						mutableItems.splice(idx, 1)
					}
				}),
			)
			prevPayload = null
		}
	})

	return null
}

export function SetPolarLegendPayload(props: {
	legendPayload: ReadonlyArray<LegendPayload>
}): null {
	const legacyCtx = useChartStore()
	const ctx = useOptionalChartState()
	let prevPayload: ReadonlyArray<LegendPayload> | null = null

	createEffect(() => {
		const layout = legacyCtx ? selectChartLayout(legacyCtx.store) : undefined
		if (layout !== "centric" && layout !== "radial") {
			return
		}
		const current = props.legendPayload
		if (prevPayload === null) {
			ctx?.setState(
				"legend",
				"payload",
				produce((items) => {
					;(items as ReadonlyArray<LegendPayload>[]).push(current)
				}),
			)
		} else if (prevPayload !== current) {
			const prev = prevPayload
			ctx?.setState(
				"legend",
				"payload",
				produce((items) => {
					const mutableItems = items as ReadonlyArray<LegendPayload>[]
					const idx = mutableItems.indexOf(prev)
					if (idx !== -1) {
						mutableItems[idx] = current
					}
				}),
			)
		}
		prevPayload = current
	})

	onCleanup(() => {
		if (prevPayload) {
			const toRemove = prevPayload
			ctx?.setState(
				"legend",
				"payload",
				produce((items) => {
					const mutableItems = items as ReadonlyArray<LegendPayload>[]
					const idx = mutableItems.indexOf(toRemove)
					if (idx !== -1) {
						mutableItems.splice(idx, 1)
					}
				}),
			)
			prevPayload = null
		}
	})

	return null
}
