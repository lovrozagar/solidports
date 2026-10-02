/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { createContext, createMemo, For, Show, useContext, type Accessor } from 'solid-js';
import { getNormalizedStackId, NormalizedStackId, StackId } from "../util/ChartUtils"
import { useUniqueId } from "../util/useUniqueId"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectStackRects } from "../state/selectors/barStackSelectors"
import { useIsPanorama } from "../context/PanoramaContext"
import { Layer, Props as LayerProps } from "../container/Layer"
import { Rectangle, RectRadius } from "../shape/Rectangle"

export type BarStackProps = {
	/**
	 * When two Bars have the same axisId and same stackId, then the two Bars are stacked in the chart.
	 * This prop sets the stack ID for all Bar components inside this BarStack component.
	 * If undefined, a unique id will be generated automatically.
	 *
	 * When both BarStack and individual Bar components have stackId defined,
	 * the BarStack's stackId wins, and the individual Bar's stackId is ignored.
	 */
	stackId?: StackId
	/**
	 * Radius applies only once to all bars inside of this stack group,
	 * as if they were one huge bar.
	 * Meaning that if you have three bars stacked together, and you set
	 * radius to 10, only the outer corners of the entire stack will be rounded: the middle bars will have square corners.
	 *
	 * Unless! The edge bars are smaller than the radius value, in which case the bars at the edge get a lot of radius
	 * and the middle one gets a little bit of radius.
	 *
	 * You may want to combine this with setting individual Bar components' radius to their own values for best effect.
	 * `Bar.radius` prop will round corners of individual bars, while `BarStack.radius` will round corners of the entire stack.
	 *
	 * If you provide a single number, it applies to all four corners.
	 * If you provide an array of four numbers, they apply to top-left, top-right, bottom-right, bottom-left corners respectively.
	 *
	 * @defaultValue 0
	 */
	radius?: RectRadius
	children?: JSX.Element
}

export type BarStackSettings = {
	stackId: NormalizedStackId
	radius: RectRadius
}

const BarStackContext = createContext<Accessor<BarStackSettings> | null>(null)

/**
 * Hook to resolve the stack ID for a Bar component.
 * If a stack ID is provided via props, it is used directly.
 * Otherwise, this will read stack ID from BarStack context if available.
 * If both are undefined, it returns undefined.
 * @param childStackId
 */
export const useStackId = (childStackId: StackId | undefined): NormalizedStackId | undefined => {
	const stackSettings = useContext(BarStackContext)
	if (stackSettings != null) {
		return stackSettings().stackId
	}
	if (childStackId == null) {
		return undefined
	}
	return getNormalizedStackId(childStackId)
}

export const defaultBarStackProps = {
	radius: 0,
} as const satisfies Partial<BarStackProps>

const getClipPathId = (stackId: NormalizedStackId, index: number): string => {
	return `recharts-bar-stack-clip-path-${stackId}-${index}`
}

export const useBarStackClipPathUrl = (index: number): string | undefined => {
	const barStackContext = useContext(BarStackContext)
	if (barStackContext == null) {
		return undefined
	}
	return `url(#${getClipPathId(barStackContext().stackId, index)})`
}

export function BarStackClipLayer(props: LayerProps & { index: number }) {
	const clipPathUrl = createMemo(() => useBarStackClipPathUrl(props.index))
	return <Layer class="recharts-bar-stack-layer" clip-path={clipPathUrl()} {...props} />
}

/**
 * This component will render a clipPath that the individual bars in the stack will reference
 * to achieve rounded corners for the entire stack.
 */
function BarStackClipPath(props: { stackId: NormalizedStackId; radius: RectRadius }) {
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const positions = () =>
		ctx ? selectStackRects(ctx.store, props.stackId, isPanorama) : undefined

	return (
		<Show when={positions() && positions()?.length}>
			<defs>
				<For each={positions()}>
					{(pos, index) => (
						<Show when={pos}>
							{(rect) => (
								<clipPath id={getClipPathId(props.stackId, index())}>
									<Rectangle
										isAnimationActive={false}
										isUpdateAnimationActive={false}
										x={rect().x}
										y={rect().y}
										width={rect().width}
										height={rect().height}
										radius={props.radius}
									/>
								</clipPath>
							)}
						</Show>
					)}
				</For>
			</defs>
		</Show>
	)
}

/**
 * @provides BarStackContext
 * @since 3.6
 */
export function BarStack(props: BarStackProps) {
	/* eslint-disable-next-line solid/reactivity -- stackId is a stable ID; useUniqueId reads it once at setup */
	const resolvedStackId = useUniqueId("recharts-bar-stack", getNormalizedStackId(props.stackId))
	/* `resolveDefaultProps(props, …)` spreads the Solid props proxy and
	 * enumerates `children` — that getter calls `createComponent(...)` on the
	 * user JSX subtree, instantiating every Bar inside the memo body. Then the
	 * outer `{props.children}` reads the getter again. Result: every Bar mounts
	 * twice. Mirror upstream's intent (radius defaults to 0) by reading the
	 * field directly — the proxy returns `undefined` lazily without enumerating
	 * children. */
	const resolvedRadius = createMemo<RectRadius>(() => props.radius ?? defaultBarStackProps.radius)

	const context = createMemo(
		(): BarStackSettings => ({ radius: resolvedRadius(), stackId: resolvedStackId }),
	)

	return (
		<BarStackContext value={context}>
			<BarStackClipPath stackId={resolvedStackId} radius={resolvedRadius()} />
			{props.children}
		</BarStackContext>
	)
}
