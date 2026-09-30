/* eslint-disable import/no-cycle */
/**
 * @fileOverview Rectangle
 */
import type { JSX } from "solid-js"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
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
	 * @default false
	 */
	isUpdateAnimationActive?: boolean
	animationBegin?: number
	animationDuration?: AnimationDuration
	animationEasing?: AnimationTiming

	/**
	 * The customized event handler of click on the trapezoid
	 */
	onClick?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mousedown on the trapezoid
	 */
	onMouseDown?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseup on the trapezoid
	 */
	onMouseUp?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mousemove on the trapezoid
	 */
	onMouseMove?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseover on the trapezoid
	 */
	onMouseOver?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseout on the trapezoid
	 */
	onMouseOut?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseenter on the trapezoid
	 */
	onMouseEnter?: (e: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave on the trapezoid
	 */
	onMouseLeave?: (e: MouseEvent) => void
}

export type Props = JSX.PathSVGAttributes<SVGPathElement> & TrapezoidProps

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

export function Trapezoid(outsideProps: Props) {
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

	let prevUpperWidth = trapezoidProps.upperWidth
	let prevLowerWidth = trapezoidProps.lowerWidth
	let prevHeight = trapezoidProps.height
	let prevX = trapezoidProps.x
	let prevY = trapezoidProps.y

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
								/* GOTCHA-014: thunk children — write prev via effect to avoid stale-memo drift. */
								const currUpperWidth = createMemo(() =>
									interpolate(prevUpperWidth, trapezoidProps.upperWidth, t()),
								)
								const currLowerWidth = createMemo(() =>
									interpolate(prevLowerWidth, trapezoidProps.lowerWidth, t()),
								)
								const currHeight = createMemo(() =>
									interpolate(prevHeight, trapezoidProps.height, t()),
								)
								const currX = createMemo(() => interpolate(prevX, trapezoidProps.x, t()))
								const currY = createMemo(() => interpolate(prevY, trapezoidProps.y, t()))
								createEffect(() => {
									if (pathRef && t() > 0) {
										prevUpperWidth = currUpperWidth()
										prevLowerWidth = currLowerWidth()
										prevHeight = currHeight()
										prevX = currX()
										prevY = currY()
									}
								})
								const animationStyle = createMemo(() =>
									t() > 0
										? { strokeDasharray: to(), transition: transition() }
										: { strokeDasharray: from() },
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
