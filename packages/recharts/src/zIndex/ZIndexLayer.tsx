/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { createEffect, createMemo, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { noop } from "../util/DataUtils"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectZIndexPortalElement } from "./zIndexSelectors"
import { useIsInChartContext } from "../context/chartLayoutContext"
import { useIsPanorama } from "../context/PanoramaContext"

/**
 * @since 3.4
 */
export interface ZIndexable {
	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue 0
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number
}

type ZIndexLayerProps = {
	/**
	 * Z-Index of this component and its children.
	 *
	 * The higher the value, the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 *
	 * If `undefined` or `0`, the content is rendered in the default layer without portals.
	 */
	zIndex: number | undefined
	/**
	 * The content to render inside this zIndex layer.
	 * Undefined children are allowed and will render nothing and will still report the zIndex to the portal system.
	 */
	children?: JSX.Element
}

/**
 * A layer that renders its children into a portal corresponding to the given zIndex.
 * We can't use regular CSS `z-index` because SVG does not support it.
 * So instead, we create separate DOM nodes for each zIndex layer
 * and render the children into the corresponding DOM node using portals.
 *
 * This component must be used inside a Chart component.
 *
 * @param zIndex numeric zIndex value, higher values are rendered on top of lower values
 * @param children the content to render inside this zIndex layer
 *
 * @since 3.4
 */
export function ZIndexLayer(props: ZIndexLayerProps) {
	/*
	 * If we are outside of chart, then we can't rely on the zIndex portal state,
	 * so we just render normally.
	 */
	const isInChartContext = () => useIsInChartContext()
	/*
	 * If zIndex is undefined then we render normally without portals.
	 * Also, if zIndex is 0, we render normally without portals,
	 * because 0 is the default layer that does not need a portal.
	 */
	const shouldRenderInPortal = () =>
		isInChartContext() && props.zIndex !== undefined && props.zIndex !== 0

	const isPanorama = useIsPanorama()

	const ctx = useChartStore()

	createEffect(() => {
		if (shouldRenderInPortal() === false) {
			return noop
		}
		/*
		 * Because zIndexes are dynamic (meaning, we're not working with a predefined set of layers,
		 * but we allow users to define any zIndex at any time), we need to register
		 * the requested zIndex in the global store. This way, the ZIndexPortals component
		 * can render the corresponding portals and only the requested ones.
		 */
		const z = props.zIndex ?? 0
		if (ctx && ctx.store.zIndex.zIndexMap[z] == null) {
			ctx.setStore("zIndex", "zIndexMap", z, {
				consumers: 0,
				element: undefined,
				panoramaElement: undefined,
			})
		}
		ctx?.setStore("zIndex", "zIndexMap", z, "consumers", (c: number) => c + 1)
		onCleanup(() => {
			ctx?.setStore(
				"zIndex",
				"zIndexMap",
				z,
				"consumers",
				(c: number) => Math.max(0, c - 1),
			)
		})
	})

	const portalElement = createMemo(() =>
		ctx ? selectZIndexPortalElement(ctx.store, props.zIndex, isPanorama) : undefined,
	)

	return (
		<Show when={shouldRenderInPortal()} fallback={props.children}>
			<Show when={portalElement()}>
				{/* mount is an SVG <g>; Solid Portal wraps content in a `<div>` by default,
				   which is invalid SVG. Force isSVG to wrap in a `<g>` instead. */}
				{(mount) => (
					<Portal mount={mount()} isSVG>
						{props.children}
					</Portal>
				)}
			</Show>
		</Show>
	)
}
