/* eslint-disable import/no-cycle */
/**
 * @fileOverview Rectangle
 */
import type { JSX } from "solid-js"
import { createEffect, createMemo, createSignal, mergeProps, Show, splitProps, untrack } from "solid-js"
import { clsx } from "clsx"
import type { AnimationDuration } from "../util/types"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import type { EasingInput } from "../animation/easing"
import { interpolate } from "../util/DataUtils"
import { useAnimationId } from "../util/useAnimationId"
import { getTransitionVal } from "../animation/util"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { round, roundTemplateLiteral } from "../util/round"

/**
 * @inline
 */
export type RectRadius = number | [number, number, number, number]

export const getRectanglePath = (
	x: number,
	y: number,
	width: number,
	height: number,
	radius: RectRadius,
): string => {
	const roundedWidth = round(width)
	const roundedHeight = round(height)
	const maxRadius = Math.min(Math.abs(roundedWidth) / 2, Math.abs(roundedHeight) / 2)
	const ySign = roundedHeight >= 0 ? 1 : -1
	const xSign = roundedWidth >= 0 ? 1 : -1
	const clockWise =
		(roundedHeight >= 0 && roundedWidth >= 0) || (roundedHeight < 0 && roundedWidth < 0) ? 1 : 0
	let path

	if (maxRadius > 0 && Array.isArray(radius)) {
		const newRadius: RectRadius = [0, 0, 0, 0]
		for (let i = 0, len = 4; i < len; i++) {
			const r: number = radius[i] ?? 0
			newRadius[i] = r > maxRadius ? maxRadius : r
		}

		path = roundTemplateLiteral`M${x},${y + ySign * newRadius[0]}`

		if (newRadius[0] > 0) {
			path += roundTemplateLiteral`A ${newRadius[0]},${newRadius[0]},0,0,${clockWise},${x + xSign * newRadius[0]},${y}`
		}

		path += roundTemplateLiteral`L ${x + width - xSign * newRadius[1]},${y}`

		if (newRadius[1] > 0) {
			path += roundTemplateLiteral`A ${newRadius[1]},${newRadius[1]},0,0,${clockWise},
        ${x + width},${y + ySign * newRadius[1]}`
		}
		path += roundTemplateLiteral`L ${x + width},${y + height - ySign * newRadius[2]}`

		if (newRadius[2] > 0) {
			path += roundTemplateLiteral`A ${newRadius[2]},${newRadius[2]},0,0,${clockWise},
        ${x + width - xSign * newRadius[2]},${y + height}`
		}
		path += roundTemplateLiteral`L ${x + xSign * newRadius[3]},${y + height}`

		if (newRadius[3] > 0) {
			path += roundTemplateLiteral`A ${newRadius[3]},${newRadius[3]},0,0,${clockWise},
        ${x},${y + height - ySign * newRadius[3]}`
		}
		path += "Z"
	} else if (maxRadius > 0 && radius === +radius && radius > 0) {
		const newRadius = Math.min(maxRadius, radius)

		path = roundTemplateLiteral`M ${x},${y + ySign * newRadius}
            A ${newRadius},${newRadius},0,0,${clockWise},${x + xSign * newRadius},${y}
            L ${x + width - xSign * newRadius},${y}
            A ${newRadius},${newRadius},0,0,${clockWise},${x + width},${y + ySign * newRadius}
            L ${x + width},${y + height - ySign * newRadius}
            A ${newRadius},${newRadius},0,0,${clockWise},${x + width - xSign * newRadius},${y + height}
            L ${x + xSign * newRadius},${y + height}
            A ${newRadius},${newRadius},0,0,${clockWise},${x},${y + height - ySign * newRadius} Z`
	} else {
		path = roundTemplateLiteral`M ${x},${y} h ${width} v ${height} h ${-width} Z`
	}

	return path
}

interface RectangleProps {
	class?: string
	/**
	 * The x-coordinate of top left point of the rectangle.
	 * @defaultValue 0
	 */
	x?: number
	/**
	 * The y-coordinate of top left point of the rectangle.
	 * @defaultValue 0
	 */
	y?: number
	/**
	 * Width of the rectangle in pixels.
	 * @defaultValue 0
	 */
	width?: number
	/**
	 * Height of the rectangle in pixels.
	 * @defaultValue 0
	 */
	height?: number
	/**
	 * The radius of corners.
	 *
	 * If you provide a single number, it applies to all four corners.
	 * If you provide an array of four numbers, they apply to top-left, top-right, bottom-right, bottom-left corners respectively.
	 *
	 * @see {@link https://recharts.github.io/en-US/guide/roundedBars/ Guide: Rounded bar corners}
	 *
	 * @defaultValue 0
	 */
	radius?: RectRadius
	/**
	 * @defaultValue false
	 */
	isAnimationActive?: boolean
	/**
	 * @defaultValue false
	 */
	isUpdateAnimationActive?: boolean
	/**
	 * @defaultValue 0
	 */
	animationBegin?: number
	/**
	 * @defaultValue 1500
	 */
	animationDuration?: AnimationDuration
	/**
	 * @defaultValue ease
	 */
	animationEasing?: EasingInput

	/**
	 * The customized event handler of click on the rectangle
	 */
	onClick?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mousedown on the rectangle
	 */
	onMouseDown?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseup on the rectangle
	 */
	onMouseUp?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mousemove on the rectangle
	 */
	onMouseMove?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseover on the rectangle
	 */
	onMouseOver?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseout on the rectangle
	 */
	onMouseOut?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseenter on the rectangle
	 */
	onMouseEnter?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave on the rectangle
	 */
	onMouseLeave?: (e: MouseEvent) => void
}

export type Props = Omit<JSX.PathSVGAttributes<SVGPathElement>, "radius"> & RectangleProps

export const defaultRectangleProps = {
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	height: 0,
	isAnimationActive: false,
	isUpdateAnimationActive: false,
	radius: 0,
	width: 0,
	x: 0,
	y: 0,
} as const satisfies Partial<Props>

type ResolvedRectangleProps = Props & {
	x: number
	y: number
	width: number
	height: number
	radius: NonNullable<Props["radius"]>
	animationBegin: number
	animationDuration: number
	animationEasing: NonNullable<Props["animationEasing"]>
	isAnimationActive: boolean
	isUpdateAnimationActive: boolean
}

/* Static-path branch (when isUpdateAnimationActive=false). Rendered as its own
 * Solid component so each prop binding (x/y/width/height/d) is a separate
 * accessor that re-runs on prop changes — replacing the IIFE that snapshotted
 * everything on first mount. */
function RectanglePath(rpProps: { props: ResolvedRectangleProps; layerClass: () => string }) {
	/* perf: snapshot non-geometry props ONCE at mount via untrack. Bar entry
	   animation re-allocates `entry()` per frame; the upstream mergeProps
	   getters for fill/stroke/etc. are wired to read `entry().<key>` reactively,
	   so any reactive read inside this function subscribes the consumer scope
	   to the per-frame signal. Putting svgPropertiesAndEvents inside createMemo
	   re-ran the full `for...in` proxy walk every animation tick (~700 calls /
	   500ms on 28 bars; ~6.2ms self in profile).
	   x/y/width/height/d/radius are bound individually below so they stay
	   reactive — the path's geometry still updates per frame. */
	const otherPathProps = untrack(() => {
		const [, restProps] = splitProps(rpProps.props, [
			"x",
			"y",
			"width",
			"height",
			"radius",
		])
		return svgPropertiesAndEvents(restProps)
	})
	/* perf: collapse all geometry attribute writes into ONE createEffect using
	   a captured node ref. Per-frame work goes from 6 reactive render effects
	   (d, x, y, width, height, radius) × 28 bars × 12 frames ≈ 2K node updates
	   to 1 effect × 28 × 12 ≈ 336 updates. Each effect skipped saves a
	   cleanNode/runTop scheduler round-trip (the dominant ~25ms cost in the
	   profile). Reads are batched: one entry() snapshot drives all 5 setAttr
	   calls under one reactive owner. */
	let pathNode: SVGPathElement | undefined
	let prevD = ""
	let prevX = NaN
	let prevY = NaN
	let prevW = NaN
	let prevH = NaN
	let prevR: number | undefined = undefined
	createEffect(() => {
		if (pathNode == null) return
		const x = round(rpProps.props.x)
		const y = round(rpProps.props.y)
		const w = round(rpProps.props.width)
		const h = round(rpProps.props.height)
		const r = rpProps.props.radius
		const d = getRectanglePath(rpProps.props.x, rpProps.props.y, rpProps.props.width, rpProps.props.height, r)
		if (d !== prevD) {
			pathNode.setAttribute("d", d)
			prevD = d
		}
		if (x !== prevX) {
			pathNode.setAttribute("x", String(x))
			prevX = x
		}
		if (y !== prevY) {
			pathNode.setAttribute("y", String(y))
			prevY = y
		}
		if (w !== prevW) {
			pathNode.setAttribute("width", String(w))
			prevW = w
		}
		if (h !== prevH) {
			pathNode.setAttribute("height", String(h))
			prevH = h
		}
		if (typeof r === "number" && r !== prevR) {
			pathNode.setAttribute("radius", String(r))
			prevR = r
		}
	})
	return (
		<path
			{...otherPathProps}
			class={rpProps.layerClass()}
			ref={(el) => {
				pathNode = el
			}}
		/>
	)
}

/**
 * Renders a rectangle element. Unlike the {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/rect rect SVG element}, this component supports rounded corners
 * and animation.
 *
 * This component accepts X and Y coordinates in pixels.
 * If you need to position the rectangle based on your chart's data,
 * consider using the {@link ReferenceArea} component instead.
 */
export function Rectangle(rectangleProps: Props) {
	/* mergeProps preserves the props proxy so x/y/width/height stay reactive.
	 * resolveDefaultProps spreads at setup time and freezes them — see
	 * GOTCHA-005-C. The cast restores the resolved-prop guarantees that
	 * downstream code (RectanglePath, animation closures) relies on. */
	const props = mergeProps(defaultRectangleProps, rectangleProps) as ResolvedRectangleProps
	/* React's useRef stores the path node; Solid needs an explicit setter
	 * callback because `ref={letBoundVar}` is a no-op (Solid only writes
	 * through function refs / signal setters). */
	let pathRef: SVGPathElement | undefined
	const capturePathRef = (el: SVGPathElement) => {
		pathRef = el
		if (el.getTotalLength) {
			try {
				const pathTotalLength = el.getTotalLength()
				if (pathTotalLength) {
					setTotalLength(pathTotalLength)
				}
			} catch {
				/* calculate total length error */
			}
		}
	}
	const [totalLength, setTotalLength] = createSignal(-1)

	const animationIdInput = createMemo(() => ({
		height: props.height,
		radius: props.radius,
		width: props.width,
		x: props.x,
		y: props.y,
	}))
	/* eslint-disable-next-line solid/reactivity -- animationIdInput is a createMemo accessor passed by reference; useAnimationId tracks it internally */
	const animationId = useAnimationId(animationIdInput, "rectangle-")

	const isValid = () =>
		props.x === +props.x &&
		props.y === +props.y &&
		props.width === +props.width &&
		props.height === +props.height &&
		props.width !== 0 &&
		props.height !== 0

	/* eslint-disable solid/reactivity -- prev* are intentional initial snapshots for animation; they track previous frame values, not reactive state */
	let prevWidth = props.width
	let prevHeight = props.height
	let prevX = props.x
	let prevY = props.y
	/* eslint-enable solid/reactivity */

	const layerClass = () =>
		clsx("recharts-rectangle", props.class, (props as { className?: string }).className)

	return (
		<Show when={isValid()}>
			<Show
				when={props.isUpdateAnimationActive}
				fallback={
					<RectanglePath
						props={props as ResolvedRectangleProps}
						layerClass={layerClass}
					/>
				}
			>
				{(() => {
					const from = () => `0px ${totalLength() === -1 ? 1 : totalLength()}px`
					const to = () => `${totalLength()}px 0px`
					const transition = () =>
						getTransitionVal(
							["strokeDasharray"],
							props.animationDuration,
							typeof props.animationEasing === "string"
								? props.animationEasing
								: defaultRectangleProps.animationEasing,
						)

					return (
						<JavascriptAnimate
							animationId={animationId()}
							canBegin={totalLength() > 0}
							duration={props.animationDuration}
							easing={props.animationEasing}
							isActive={props.isUpdateAnimationActive}
							begin={props.animationBegin}
						>
							{(t: () => number) => {
								/* GOTCHA-014: thunk children — invoked once, attribute-only updates per tick.
								   Snapshot prev* once per memo eval but write back only via effect to avoid
								   stale-eval drift. */
								const currWidth = createMemo(() => interpolate(prevWidth, props.width, t()))
								const currHeight = createMemo(() => interpolate(prevHeight, props.height, t()))
								const currX = createMemo(() => interpolate(prevX, props.x, t()))
								const currY = createMemo(() => interpolate(prevY, props.y, t()))
								createEffect(() => {
									if (pathRef && t() > 0) {
										prevWidth = currWidth()
										prevHeight = currHeight()
										prevX = currX()
										prevY = currY()
									}
								})
								const animationStyle = createMemo(() => {
									if (props.isAnimationActive === false) {
										return { strokeDasharray: to() }
									}
									if (t() > 0) {
										return { strokeDasharray: to(), transition: transition() }
									}
									return { strokeDasharray: from() }
								})

								const {
									radius: _,
									x: _x,
									y: _y,
									width: _w,
									height: _h,
									style: _s,
									...otherPathProps
								} = svgPropertiesAndEvents(props)

								return (
									<path
										{...otherPathProps}
										class={layerClass()}
										d={getRectanglePath(currX(), currY(), currWidth(), currHeight(), props.radius)}
										ref={capturePathRef}
										style={{
											...animationStyle(),
											...(typeof props.style === "object" ? props.style : {}),
										}}
									/>
								)
							}}
						</JavascriptAnimate>
					)
				})()}
			</Show>
		</Show>
	)
}
