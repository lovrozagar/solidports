import { createEffect, createMemo, createSignal, Show, untrack } from "solid-js"
import type { Accessor } from "solid-js"
import type { JSX } from "@solidjs/web"
import { JavascriptAnimate } from "./JavascriptAnimate"
import type { EasingInput } from "./easing"
import { useAnimationId } from "../util/useAnimationId"
import { matchAnimationItems, matchByIndex } from "./matchBy"
import type { AnimationItem, AnimationMatchByProp } from "./matchBy"
import { useAnimationStartSnapshot } from "./useAnimationStartSnapshot"
import type { CartesianLayout, PolarLayout } from "../util/types"
import type { AnimationInterpolateFn } from "../state/types/AnimationSettings"

export type { AnimationInterpolateFn }

/**
 * Tracks animation state and provides callbacks for animation start/end.
 *
 * @param onAnimationStart optional callback to call when animation starts
 * @param onAnimationEnd optional callback to call when animation ends
 */
export function useAnimationCallbacks(
	onAnimationStart: Accessor<(() => void) | undefined> = () => undefined,
	onAnimationEnd: Accessor<(() => void) | undefined> = () => undefined,
): {
	isAnimating: Accessor<boolean>
	handleAnimationStart: () => void
	handleAnimationEnd: () => void
} {
	const [isAnimating, setIsAnimating] = createSignal(false)

	const handleAnimationStart = () => {
		const callback = untrack(onAnimationStart)
		if (typeof callback === "function") {
			callback()
		}
		setIsAnimating(true)
	}

	const handleAnimationEnd = () => {
		const callback = untrack(onAnimationEnd)
		if (typeof callback === "function") {
			callback()
		}
		setIsAnimating(false)
	}

	return { handleAnimationEnd, handleAnimationStart, isAnimating }
}

export type AnimatedItemsProps<ItemType, LayoutType extends CartesianLayout | PolarLayout> = {
	/**
	 * Opaque input to detect when a new animation should start.
	 * When this value changes, a new animation begins.
	 */
	animationInput: unknown
	/** Prefix for the generated animation ID */
	animationIdPrefix: string
	/** The target items to animate towards */
	items: ReadonlyArray<ItemType> | undefined
	/** Ref holding previous items — used to detect first render vs data update */
	previousItemsRef: { current: ReadonlyArray<ItemType> | null | undefined }
	/** Whether animation is active */
	isAnimationActive: boolean | "auto"
	/** Delay in ms before animation begins */
	animationBegin: number
	/** Duration of animation in ms */
	animationDuration: number
	/** Easing function or named easing */
	animationEasing: EasingInput
	/** Called when the animation begins */
	onAnimationStart?: () => void
	/** Called when the animation completes */
	onAnimationEnd?: () => void
	/** The interpolation function — either the default or user-provided */
	animationInterpolateFn: AnimationInterpolateFn<ItemType, LayoutType>
	/**
	 * Strategy for matching previous items to next items during animation.
	 *
	 * - `matchByIndex` (default): match by array index with proportional stretching
	 * - `matchAppend`: match 1:1 by index, extras animate in as new
	 * - A function `(item, index) => key`: match by the returned key value
	 */
	animationMatchBy?: AnimationMatchByProp<ItemType>
	/**
	 * Optional guard for updating previousItemsRef. Default: `(animationElapsedTime) => animationElapsedTime > 0`.
	 * Line uses `(animationElapsedTime) => animationElapsedTime > 0 && totalLength > 0` to avoid updating before SVG path is measured.
	 */
	shouldUpdatePreviousRef?: (animationElapsedTime: number) => boolean
	/**
	 * Render with interpolated items and animation state. Invoked once; the
	 * accessors update in place on every animation frame.
	 *
	 * @param items The interpolated items at the current animation frame
	 * @param animationElapsedTime The normalized time (0-1), useful for additional animation effects
	 * @param isEntrance Whether this is the first render (entrance animation) or a data update animation.
	 */
	children: (
		items: Accessor<ReadonlyArray<ItemType>>,
		animationElapsedTime: Accessor<number>,
		isEntrance: Accessor<boolean>,
	) => JSX.Element
	layout: LayoutType
}

/**
 * A reusable animation wrapper for array-based chart data.
 *
 * Encapsulates the common animation pattern shared by Bar, Scatter, Funnel, Pie,
 * Radar, RadialBar, Area, and Line:
 * 1. Track previous items in a ref
 * 2. Wrap in JavascriptAnimate
 * 3. Update ref when animationElapsedTime > 0
 *
 * @since 3.9
 */
export function AnimatedItems<ItemType, LayoutType extends CartesianLayout | PolarLayout>(
	props: AnimatedItemsProps<ItemType, LayoutType>,
) {
	const animationId = useAnimationId(
		() => props.animationInput,
		untrack(() => props.animationIdPrefix),
	)
	const animationStartItems = useAnimationStartSnapshot(
		animationId,
		/* eslint-disable-next-line solid/reactivity -- the ref box is a stable mutable container owned by the caller */
		props.previousItemsRef,
	)
	/* Memoized so per-frame reads do not re-run the caller's selector chain. */
	const items = createMemo(() => props.items)
	const animationItems = createMemo<ReadonlyArray<AnimationItem<ItemType>> | null>(() =>
		matchAnimationItems(
			animationStartItems.frozenStartValue() ?? null,
			items(),
			props.animationMatchBy ?? matchByIndex,
		),
	)

	return (
		<JavascriptAnimate
			animationId={animationId()}
			begin={props.animationBegin}
			duration={props.animationDuration}
			isActive={props.isAnimationActive}
			easing={props.animationEasing}
			onAnimationEnd={props.onAnimationEnd}
			onAnimationStart={props.onAnimationStart}
		>
			{(animationElapsedTime: Accessor<number>) => {
				/* Fixed per render like upstream: a lazy read (e.g. on hover) would see the
				   unpublished t=1 refresh. */
				const isEntrance = createMemo(() => animationStartItems.startValue() == null)
				const stepData = createMemo(() => {
					const current = items()
					if (current == null) {
						return current
					}
					return props.animationInterpolateFn(animationItems(), animationElapsedTime(), props.layout)
				})
				createEffect(
					() => {
						const t = animationElapsedTime()
						const step = stepData()
						const canUpdate =
							props.shouldUpdatePreviousRef != null ? props.shouldUpdatePreviousRef(t) : t > 0
						return { canUpdate, step, t }
					},
					({ canUpdate, step, t }) => {
						animationStartItems.syncStepValue(step ?? null, t, canUpdate)
					},
				)
				return (
					<Show when={stepData() != null}>
						{props.children(
							() => stepData() as ReadonlyArray<ItemType>,
							animationElapsedTime,
							isEntrance,
						)}
					</Show>
				)
			}}
		</JavascriptAnimate>
	)
}
