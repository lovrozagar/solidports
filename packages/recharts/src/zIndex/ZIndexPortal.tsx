import type { JSX } from "solid-js"
import { createEffect, createMemo, For, onCleanup } from "solid-js"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectAllRegisteredZIndexes } from "./zIndexSelectors"

function ZIndexSvgPortal(props: { zIndex: number; isPanorama: boolean }) {
	let ref: SVGGElement | undefined
	const ctx = useChartStore()

	createEffect(() => {
		if (ref) {
			if (ctx && ctx.store.zIndex.zIndexMap[props.zIndex] == null) {
				ctx.setStore("zIndex", "zIndexMap", props.zIndex, {
					consumers: 0,
					element: undefined,
					panoramaElement: undefined,
				})
			}
			const key = props.isPanorama ? "panoramaElement" : "element"
			ctx?.setStore("zIndex", "zIndexMap", props.zIndex, key, ref)
		}
		onCleanup(() => {
			if (ctx && ctx.store.zIndex.zIndexMap[props.zIndex] == null) {
				ctx.setStore("zIndex", "zIndexMap", props.zIndex, {
					consumers: 0,
					element: undefined,
					panoramaElement: undefined,
				})
			}
			const key = props.isPanorama ? "panoramaElement" : "element"
			ctx?.setStore("zIndex", "zIndexMap", props.zIndex, key, undefined)
		})
	})

	/* these g elements should not be tabbable */
	return <g tabIndex={-1} ref={ref} class={`recharts-zIndex-layer_${props.zIndex}`} />
}

export function AllZIndexPortals(props: { children?: JSX.Element; isPanorama: boolean }) {
	const ctx = useChartStore()
	const allRegisteredZIndexes = createMemo(() =>
		ctx ? selectAllRegisteredZIndexes(ctx.store) : undefined,
	)

	const negativeZIndexes = createMemo(() => {
		const all = allRegisteredZIndexes()
		return all ? all.filter((zIndex) => zIndex < 0) : []
	})
	/* zero is the default layer and does not need a portal */
	const positiveZIndexes = createMemo(() => {
		const all = allRegisteredZIndexes()
		return all ? all.filter((zIndex) => zIndex > 0) : []
	})

	/* `props.children` always lives in this same JSX position. The earlier
	 * `<Show when={hasAny()} fallback={props.children}>` shape re-mounted the
	 * subtree every time `hasAny()` flipped — and child mount/unmount fires
	 * `addZIndexLayer` / `removeZIndexLayer` from each `ZIndexLayer` createEffect,
	 * which flips `hasAny()` again. That feedback loop is the BarStack hang
	 * (Bar's `<ZIndexLayer zIndex={300}>` toggles `hasAny()` between false ↔ true
	 * on every cycle, re-mounting Bar, re-running registration, OOM). React's
	 * `if (!all || all.length === 0) return children` is a single, stable
	 * subtree — replicate that by always rendering children in one position
	 * and conditionally rendering the portal Fors around them. */
	return (
		<>
			<For each={negativeZIndexes()}>
				{(zIndex) => <ZIndexSvgPortal zIndex={zIndex} isPanorama={props.isPanorama} />}
			</For>
			{props.children}
			<For each={positiveZIndexes()}>
				{(zIndex) => <ZIndexSvgPortal zIndex={zIndex} isPanorama={props.isPanorama} />}
			</For>
		</>
	)
}
