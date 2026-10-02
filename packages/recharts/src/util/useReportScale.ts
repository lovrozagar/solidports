/* eslint-disable import/no-cycle */
import { createEffect, createSignal, untrack } from 'solid-js';
import { useChartStore } from "../state/RechartsStoreContext"
import { selectContainerScale } from "../state/selectors/containerSelectors"
import { isWellBehavedNumber } from "./isWellBehavedNumber"

export function useReportScale() {
	const ctx = useChartStore()
	const [ref, setRef] = createSignal<HTMLElement | null>(null)

	createEffect(ref, (el) => {
		if (el == null || ctx == null) {
			return
		}
		const scale = untrack(() => selectContainerScale(ctx.store))
		const rect = el.getBoundingClientRect()
		const newScale = rect.width / el.offsetWidth
		if (isWellBehavedNumber(newScale) && newScale !== scale) {
			ctx.setStore("layout", "scale", newScale)
		}
	})

	return setRef
}
