import { createMemo, createSignal, untrack, createEffect } from "solid-js"
import type { Accessor } from "solid-js"
import type { JSX } from "@solidjs/web"
import { useAnimationController } from "./useAnimationController"
import { getTransitionVal } from "./util"
import { resolveIsAnimationActive, usePrefersReducedMotion } from "../util/usePrefersReducedMotion"
import { CSSTransitionAnimation } from "./AnimationHandle"
import { RequestAnimationFrameTimeoutController } from "./timeoutController"
import type { EasingInput, NamedBezier } from "./easing"
import type { AnimationController } from "./AnimationController"

import { mergeProps } from "../util/solid-1-compat"
type CSSTransitionAnimateProps = {
	animationController?: AnimationController
	animationId: string
	attributeName: string
	begin?: number
	canBegin?: boolean
	/* Children receive an accessor and are invoked once, like JavascriptAnimate. A CSS
	   transition only runs when the SAME element changes its style: re-invoking children
	   per style change would mount a new element already at `to`, and nothing animates. */
	children: (style: Accessor<Record<string, string | number>>) => JSX.Element
	duration?: number
	easing?: NamedBezier
	from: string
	isActive?: boolean | "auto"
	onAnimationEnd?: () => void
	onAnimationStart?: () => void
	to: string
}

const defaultProps = {
	begin: 0,
	canBegin: true,
	duration: 1000,
	easing: "ease",
	isActive: true,
	onAnimationEnd: () => {},
	onAnimationStart: () => {},
} as const satisfies Partial<CSSTransitionAnimateProps>

export function extractCssEasing(easingInput: EasingInput): NamedBezier | undefined {
	if (easingInput === "spring" || typeof easingInput !== "string") {
		return undefined
	}
	return easingInput
}

export function CSSTransitionAnimate(outsideProps: CSSTransitionAnimateProps) {
	/* mergeProps keeps from/to/canBegin/isActive/children as live getters.
	 * resolveDefaultProps would freeze them at setup — see GOTCHA-005-C. */
	const props = mergeProps(defaultProps, outsideProps)

	const prefersReducedMotion = usePrefersReducedMotion()
	const isActive = createMemo(() => resolveIsAnimationActive(props.isActive, prefersReducedMotion))

	const animationController = useAnimationController(() => props.animationController)
	const [style, setStyle] = createSignal<string | number>(
		untrack(() => (isActive() === false ? props.to : props.from)),
	)
	/* Plain mutable mirrors React's useRef — flipping it must NOT trigger a
	 * re-render. Re-renders happen only when `style` changes (signal) or
	 * canBegin/isActive flip. The post-start render then reads the flag and
	 * adds `transition`. */
	let initialized = false

	createEffect(
		() =>
			isActive() === false || !props.canBegin
				? null
				: {
						animationId: props.animationId + props.attributeName,
						begin: props.begin,
						controller: animationController(),
						duration: props.duration,
						easing: props.easing,
						from: props.from,
						onAnimationEnd: props.onAnimationEnd,
						onAnimationStart: props.onAnimationStart,
						to: props.to,
					},
		(run) => {
			if (run == null) {
				return undefined
			}
			initialized = true

			const animation = new CSSTransitionAnimation({
				animationBegin: run.begin,
				animationDuration: run.duration,
				animationId: run.animationId,
				easing: run.easing,
				from: run.from,
				onAnimationEnd: run.onAnimationEnd,
				onAnimationStart: () => {
					setStyle(run.from)
					run.onAnimationStart()
				},
				to: run.to,
			})

			return run.controller(new RequestAnimationFrameTimeoutController(), animation, setStyle)
		},
	)

	const childStyle = createMemo<Record<string, string | number>>(() => {
		/* Always read `style()` so the memo tracks it regardless of which
		 * branch we currently take. Otherwise: memo first evaluates with
		 * initialized=false, never reads style, never subscribes — when the
		 * start-effect later flips initialized and setStyle fires, the memo
		 * has no dependency on style and doesn't re-evaluate. */
		const styleNow = style()
		if (isActive() === false) {
			return { [props.attributeName]: props.to }
		}
		if (!props.canBegin) {
			return { [props.attributeName]: props.from }
		}
		if (initialized) {
			return {
				transition: getTransitionVal([props.attributeName], props.duration, props.easing),
				[props.attributeName]: styleNow,
			}
		}
		return { [props.attributeName]: props.from }
	})

	/* eslint-disable-next-line solid/reactivity -- one-time children() call keeps element identity; childStyle is reactive */
	return untrack(() => props.children(childStyle))
}
