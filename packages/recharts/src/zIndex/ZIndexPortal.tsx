import type { JSX } from '@solidjs/web';
import { createMemo, For, createEffect, untrack } from 'solid-js';
import { useChartStore } from "../state/RechartsStoreContext"
import { selectAllRegisteredZIndexes } from "./zIndexSelectors"
import { teardownWrite } from "../state/teardownWrite"

function ZIndexSvgPortal(props: { zIndex: number; isPanorama: boolean }) {
	let ref: SVGGElement | undefined
	const ctx = useChartStore()

	createEffect(
		() => ({ isPanorama: props.isPanorama, zIndex: props.zIndex }),
		({ isPanorama, zIndex }) => {
			if (ref == null || ctx == null) {
				return undefined
			}
			const key = isPanorama ? "panoramaElement" : "element"
			const ensureEntry = () => {
				if (untrack(() => ctx.store.zIndex.zIndexMap[zIndex]) == null) {
					ctx.setStore("zIndex", "zIndexMap", zIndex, {
						consumers: 0,
						element: undefined,
						panoramaElement: undefined,
					})
				}
			}
			ensureEntry()
			ctx.setStore("zIndex", "zIndexMap", zIndex, key, ref)
			return () => {
				teardownWrite(() => {
					ensureEntry()
					ctx.setStore("zIndex", "zIndexMap", zIndex, key, undefined)
				})
			}
		},
	)

	/* these g elements should not be tabbable */
	return <g tabindex={-1} ref={ref} class={`recharts-zIndex-layer_${props.zIndex}`} />
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
