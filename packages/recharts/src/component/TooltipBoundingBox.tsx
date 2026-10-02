/* eslint-disable import/no-cycle, sort-keys */
import { createSignal, onCleanup, onSettled, createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type {
	AllowInDimension,
	AnimationDuration,
	AnimationTiming,
	CartesianViewBox,
	Coordinate,
	PolarCoordinate,
} from "../util/types"
import { getTooltipTranslate } from "../util/tooltip/translate"
import type { ElementOffset, SetElementOffset } from "../util/useElementOffset"
import { usePrefersReducedMotion } from "../util/usePrefersReducedMotion"

function resolveTransitionProperty(args: {
	prefersReducedMotion: boolean
	isAnimationActive: boolean | "auto"
	active: boolean
	animationDuration: number
	animationEasing: AnimationTiming
}): string | undefined {
	if (args.prefersReducedMotion && args.isAnimationActive === "auto") {
		return undefined
	}
	if (args.isAnimationActive && args.active) {
		return `transform ${args.animationDuration}ms ${args.animationEasing}`
	}
	return undefined
}

export type TooltipBoundingBoxProps = {
	active: boolean
	allowEscapeViewBox: AllowInDimension
	animationDuration: AnimationDuration
	animationEasing: AnimationTiming
	children: JSX.Element
	coordinate: Coordinate | PolarCoordinate | undefined
	hasPayload: boolean
	isAnimationActive: boolean | "auto"
	offset: number | Coordinate
	position: Partial<Coordinate> | undefined
	reverseDirection: AllowInDimension
	useTranslate3d: boolean
	viewBox: CartesianViewBox
	wrapperStyle: JSX.CSSProperties
	lastBoundingBox: ElementOffset
	innerRef: SetElementOffset
	hasPortalFromProps: boolean
}

export function TooltipBoundingBox(props: TooltipBoundingBoxProps) {
	const prefersReducedMotion = usePrefersReducedMotion()
	const [dismissed, setDismissed] = createSignal(false)
	const [dismissedAtCoordinate, setDismissedAtCoordinate] = createSignal<Coordinate>({ x: 0, y: 0 })

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			setDismissed(true)
			setDismissedAtCoordinate({
				x: props.coordinate?.x ?? 0,
				y: props.coordinate?.y ?? 0,
			})
		}
	}

	onSettled(() => {
		document.addEventListener("keydown", handleKeyDown)
	})

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown)
	})

	/* Re-show tooltip when coordinate changes after dismiss */
	createEffect(
		() =>
			dismissed() &&
			(props.coordinate?.x !== dismissedAtCoordinate().x ||
				props.coordinate?.y !== dismissedAtCoordinate().y),
		(moved) => {
			if (moved) {
				setDismissed(false)
			}
		},
	)

	const offsetLeft = () => (typeof props.offset === "number" ? props.offset : props.offset.x)
	const offsetTop = () => (typeof props.offset === "number" ? props.offset : props.offset.y)

	const tooltipTranslate = () =>
		getTooltipTranslate({
			allowEscapeViewBox: props.allowEscapeViewBox,
			coordinate: props.coordinate,
			offsetLeft: offsetLeft(),
			offsetTop: offsetTop(),
			position: props.position,
			reverseDirection: props.reverseDirection,
			tooltipBox: {
				height: props.lastBoundingBox.height,
				width: props.lastBoundingBox.width,
			},
			useTranslate3d: props.useTranslate3d,
			viewBox: props.viewBox,
		})

	const isVisible = () => !dismissed() && props.active && props.hasPayload

	/* do not use absolute styles if the user has passed a custom portal prop */
	const positionStyles = (): JSX.CSSProperties =>
		props.hasPortalFromProps
			? {}
			: {
					transition: resolveTransitionProperty({
						prefersReducedMotion,
						isAnimationActive: props.isAnimationActive,
						active: props.active,
						animationDuration: props.animationDuration,
						animationEasing: props.animationEasing,
					}),
					...tooltipTranslate().cssProperties,
					"pointer-events": "none",
					visibility: isVisible() ? "visible" : "hidden",
					position: "absolute",
					top: 0,
					left: 0,
				}

	const outerStyle = (): JSX.CSSProperties => ({
		...positionStyles(),
		visibility: isVisible() ? "visible" : "hidden",
		...props.wrapperStyle,
	})

	return (
		/* This element allow listening to the `Escape` key. See https://github.com/recharts/recharts/pull/2925 */
		<div
			tabindex={-1}
			class={tooltipTranslate().cssClasses}
			style={outerStyle()}
			ref={props.innerRef}
		>
			{props.children}
		</div>
	)
}
