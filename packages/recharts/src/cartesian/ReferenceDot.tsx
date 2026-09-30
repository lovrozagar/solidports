/* eslint-disable import/no-cycle */
import { createEffect, onCleanup, Show, type JSX } from "solid-js"
import { clsx } from "clsx"
import { Layer } from "../container/Layer"
import { Dot, type Props as DotProps } from "../shape/Dot"
import {
	CartesianLabelContextProvider,
	CartesianLabelFromLabelProp,
	type ImplicitLabelType,
} from "../component/Label"
import { isNumOrStr } from "../util/DataUtils"
import { cloneJsxNodeWithProps, isJsxNode } from "../util/ReactUtils"
import { type IfOverflow, type Overflowable } from "../util/IfOverflow"
import type { ReferenceDotSettings } from "../state/referenceElementsSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectAxisScale } from "../state/selectors/axisSelectors"
import { useIsPanorama } from "../context/PanoramaContext"

import { useClipPathId } from "../container/ClipPathProvider"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import type { AxisId } from "../state/cartesianAxisSlice"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { Coordinate } from "../util/types"
import { CartesianScaleHelperImpl } from "../util/scale/CartesianScaleHelper"

interface ReferenceDotProps extends Overflowable, ZIndexable {
	/**
	 * The radius of the dot in pixels.
	 *
	 * @defaultValue 10
	 */
	r?: number
	/**
	 * The x-coordinate of the center of the dot.
	 *
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceDot will internally calculate the correct pixel position.
	 *
	 * @example <ReferenceDot x="January" y="2026" />
	 */
	x?: number | string
	/**
	 * The y-coordinate of the center of the dot.
	 *
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceDot will internally calculate the correct pixel position.
	 *
	 * @example <ReferenceDot x="January" y="2026" />
	 */
	y?: number | string

	className?: number | string
	/**
	 * The id of y-axis which is corresponding to the data.
	 * Required when there are multiple YAxes.
	 *
	 * @defaultValue 0
	 */
	yAxisId?: number | string
	/**
	 * The id of x-axis which is corresponding to the data.
	 * Required when there are multiple XAxes.
	 *
	 * @defaultValue 0
	 */
	xAxisId?: number | string
	/**
	 * If set a function, the function will be called to render customized shape.
	 */
	shape?: JSX.Element | ((props: DotProps) => JSX.Element)
	/**
	 * Renders a single label.
	 *
	 * - `false`: no labels are rendered
	 * - `string` | `number`: the content of the label
	 * - `object`: the props of LabelList component
	 * - `ReactElement`: a custom label element
	 * - `function`: a render function of custom label
	 *
	 * @defaultValue false
	 */
	label?: ImplicitLabelType

	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue 600
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number

	/**
	 * The customized event handler of click in this chart.
	 */
	onClick?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mousedown in this chart.
	 */
	onMouseDown?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseup in this chart.
	 */
	onMouseUp?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseover in this chart.
	 */
	onMouseOver?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseout in this chart.
	 */
	onMouseOut?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseenter in this chart.
	 */
	onMouseEnter?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mousemove in this chart.
	 */
	onMouseMove?: (dotProps: DotProps, e: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave in this chart.
	 */
	onMouseLeave?: (dotProps: DotProps, e: MouseEvent) => void
	children?: JSX.Element
}

export type Props = Omit<DotProps, "cx" | "cy" | "clipDot" | "dangerouslySetInnerHTML"> &
	ReferenceDotProps

const useCoordinate = (
	x: number | string | undefined,
	y: number | string | undefined,
	xAxisId: AxisId,
	yAxisId: AxisId,
	ifOverflow: IfOverflow,
): Coordinate | null => {
	const isX = isNumOrStr(x)
	const isY = isNumOrStr(y)
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const xAxisScale = ctx ? selectAxisScale(ctx.store, "xAxis", xAxisId, isPanorama) : undefined
	const yAxisScale = ctx ? selectAxisScale(ctx.store, "yAxis", yAxisId, isPanorama) : undefined

	if (!isX || !isY || xAxisScale == null || yAxisScale == null) {
		return null
	}

	const scales = new CartesianScaleHelperImpl({ x: xAxisScale, y: yAxisScale })

	const result = scales.map({ x, y }, { position: "middle" })

	if (ifOverflow === "discard" && !scales.isInRange(result)) {
		return null
	}

	return result
}

function ReportReferenceDot(props: ReferenceDotSettings): null {
	const ctx = useChartStore()
	createEffect(() => {
		ctx?.setStore("referenceElements", "dots", (prev) => [...prev, props])
		onCleanup(() => {
			ctx?.setStore("referenceElements", "dots", (prev) => prev.filter((d) => d !== props))
		})
	})
	return null
}

const renderDot = (option: Props["shape"], dotProps: DotProps) => {
	if (typeof option === "function") {
		return (option as (p: DotProps) => JSX.Element)(dotProps)
	}
	if (isJsxNode(option)) {
		return <>{cloneJsxNodeWithProps(option, dotProps as unknown as Record<string, unknown>) as unknown as JSX.Element}</>
	}
	return <Dot {...dotProps} cx={dotProps.cx} cy={dotProps.cy} class="recharts-reference-dot-dot" />
}

function ReferenceDotImpl(props: PropsWithDefaults) {
	const clipPathId = useClipPathId()

	const coordinate = () =>
		useCoordinate(props.x, props.y, props.xAxisId, props.yAxisId, props.ifOverflow)

	return (
		<Show when={coordinate() != null}>
			{(() => {
				const cx = () => coordinate()?.x as number
				const cy = () => coordinate()?.y as number

				const clipPath = () => (props.ifOverflow === "hidden" ? `url(#${clipPathId})` : undefined)

				const dotProps = (): DotProps => ({
					"clip-path": clipPath(),
					...svgPropertiesAndEvents(props),
					cx: cx() ?? undefined,
					cy: cy() ?? undefined,
				})

				return (
					<ZIndexLayer zIndex={props.zIndex}>
						<Layer class={clsx("recharts-reference-dot", props.className)}>
							{renderDot(props.shape, dotProps())}
							<CartesianLabelContextProvider
								x={cx() - props.r}
								y={cy() - props.r}
								width={2 * props.r}
								height={2 * props.r}
								upperWidth={2 * props.r}
								lowerWidth={2 * props.r}
							>
								<CartesianLabelFromLabelProp label={props.label} />
								{props.children}
							</CartesianLabelContextProvider>
						</Layer>
					</ZIndexLayer>
				)
			})()}
		</Show>
	)
}

export const referenceDotDefaultProps = {
	fill: "#fff",
	"fill-opacity": 1,
	ifOverflow: "discard",
	label: false,
	r: 10,
	stroke: "#ccc",
	"stroke-width": 1,
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.scatter,
} as const satisfies Partial<Props>

type PropsWithDefaults = RequiresDefaultProps<Props, typeof referenceDotDefaultProps>

/**
 * Draws a circle on the chart to highlight a specific point.
 *
 * This component, unlike {@link Dot} or {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/circle circle}, is aware of the cartesian coordinate system,
 * so you specify its center by using data coordinates instead of pixels.
 *
 * ReferenceDot will calculate the pixels based on the provided data coordinates.
 *
 * If you prefer to render dots using pixels rather than data coordinates,
 * consider using the {@link Dot} component instead.
 *
 * @provides CartesianLabelContext
 * @consumes CartesianChartContext
 */
export function ReferenceDot(outsideProps: Props) {
	const props = resolveDefaultProps(outsideProps, referenceDotDefaultProps)
	return (
		<>
			<ReportReferenceDot
				y={props.y}
				x={props.x}
				r={props.r}
				yAxisId={props.yAxisId}
				xAxisId={props.xAxisId}
				ifOverflow={props.ifOverflow}
			/>
			<ReferenceDotImpl {...props} />
		</>
	)
}

ReferenceDot.displayName = "ReferenceDot"
