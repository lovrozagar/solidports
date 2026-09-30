/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { createMemo, Show, For } from "solid-js"
import { clsx } from "clsx"
import { polarToCartesian } from "../util/PolarUtils"
import { AxisId } from "../state/cartesianAxisSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectPolarGridAngles, selectPolarGridRadii } from "../state/selectors/polarGridSelectors"
import { selectPolarViewBox } from "../state/selectors/polarAxisSelectors"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { ZIndexable, ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { resolveDefaultProps } from "../util/resolveDefaultProps"

interface PolarGridProps extends ZIndexable {
	/**
	 * The x-coordinate of center.
	 * When used inside a chart context, this prop is calculated based on the chart's dimensions,
	 * and this prop is ignored.
	 *
	 * This is only used when rendered outside a chart context.
	 */
	cx?: number
	/**
	 * The y-coordinate of center.
	 * When used inside a chart context, this prop is calculated based on the chart's dimensions,
	 * and this prop is ignored.
	 *
	 * This is only used when rendered outside a chart context.
	 */
	cy?: number
	/**
	 * The radius of the inner polar grid.
	 * When used inside a chart context, this prop is calculated based on the chart's dimensions,
	 * and this prop is ignored.
	 *
	 * This is only used when rendered outside a chart context.
	 */
	innerRadius?: number
	/**
	 * The radius of the outer polar grid.
	 * When used inside a chart context, this prop is calculated based on the chart's dimensions,
	 * and this prop is ignored.
	 *
	 * This is only used when rendered outside a chart context.
	 */
	outerRadius?: number
	/**
	 * The array of every line grid's angle.
	 */
	polarAngles?: ReadonlyArray<number>
	/**
	 * The array of every circle grid's radius.
	 */
	polarRadius?: ReadonlyArray<number>
	/**
	 * The type of polar grids.
	 * @defaultValue polygon
	 */
	gridType?: "polygon" | "circle"
	/**
	 * @defaultValue true
	 */
	radialLines?: boolean
	/**
	 * @defaultValue 0
	 */
	angleAxisId?: AxisId
	/**
	 * @defaultValue 0
	 */
	radiusAxisId?: AxisId
	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue -100
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number
}

export type Props = JSX.LineSVGAttributes<SVGLineElement> & PolarGridProps

type PropsWithDefaults = Props & {
	cx: number
	cy: number
	innerRadius: number
	outerRadius: number
	polarAngles: ReadonlyArray<number>
	polarRadius: ReadonlyArray<number>
}

type ConcentricProps = PropsWithDefaults & {
	radius: number
}

const getPolygonPath = (
	radius: number,
	cx: number,
	cy: number,
	polarAngles: ReadonlyArray<number>,
) => {
	let path = ""

	polarAngles.forEach((angle: number, i: number) => {
		const point = polarToCartesian(cx, cy, radius, angle)

		if (i) {
			path += `L ${point.x},${point.y}`
		} else {
			path += `M ${point.x},${point.y}`
		}
	})
	path += "Z"

	return path
}

/* Draw axis of radial line */
function PolarAngles(props: PropsWithDefaults): JSX.Element {
	/* eslint-disable solid/reactivity -- guards run at parent re-render; data-driven but stable within a render pass */
	if (!props.polarAngles || !props.polarAngles.length || !props.radialLines) {
		return null
	}
	/* eslint-enable solid/reactivity */
	const polarAnglesProps = {
		stroke: "#ccc",
		...svgPropertiesNoEvents(props),
	}

	return (
		<g class="recharts-polar-grid-angle">
			<For each={props.polarAngles}>
				{(entry) => {
					const start = polarToCartesian(props.cx, props.cy, props.innerRadius, entry)
					const end = polarToCartesian(props.cx, props.cy, props.outerRadius, entry)

					return <line {...polarAnglesProps} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
				}}
			</For>
		</g>
	)
}

/* Draw concentric circles */
function ConcentricCircle(props: ConcentricProps): JSX.Element {
	const { ref: _ref, ...svgProps } = svgPropertiesNoEvents(props) ?? {}

	return (
		<circle
			stroke="#ccc"
			fill="none"
			{...svgProps}
			class={clsx(
				"recharts-polar-grid-concentric-circle",
				String((props as unknown as Record<string, unknown>).className ?? ""),
			)}
			cx={props.cx}
			cy={props.cy}
			r={props.radius}
		/>
	)
}

/* Draw concentric polygons */
function ConcentricPolygon(props: ConcentricProps): JSX.Element {
	const { ref: _ref, ...svgProps } = svgPropertiesNoEvents(props) ?? {}

	return (
		<path
			stroke="#ccc"
			fill="none"
			{...svgProps}
			class={clsx(
				"recharts-polar-grid-concentric-polygon",
				String((props as unknown as Record<string, unknown>).className ?? ""),
			)}
			d={getPolygonPath(props.radius, props.cx, props.cy, props.polarAngles)}
		/>
	)
}

/* Draw concentric axis */
function ConcentricGridPath(props: PropsWithDefaults): JSX.Element {
	/* eslint-disable solid/reactivity -- guards/derived locals run at parent re-render; stable within a render pass */
	if (!props.polarRadius || !props.polarRadius.length) {
		return null
	}

	const maxPolarRadius: number = Math.max(...props.polarRadius)
	const renderBackground = props.fill && props.fill !== "none"
	/* eslint-enable solid/reactivity */

	return (
		<g class="recharts-polar-grid-concentric">
			{/* Render background as separate first child to do not cover strokes of smaller figures */}
			<Show when={renderBackground && props.gridType === "circle"}>
				<ConcentricCircle {...props} radius={maxPolarRadius} />
			</Show>
			<Show when={renderBackground && props.gridType !== "circle"}>
				<ConcentricPolygon {...props} radius={maxPolarRadius} />
			</Show>

			<For each={props.polarRadius}>
				{(entry: number) => {
					if (props.gridType === "circle") {
						return <ConcentricCircle {...props} fill="none" radius={entry} />
					}

					return <ConcentricPolygon {...props} fill="none" radius={entry} />
				}}
			</For>
		</g>
	)
}

export const defaultPolarGridProps = {
	angleAxisId: 0,
	gridType: "polygon",
	radialLines: true,
	radiusAxisId: 0,
	zIndex: DefaultZIndexes.grid,
} as const satisfies Partial<Props>

/**
 * @consumes PolarViewBoxContext
 */
export function PolarGrid(outsideProps: Props): JSX.Element {
	const resolved = resolveDefaultProps(outsideProps, defaultPolarGridProps)
	const {
		gridType,
		radialLines,
		angleAxisId,
		radiusAxisId,
		cx: cxFromOutside,
		cy: cyFromOutside,
		innerRadius: innerRadiusFromOutside,
		outerRadius: outerRadiusFromOutside,
		polarAngles: polarAnglesInput,
		polarRadius: polarRadiusInput,
		zIndex,
		...inputs
	} = resolved
	const ctx = useChartStore()
	const polarViewBox = createMemo(() => (ctx ? selectPolarViewBox(ctx.store) : undefined))

	const polarAnglesFromRedux = createMemo(() =>
		ctx ? selectPolarGridAngles(ctx.store, angleAxisId) : undefined,
	)
	const polarRadiiFromRedux = createMemo(() =>
		ctx ? selectPolarGridRadii(ctx.store, radiusAxisId) : undefined,
	)

	const polarAngles = () =>
		Array.isArray(polarAnglesInput) ? polarAnglesInput : polarAnglesFromRedux()
	const polarRadius = () =>
		Array.isArray(polarRadiusInput) ? polarRadiusInput : polarRadiiFromRedux()

	const props = createMemo((): PropsWithDefaults | null => {
		const angles = polarAngles()
		const radius = polarRadius()
		if (angles == null || radius == null) {
			return null
		}
		const vb = polarViewBox()
		const p: PropsWithDefaults = {
			cx: vb?.cx ?? cxFromOutside ?? 0,
			cy: vb?.cy ?? cyFromOutside ?? 0,
			innerRadius: vb?.innerRadius ?? innerRadiusFromOutside ?? 0,
			outerRadius: vb?.outerRadius ?? outerRadiusFromOutside ?? 0,
			polarAngles: angles,
			polarRadius: radius,
			zIndex,
			...inputs,
		}
		if (p.outerRadius <= 0) {
			return null
		}
		return p
	})

	return (
		<Show when={props()}>
			{(p) => (
				<ZIndexLayer zIndex={p().zIndex}>
					<g class="recharts-polar-grid">
						<ConcentricGridPath
							gridType={gridType}
							radialLines={radialLines}
							{...p()}
							polarAngles={p().polarAngles}
							polarRadius={p().polarRadius}
						/>
						<PolarAngles
							gridType={gridType}
							radialLines={radialLines}
							{...p()}
							polarAngles={p().polarAngles}
							polarRadius={p().polarRadius}
						/>
					</g>
				</ZIndexLayer>
			)}
		</Show>
	)
}
