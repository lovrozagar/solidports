import { createMemo, createSignal, untrack, createEffect } from "solid-js"
import type { JSX } from "@solidjs/web"
import { createEasingFunction } from "./easing"
import type { EasingInput } from "./easing"
import { useAnimationController } from "./useAnimationController"
import { resolveIsAnimationActive, usePrefersReducedMotion } from "../util/usePrefersReducedMotion"
import { JavascriptAnimation } from "./AnimationHandle"
import { RequestAnimationFrameTimeoutController } from "./timeoutController"
import type { AnimationController } from "./AnimationController"

import { mergeProps } from "../util/solid-1-compat"
type JavascriptAnimateProps = {
	animationController?: AnimationController
	animationId: string
	begin?: number
	canBegin?: boolean
	/* Children receives an Accessor<number> instead of a plain number. Solid
	   evaluates the children fn ONCE at setup and the returned JSX is mounted
	   stable across animation ticks; reading `t()` inside reactive attribute
	   slots (e.g. `<path d={getD(t())}/>`) updates only the attribute, not the
	   element identity. Plain-value children gets re-instantiated every tick,
	   replacing the DOM node on each render — tests holding a captured DOM ref
	   see stale attributes. */
	children: (time: () => number) => JSX.Element
	duration?: number
	easing?: EasingInput
	isActive?: boolean | "auto"
	onAnimationEnd?: () => void
	onAnimationStart?: () => void
}

const defaultJavascriptAnimateProps = {
	begin: 0,
	canBegin: true,
	duration: 1000,
	easing: "ease",
	isActive: true,
	onAnimationEnd: () => {},
	onAnimationStart: () => {},
} as const satisfies Partial<JavascriptAnimateProps>

const from = 0
const to = 1

export function JavascriptAnimate(outsideProps: JavascriptAnimateProps) {
	/* mergeProps preserves the props proxy lazily so child callbacks and
	 * downstream toggles (isActive, canBegin) stay reactive. resolveDefaultProps
	 * would freeze them at setup — see GOTCHA-005-C. */
	const props = mergeProps(defaultJavascriptAnimateProps, outsideProps)

	const prefersReducedMotion = usePrefersReducedMotion()
	const isActive = createMemo(() => resolveIsAnimationActive(props.isActive, prefersReducedMotion))

	const animationController = useAnimationController(() => props.animationController)

	/* Each committed frame is tagged with the animation that produced it. When
	   animationId flips, the previous animation's frame no longer applies and
	   time reads `from` immediately, the same as upstream remounting
	   JavascriptAnimate via `key={animationId}`; no stale `t=1` frame leaks into
	   the new animation's first render (GOTCHA-014-G). */
	const [frame, setFrame] = createSignal<{ animationId: string; t: number }>(
		untrack(() => ({ animationId: props.animationId, t: isActive() ? from : to })),
	)
	const time = createMemo(() => {
		if (!isActive()) {
			return to
		}
		const current = frame()
		return current.animationId === props.animationId ? current.t : from
	})

	createEffect(
		() =>
			isActive() === false || !props.canBegin
				? null
				: {
						animationId: props.animationId,
						begin: props.begin,
						controller: animationController(),
						duration: props.duration,
						easing: props.easing,
						onAnimationEnd: props.onAnimationEnd,
						onAnimationStart: props.onAnimationStart,
					},
		(run) => {
			if (run == null) {
				return undefined
			}
			const easingFunction = createEasingFunction(run.easing)
			if (easingFunction == null) {
				return undefined
			}

			const animation = new JavascriptAnimation({
				animationBegin: run.begin,
				animationDuration: run.duration,
				animationId: run.animationId,
				easing: easingFunction,
				from,
				onAnimationEnd: run.onAnimationEnd,
				onAnimationStart: run.onAnimationStart,
				to,
			})

			return run.controller(new RequestAnimationFrameTimeoutController(), animation, (value) =>
				setFrame({ animationId: run.animationId, t: Number(value) }),
			)
		},
	)

	/* perf: invoke children ONCE at setup. The `time` accessor is
	   reactive on its own, so consumers reading `t()` inside their createMemo
	   subscribe to the frame signal directly. Building the subtree at setup and
	   returning it directly lets attribute bindings update in place instead of
	   re-creating every computation inside the children thunk per tick. */
	/* eslint-disable-next-line solid/reactivity -- intentional one-time children() call at setup for perf (see comment above); time is a reactive accessor */
	const subtree = props.children(time)
	return subtree
}
