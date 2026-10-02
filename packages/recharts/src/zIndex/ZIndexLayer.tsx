/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, Show, untrack } from 'solid-js';
import { Portal } from '@solidjs/web';
import { useChartStore } from "../state/RechartsStoreContext"
import { selectZIndexPortalElement } from "./zIndexSelectors"
import { useIsInChartContext } from "../context/chartLayoutContext"
import { useIsPanorama } from "../context/PanoramaContext"
import { teardownWrite } from "../state/teardownWrite"

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
	const isInChartContext = createMemo(() => useIsInChartContext())
	/*
	 * If zIndex is undefined then we render normally without portals.
	 * Also, if zIndex is 0, we render normally without portals,
	 * because 0 is the default layer that does not need a portal.
	 */
	const shouldRenderInPortal = () =>
		isInChartContext() && props.zIndex !== undefined && props.zIndex !== 0

	const isPanorama = useIsPanorama()

	const ctx = useChartStore()

	/*
	 * Because zIndexes are dynamic (meaning, we're not working with a predefined set of layers,
	 * but we allow users to define any zIndex at any time), we need to register
	 * the requested zIndex in the global store. This way, the ZIndexPortals component
	 * can render the corresponding portals and only the requested ones.
	 */
	createEffect(
		() => (shouldRenderInPortal() ? (props.zIndex ?? 0) : null),
		(z) => {
			if (z == null || ctx == null) {
				return undefined
			}
			if (untrack(() => ctx.store.zIndex.zIndexMap[z]) == null) {
				ctx.setStore("zIndex", "zIndexMap", z, {
					consumers: 0,
					element: undefined,
					panoramaElement: undefined,
				})
			}
			ctx.setStore("zIndex", "zIndexMap", z, "consumers", (c: number) => c + 1)
			return () => {
				teardownWrite(() => {
					ctx.setStore("zIndex", "zIndexMap", z, "consumers", (c: number) => Math.max(0, c - 1))
				})
			}
		},
	)

	const portalElement = createMemo(() =>
		ctx ? selectZIndexPortalElement(ctx.store, props.zIndex, isPanorama) : undefined,
	)

	return (
		<Show when={shouldRenderInPortal()} fallback={props.children}>
			<Show when={portalElement()}>
				{/* mount is an SVG <g>; Solid 2's Portal inserts children between text
				   markers without a wrapper element, so SVG content stays valid. */}
				{(mount) => (
					<Portal mount={mount()}>
						{props.children}
					</Portal>
				)}
			</Show>
		</Show>
	)
}
