/* eslint-disable import/no-cycle */
import { Show, createEffect } from 'solid-js';
import type { CamelCaseSVGAttrs } from "../util/CamelCaseSVGAttrs"
import { ShapeOption } from "../util/ShapeElementProps"
import type { JSX } from '@solidjs/web';
import { clsx } from "clsx"
import { Layer } from "../container/Layer"
import {
	CartesianLabelContextProvider,
	CartesianLabelFromLabelProp,
	type ImplicitLabelType,
} from "../component/Label"
import { rectWithPoints } from "../util/CartesianUtils"
import type { Overflowable } from "../util/IfOverflow"
import { isNumOrStr } from "../util/DataUtils"
import type { Props as RectangleProps } from "../shape/Rectangle"
import { Rectangle } from "../shape/Rectangle"

import type { ReferenceAreaSettings } from "../state/referenceElementsSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectAxisScale } from "../state/selectors/axisSelectors"
import { useIsPanorama } from "../context/PanoramaContext"

import { useClipPathId } from "../container/ClipPathProvider"
import type { NullableCoordinate, RectanglePosition } from "../util/types"
import type { SVGPropsAndEvents } from "../util/svgPropertiesAndEvents"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { RechartsScale } from "../util/scale/RechartsScale"
import { CartesianScaleHelperImpl } from "../util/scale/CartesianScaleHelper"
import { isSameStoreEntry } from "../state/storeIdentity"
import { teardownWrite } from "../state/teardownWrite"

type ReferenceCoordinateValue = number | string

interface ReferenceAreaProps<
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract */
	XValueType extends ReferenceCoordinateValue = any,
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract */
	YValueType extends ReferenceCoordinateValue = any,
> extends Overflowable, ZIndexable {
	/**
	 * Starting X-coordinate of the area.
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceArea will internally calculate the correct pixel position.
	 *
	 * If undefined then the area will extend to the left edge of the chart plot area.
	 *
	 * @example <ReferenceArea x1="Monday" x2="Friday" />
	 * @example <ReferenceArea x1={10} x2={50} />
	 * @example <ReferenceArea x1="Page C" />
	 */
	x1?: XValueType
	/**
	 * Ending X-coordinate of the area.
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceArea will internally calculate the correct pixel position.
	 *
	 * If undefined then the area will extend to the right edge of the chart plot area.
	 *
	 * @example <ReferenceArea x1="Monday" x2="Friday" />
	 * @example <ReferenceArea x1={10} x2={50} />
	 * @example <ReferenceArea x2="Page C" />
	 */
	x2?: XValueType
	/**
	 * Starting Y-coordinate of the area.
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceArea will internally calculate the correct pixel position.
	 *
	 * If undefined then the area will extend to the top edge of the chart plot area.
	 *
	 * @example <ReferenceArea y1={100} y2={500} />
	 * @example <ReferenceArea y1="low" y2="high" />
	 * @example <ReferenceArea y1={200} />
	 */
	y1?: YValueType
	/**
	 * Ending Y-coordinate of the area.
	 * This value is using your chart's domain, so you will provide a data value instead of a pixel value.
	 * ReferenceArea will internally calculate the correct pixel position.
	 *
	 * If undefined then the area will extend to the bottom edge of the chart plot area.
	 *
	 * @example <ReferenceArea y1={100} y2={500} />
	 * @example <ReferenceArea y1="low" y2="high" />
	 * @example <ReferenceArea y2={400} />
	 */
	y2?: YValueType

	className?: number | string
	/**
	 * The id of YAxis which is corresponding to the data. Required when there are multiple YAxes.
	 * @defaultValue 0
	 */
	yAxisId?: number | string
	/**
	 * The id of XAxis which is corresponding to the data. Required when there are multiple XAxes.
	 * @defaultValue 0
	 */
	xAxisId?: number | string
	/**
	 * If set a function, the function will be called to render customized shape.
	 */
	shape?: JSX.Element | ((props: Record<string, unknown>) => JSX.Element)
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
	 *
	 * @see {@link https://recharts.github.io/en-US/examples/LineChartWithReferenceLines/ Reference elements with a label}
	 */
	label?: ImplicitLabelType

	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue 100
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number
	children?: JSX.Element
}

/*
 * Omit width, height, x, y from SVGPropsAndEvents because ReferenceArea receives x1, x2, y1, y2 instead.
 * The position is calculated internally instead.
 */
export type Props<
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract */
	XValueType extends ReferenceCoordinateValue = any,
	/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract */
	YValueType extends ReferenceCoordinateValue = any,
> = Omit<SVGPropsAndEvents<RectangleProps>, "width" | "height" | "x" | "y"> &
	CamelCaseSVGAttrs &
	ReferenceAreaProps<XValueType, YValueType>

const getRect = (
	hasX1: boolean,
	hasX2: boolean,
	hasY1: boolean,
	hasY2: boolean,
	xAxisScale: RechartsScale | undefined,
	yAxisScale: RechartsScale | undefined,
	areaProps: Props,
): RectanglePosition | null => {
	const { x1: xValue1, x2: xValue2, y1: yValue1, y2: yValue2 } = areaProps

	if (xAxisScale == null || yAxisScale == null) {
		return null
	}

	const scales = new CartesianScaleHelperImpl({ x: xAxisScale, y: yAxisScale })

	const p1: NullableCoordinate = {
		x: hasX1 ? (xAxisScale.map(xValue1, { position: "start" }) ?? null) : xAxisScale.rangeMin(),
		y: hasY1 ? (yAxisScale.map(yValue1, { position: "start" }) ?? null) : yAxisScale.rangeMin(),
	}

	const p2: NullableCoordinate = {
		x: hasX2 ? (xAxisScale.map(xValue2, { position: "end" }) ?? null) : xAxisScale.rangeMax(),
		y: hasY2 ? (yAxisScale.map(yValue2, { position: "end" }) ?? null) : yAxisScale.rangeMax(),
	}

	if (areaProps.ifOverflow === "discard" && (!scales.isInRange(p1) || !scales.isInRange(p2))) {
		return null
	}

	return rectWithPoints(p1 as { x: number; y: number }, p2 as { x: number; y: number })
}

function ReportReferenceArea(props: ReferenceAreaSettings): null {
	const ctx = useChartStore()
	/* The props proxy is registered once; selectors read its fields lazily. */
	createEffect(
		() => props,
		(element) => {
			ctx?.setStore("referenceElements", "areas", (prev) => [...prev, element])
			return () => {
				teardownWrite(() => {
					ctx?.setStore("referenceElements", "areas", (prev) => prev.filter((a) => !isSameStoreEntry(a, element)))
				})
			}
		},
	)
	return null
}

function ReferenceAreaImpl(props: PropsWithDefaults) {
	const clipPathId = useClipPathId()
	const isPanorama = useIsPanorama()
	const ctx = useChartStore()
	const xAxisScale = () =>
		ctx ? selectAxisScale(ctx.store, "xAxis", props.xAxisId, isPanorama) : undefined
	const yAxisScale = () =>
		ctx ? selectAxisScale(ctx.store, "yAxis", props.yAxisId, isPanorama) : undefined

	const hasX1 = () => isNumOrStr(props.x1)
	const hasX2 = () => isNumOrStr(props.x2)
	const hasY1 = () => isNumOrStr(props.y1)
	const hasY2 = () => isNumOrStr(props.y2)

	const shouldRender = () => {
		if (xAxisScale() == null || yAxisScale() == null) {
			return false
		}
		if (!hasX1() && !hasX2() && !hasY1() && !hasY2() && !props.shape) {
			return false
		}
		return true
	}

	const rect = () => {
		if (!shouldRender()) return null
		return getRect(hasX1(), hasX2(), hasY1(), hasY2(), xAxisScale(), yAxisScale(), props)
	}

	return (
		<Show when={shouldRender() && (rect() != null || props.shape)}>
			{(() => {
				const isOverflowHidden = () => props.ifOverflow === "hidden"
				const clipPath = () => (isOverflowHidden() ? `url(#${clipPathId})` : undefined)

				return (
					<ZIndexLayer zIndex={props.zIndex}>
						<Layer class={clsx("recharts-reference-area", props.className)}>
							<ShapeOption
								option={props.shape}
								shapeProps={{
									...svgPropertiesAndEvents(props),
									...rect(),
									"clip-path": clipPath(),
								}}
								renderDefault={(rectProps) => (
									<Rectangle {...rectProps} class="recharts-reference-area-rect" />
								)}
							/>
							<Show when={rect()}>
								{(r) => (
									<CartesianLabelContextProvider
										x={r().x}
										y={r().y}
										width={r().width}
										height={r().height}
										lowerWidth={r().width}
										upperWidth={r().width}
									>
										<>
											<CartesianLabelFromLabelProp label={props.label} />
											{props.children}
										</>
									</CartesianLabelContextProvider>
								)}
							</Show>
						</Layer>
					</ZIndexLayer>
				)
			})()}
		</Show>
	)
}

export const referenceAreaDefaultProps = {
	fill: "#ccc",
	fillOpacity: 0.5,
	ifOverflow: "discard",
	label: false,
	radius: 0,
	stroke: "none",
	strokeWidth: 1,
	xAxisId: 0,
	yAxisId: 0,
	zIndex: DefaultZIndexes.area,
} as const satisfies Partial<Props>

type PropsWithDefaults = RequiresDefaultProps<Props, typeof referenceAreaDefaultProps>

/**
 * Draws a rectangular area on the chart to highlight a specific range.
 *
 * This component, unlike {@link Rectangle} or {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/rect rect}, is aware of the cartesian coordinate system,
 * so you specify the area by using data coordinates instead of pixels.
 *
 * ReferenceArea will calculate the pixels based on the provided data coordinates.
 *
 * If you prefer to render rectangles using pixels rather than data coordinates,
 * consider using the {@link Rectangle} component instead.
 *
 * @provides CartesianLabelContext
 * @consumes CartesianChartContext
 */
function ReferenceAreaFn(outsideProps: Props): JSX.Element {
	const props = resolveDefaultProps(outsideProps, referenceAreaDefaultProps)
	return (
		<>
			<ReportReferenceArea
				yAxisId={props.yAxisId}
				xAxisId={props.xAxisId}
				ifOverflow={props.ifOverflow}
				x1={props.x1}
				x2={props.x2}
				y1={props.y1}
				y2={props.y2}
			/>
			<ReferenceAreaImpl {...props} />
		</>
	)
}

/**
 * Typed entry point: the generics constrain props at the call site, like upstream.
 */
/* eslint-disable-next-line typescript-eslint/no-explicit-any -- upstream contract: untyped usage accepts any data */
export const ReferenceArea = ReferenceAreaFn as (<XValueType extends number | string = any, YValueType extends number | string = any>(
	props: Props<XValueType, YValueType>,
) => JSX.Element) & { displayName?: string }
ReferenceArea.displayName = "ReferenceArea"
