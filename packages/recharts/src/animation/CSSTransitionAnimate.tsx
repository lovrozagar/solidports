import { createEffect, createMemo, createSignal, mergeProps, onCleanup, type JSX } from "solid-js"
import type { AnimationManager, ReactSmoothStyle } from "./AnimationManager"
import { useAnimationManager } from "./useAnimationManager"
import { Global } from "../util/Global"

type CSSTransitionAnimateProps = {
	animationId: string
	animationManager?: AnimationManager
	attributeName: string
	begin?: number
	canBegin?: boolean
	children: (style: Record<string, string | number> | undefined) => JSX.Element
	duration?: number
	easing?: string
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

export function CSSTransitionAnimate(outsideProps: CSSTransitionAnimateProps) {
	/* mergeProps keeps from/to/canBegin/isActive/children as live getters.
	 * resolveDefaultProps would freeze them at setup — see GOTCHA-005-C. */
	const props = mergeProps(defaultProps, outsideProps)

	const isActive = createMemo(() =>
		props.isActive === "auto" ? Global.isSsr === false : props.isActive,
	)

	const animationManager = useAnimationManager(
		() => props.animationId + props.attributeName,
		/* eslint-disable-next-line solid/reactivity -- animationManager is a stable reference; passed once to factory */
		props.animationManager,
	)
	/* eslint-disable solid/reactivity -- reads initial state to seed signal; subsequent changes handled by createEffect below */
	const [style, setStyle] = createSignal<ReactSmoothStyle>(
		isActive() === false ? props.to : props.from,
	)
	/* eslint-enable solid/reactivity */
	/* Plain mutable mirrors React's useRef — flipping it must NOT trigger a
	 * re-render. Re-renders happen only when `style` changes (signal) or
	 * canBegin/isActive flip. The post-start render then reads the flag and
	 * adds `transition`. */
	let initialized = false

	/* Anonymous function — name must be empty so the queue's serialized label
	 * reads `[function anonymous]`. A const-bound arrow inherits the binding
	 * name; wrapping in an IIFE strips it. Mirrors upstream's `useCallback(()
	 * => {...})` where the cached fn is unnamed. */
	/* eslint-disable-next-line solid/reactivity -- inner fn reads props.from at call-time (animation start event); intentionally untracked — IIFE strips the binding name per comment above */
	const onAnimationStart: () => void = (() => () => {
		setStyle(props.from)
		props.onAnimationStart()
	})()

	createEffect(() => {
		if (isActive() === false || props.canBegin === false) {
			return
		}

		initialized = true
		const manager = animationManager()
		const unsubscribe = manager.subscribe(setStyle)
		manager.start([
			onAnimationStart,
			props.begin,
			props.to,
			props.duration,
			props.onAnimationEnd,
		])

		onCleanup(() => {
			manager.stop()
			if (unsubscribe) {
				unsubscribe()
			}
			props.onAnimationEnd()
		})
	})

	const childStyle = createMemo<Record<string, string | number> | undefined>(() => {
		/* Always read `style()` so the memo tracks it regardless of which
		 * branch we currently take. Otherwise: memo first evaluates with
		 * initialized=false, never reads style, never subscribes — when the
		 * start-effect later flips initialized and setStyle fires, the memo
		 * has no dependency on style and doesn't re-evaluate. */
		const styleNow = style()
		if (isActive() === false) {
			return { [props.attributeName]: props.to }
		}
		if (props.canBegin === false) {
			return { [props.attributeName]: props.from }
		}
		if (initialized) {
			return {
				transition: `${props.attributeName} ${props.duration}ms ${props.easing}`,
				[props.attributeName]: styleNow as string,
			}
		}
		return { [props.attributeName]: props.from }
	})

	/* Wrap in fragment so the children call is a reactive computation; a bare
	 * `return props.children(...)` evaluates once at setup. */
	return <>{props.children(childStyle())}</>
}
