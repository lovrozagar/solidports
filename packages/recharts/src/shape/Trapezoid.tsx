/* eslint-disable import/no-cycle */
/**
 * @fileOverview Rectangle
 */
import type { JSX } from '@solidjs/web';
import { useShapeElementProps } from "../util/ShapeElementProps"
import type { WithoutRemoveFalse } from "../util/types"
import { createMemo, createSignal, Show, createEffect, untrack } from 'solid-js';
import { clsx } from "clsx"
import type { AnimationDuration, AnimationTiming } from "../util/types"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { JavascriptAnimate } from "../animation/JavascriptAnimate"
import { useAnimationId } from "../util/useAnimationId"
import { interpolate } from "../util/DataUtils"
import { getTransitionVal } from "../animation/util"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { roundTemplateLiteral } from "../util/round"

const getTrapezoidPath = (
	x: number,
	y: number,
	upperWidth: number,
	lowerWidth: number,
	height: number,
): string => {
	const widthGap = upperWidth - lowerWidth
	let path
	path = roundTemplateLiteral`M ${x},${y}`
	path += roundTemplateLiteral`L ${x + upperWidth},${y}`
	path += roundTemplateLiteral`L ${x + upperWidth - widthGap / 2},${y + height}`
	path += roundTemplateLiteral`L ${x + upperWidth - widthGap / 2 - lowerWidth},${y + height}`
	path += roundTemplateLiteral`L ${x},${y} Z`
	return path
}

interface TrapezoidProps {
	class?: string
	/**
	 * The x-coordinate of top left point of the trapezoid.
	 * @default 0
	 */
	x?: number
	/**
	 * The y-coordinate of top left point of the trapezoid.
	 * @default 0
	 */
	y?: number
	/**
	 * Width of the upper horizontal side of the trapezoid in pixels.
	 * @default 0
	 */
	upperWidth?: number
	/**
	 * Width of the lower horizontal side of the trapezoid in pixels.
	 * @default 0
	 */
	lowerWidth?: number
	/**
	 * Height of the trapezoid in pixels.
	 * @default 0
	 */
	height?: number

	/**
	 * If set to true, trapezoid will update and render with a gradual fade-in animation from left to right.
	 * If set "auto", animation is disabled during SSR and when the user prefers reduced motion.
	 * @default false
	 */
	isUpdateAnimationActive?: boolean | "auto"
	animationBegin?: number
	animationDuration?: AnimationDuration
	animationEasing?: AnimationTiming

	/**
	 * The customized event handler of click on the trapezoid
	 */
	onClick?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mousedown on the trapezoid
	 */
	onMouseDown?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseup on the trapezoid
	 */
	onMouseUp?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mousemove on the trapezoid
	 */
	onMouseMove?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseover on the trapezoid
	 */
	onMouseOver?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseout on the trapezoid
	 */
	onMouseOut?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseenter on the trapezoid
	 */
	onMouseEnter?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseleave on the trapezoid
	 */
	onMouseLeave?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
}

export type Props = WithoutRemoveFalse<Omit<JSX.PathSVGAttributes<SVGPathElement>, keyof TrapezoidProps>> & TrapezoidProps

export const defaultTrapezoidProps = {
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	height: 0,
	isUpdateAnimationActive: false,
	lowerWidth: 0,
	upperWidth: 0,
	x: 0,
	y: 0,
} as const satisfies Partial<Props>

export function Trapezoid(ownProps: Props) {
	/* Props injected for a shape passed as an element (see ShapeElementProps). */
	const outsideProps = useShapeElementProps(ownProps)
	const trapezoidProps = resolveDefaultProps(outsideProps, defaultTrapezoidProps)

	/* Solid only writes refs through function callbacks / signal setters —
	 * `ref={letBoundVar}` is a no-op, so we capture explicitly. */
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

	const animationId = useAnimationId(() => outsideProps, "trapezoid-")

	const isValid = () =>
		trapezoidProps.x === +trapezoidProps.x &&
		trapezoidProps.y === +trapezoidProps.y &&
		trapezoidProps.upperWidth === +trapezoidProps.upperWidth &&
		trapezoidProps.lowerWidth === +trapezoidProps.lowerWidth &&
		trapezoidProps.height === +trapezoidProps.height &&
		(trapezoidProps.upperWidth !== 0 || trapezoidProps.lowerWidth !== 0) &&
		trapezoidProps.height !== 0

	/* Animation starts from the geometry at mount. */
	let prevUpperWidth = untrack(() => trapezoidProps.upperWidth)
	let prevLowerWidth = untrack(() => trapezoidProps.lowerWidth)
	let prevHeight = untrack(() => trapezoidProps.height)
	let prevX = untrack(() => trapezoidProps.x)
	let prevY = untrack(() => trapezoidProps.y)

	/* React-style `className` alias forwarded through Shape's prop transformer
	   (e.g. `shape={{ className: "x" }}`); accept both. */
	const layerClass = () =>
		clsx(
			"recharts-trapezoid",
			trapezoidProps.class,
			(trapezoidProps as { className?: string }).className,
		)

	return (
		<Show when={isValid()}>
			<Show
				when={trapezoidProps.isUpdateAnimationActive}
				fallback={
					<g>
						<path
							{...svgPropertiesAndEvents(trapezoidProps)}
							class={layerClass()}
							d={getTrapezoidPath(
								trapezoidProps.x,
								trapezoidProps.y,
								trapezoidProps.upperWidth,
								trapezoidProps.lowerWidth,
								trapezoidProps.height,
							)}
						/>
					</g>
				}
			>
				{(() => {
					const from = () => `0px ${totalLength() === -1 ? 1 : totalLength()}px`
					const to = () => `${totalLength()}px 0px`
					const transition = () =>
						getTransitionVal(
							["strokeDasharray"],
							trapezoidProps.animationDuration,
							trapezoidProps.animationEasing,
						)

					return (
						<JavascriptAnimate
							animationId={animationId()}
							canBegin={totalLength() > 0}
							duration={trapezoidProps.animationDuration}
							easing={trapezoidProps.animationEasing}
							isActive={trapezoidProps.isUpdateAnimationActive}
							begin={trapezoidProps.animationBegin}
						>
							{(t: () => number) => {
								/* GOTCHA-014: thunk children — write prev via effect to avoid stale-memo drift.
								   Upstream reads prev* refs once per Trapezoid render, so the start point
								   is frozen until geometry props change. */
								const start = createMemo(() => {
									void trapezoidProps.upperWidth
									void trapezoidProps.lowerWidth
									void trapezoidProps.height
									void trapezoidProps.x
									void trapezoidProps.y
									return untrack(() => ({
										height: prevHeight,
										lowerWidth: prevLowerWidth,
										upperWidth: prevUpperWidth,
										x: prevX,
										y: prevY,
									}))
								})
								const currUpperWidth = createMemo(() =>
									interpolate(start().upperWidth, trapezoidProps.upperWidth, t()),
								)
								const currLowerWidth = createMemo(() =>
									interpolate(start().lowerWidth, trapezoidProps.lowerWidth, t()),
								)
								const currHeight = createMemo(() => interpolate(start().height, trapezoidProps.height, t()))
								const currX = createMemo(() => interpolate(start().x, trapezoidProps.x, t()))
								const currY = createMemo(() => interpolate(start().y, trapezoidProps.y, t()))
								createEffect(
									() => (t() > 0 ? { prevHeight: currHeight(), prevLowerWidth: currLowerWidth(), prevUpperWidth: currUpperWidth(), prevX: currX(), prevY: currY() } : null),
									(step) => {
										if (step != null && pathRef) {
											prevUpperWidth = step.prevUpperWidth
											prevLowerWidth = step.prevLowerWidth
											prevHeight = step.prevHeight
											prevX = step.prevX
											prevY = step.prevY
										}
									},
								)
								const animationStyle = createMemo(() =>
									t() > 0
										? { "stroke-dasharray": to(), transition: transition() }
										: { "stroke-dasharray": from() },
								)
								return (
									<path
										{...svgPropertiesAndEvents(trapezoidProps)}
										class={layerClass()}
										d={getTrapezoidPath(
											currX(),
											currY(),
											currUpperWidth(),
											currLowerWidth(),
											currHeight(),
										)}
										ref={capturePathRef}
										style={{
											...animationStyle(),
											...(typeof trapezoidProps.style === "object" ? trapezoidProps.style : {}),
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
