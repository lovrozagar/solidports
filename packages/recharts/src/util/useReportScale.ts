/* eslint-disable import/no-cycle */
import { createEffect, createSignal } from "solid-js"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectContainerScale } from "../state/selectors/containerSelectors"
import { isWellBehavedNumber } from "./isWellBehavedNumber"

export function useReportScale() {
	const ctx = useChartStore()
	const [ref, setRef] = createSignal<HTMLElement | null>(null)

	createEffect(() => {
		const el = ref()
		if (el == null) {
			return
		}
		const scale = ctx ? selectContainerScale(ctx.store) : undefined
		const rect = el.getBoundingClientRect()
		const newScale = rect.width / el.offsetWidth
		if (isWellBehavedNumber(newScale) && newScale !== scale) {
			ctx?.setStore("layout", "scale", newScale)
		}
	})

	return setRef
}
