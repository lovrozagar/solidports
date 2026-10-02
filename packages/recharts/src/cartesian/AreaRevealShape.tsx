import { createMemo, Show } from 'solid-js';
import { splitProps } from "../util/solid-1-compat"
import type { JSX } from '@solidjs/web';
import { isNumber } from "../util/DataUtils"
import { Curve, type BaseLineType, type Props as CurveProps } from "../shape/Curve"
import type { CartesianLayout, LayoutType, ShapeAnimationProps } from "../util/types"
import { isWellBehavedNumber } from "../util/isWellBehavedNumber"
import { Layer } from "../container/Layer"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { useId } from "../util/useId"

interface ClipRectProps {
	alpha: number
	points: ReadonlyArray<{ x?: number | null; y?: number | null }>
	baseLine: BaseLineType | undefined
	strokeWidth: string | number | undefined
}

type RectAttributes = { x: number; y: number; width: number; height: number }

function strokeAllowance(strokeWidth: ClipRectProps["strokeWidth"]): number {
	return strokeWidth ? parseInt(`${strokeWidth}`, 10) : 1
}

function horizontalClipRect(rect: ClipRectProps): RectAttributes | null {
	const startX = rect.points[0]?.x
	const endX = rect.points[rect.points.length - 1]?.x
	if (!isWellBehavedNumber(startX) || !isWellBehavedNumber(endX)) {
		return null
	}
	const width = rect.alpha * Math.abs(startX - endX)
	let maxY = Math.max(...rect.points.map((entry) => entry.y || 0))
	if (isNumber(rect.baseLine)) {
		maxY = Math.max(rect.baseLine, maxY)
	} else if (rect.baseLine && Array.isArray(rect.baseLine) && rect.baseLine.length) {
		maxY = Math.max(...rect.baseLine.map((entry) => entry.y || 0), maxY)
	}
	if (!isNumber(maxY)) {
		return null
	}
	return {
		height: Math.floor(maxY + strokeAllowance(rect.strokeWidth)),
		width,
		x: startX < endX ? startX : startX - width,
		y: 0,
	}
}

function verticalClipRect(rect: ClipRectProps): RectAttributes | null {
	const startY = rect.points[0]?.y
	const endY = rect.points[rect.points.length - 1]?.y
	if (!isWellBehavedNumber(startY) || !isWellBehavedNumber(endY)) {
		return null
	}
	const height = rect.alpha * Math.abs(startY - endY)
	let maxX = Math.max(...rect.points.map((entry) => entry.x || 0))
	if (isNumber(rect.baseLine)) {
		maxX = Math.max(rect.baseLine, maxX)
	} else if (rect.baseLine && Array.isArray(rect.baseLine) && rect.baseLine.length) {
		maxX = Math.max(...rect.baseLine.map((entry) => entry.x || 0), maxX)
	}
	if (!isNumber(maxX)) {
		return null
	}
	return {
		height: Math.floor(height),
		width: maxX + strokeAllowance(rect.strokeWidth),
		x: 0,
		y: startY < endY ? startY : startY - height,
	}
}

function RevealClipRect(clipProps: ClipRectProps & { layout: CartesianLayout }) {
	const rect = createMemo(() =>
		clipProps.layout === "vertical" ? verticalClipRect(clipProps) : horizontalClipRect(clipProps),
	)
	return (
		<Show when={rect()}>
			{(attributes) => (
				<rect
					x={attributes().x}
					y={attributes().y}
					width={attributes().width}
					height={attributes().height}
				/>
			)}
		</Show>
	)
}

export type AreaRevealShapeProps = CurveProps &
	ShapeAnimationProps & { layout?: LayoutType; isRange?: boolean }

/**
 * Default Area shape. Renders the fill curve, the stroke curve, and for ranged areas the
 * baseline stroke curve. During the entrance animation all of them are
 * wrapped in a clip-path that progressively reveals the area.
 *
 * This is the built-in entrance animation for Area. It is automatically used when no custom
 * `shape` prop is provided. You can import and reuse it as a starting point for custom shapes.
 *
 * @example
 * ```tsx
 * import { Area, AreaRevealShape } from '@solidports/recharts';
 *
 * // Use the default shape explicitly (same as providing no shape prop)
 * <Area dataKey="value" shape={AreaRevealShape} />
 * ```
 *
 * @see {@link https://recharts.github.io/en-US/guide/animations Animation guide}
 *
 * @since 3.9
 */
export function AreaRevealShape(props: AreaRevealShapeProps): JSX.Element {
	const [local, restProps] = splitProps(props, [
		"animationElapsedTime",
		"isAnimating",
		"isEntrance",
		"layout",
		"isRange",
		"stroke",
		"connectNulls",
	])
	const [idAndBaseLine, propsWithoutIdBaseline] = splitProps(restProps, ["id", "baseLine"])
	const layout = (): CartesianLayout => (local.layout === "vertical" ? "vertical" : "horizontal")
	const connectNulls = () => local.connectNulls ?? false
	const animationElapsedTime = () => local.animationElapsedTime ?? 1
	const clipId = useId()
	const strokeSvgProps = createMemo(() => svgPropertiesNoEvents(propsWithoutIdBaseline))

	const curves = (): JSX.Element => (
		<>
			<Curve
				{...restProps}
				id={idAndBaseLine.id}
				baseLine={idAndBaseLine.baseLine}
				connectNulls={connectNulls()}
				stroke="none"
				class="recharts-area-area"
				layout={layout()}
			/>
			<Show when={local.stroke !== "none"}>
				<Curve
					{...strokeSvgProps()}
					class="recharts-area-curve"
					layout={layout()}
					type={restProps.type}
					connectNulls={connectNulls()}
					fill="none"
					stroke={local.stroke}
					points={restProps.points}
				/>
			</Show>
			<Show when={local.stroke !== "none" && local.isRange && Array.isArray(idAndBaseLine.baseLine)}>
				<Curve
					{...strokeSvgProps()}
					class="recharts-area-curve"
					layout={layout()}
					type={restProps.type}
					connectNulls={connectNulls()}
					fill="none"
					stroke={local.stroke}
					points={idAndBaseLine.baseLine as CurveProps["points"]}
				/>
			</Show>
		</>
	)

	return (
		<Show
			when={(local.isEntrance ?? false) && ((local.isAnimating ?? false) || animationElapsedTime() < 1)}
			fallback={curves()}
		>
			<Layer>
				<defs>
					<clipPath id={clipId}>
						<RevealClipRect
							alpha={animationElapsedTime()}
							points={restProps.points ?? []}
							baseLine={idAndBaseLine.baseLine}
							layout={layout()}
							strokeWidth={restProps.strokeWidth}
						/>
					</clipPath>
				</defs>
				<Layer clip-path={`url(#${clipId})`}>{curves()}</Layer>
			</Layer>
		</Show>
	)
}
