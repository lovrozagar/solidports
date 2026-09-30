import { createEffect, createMemo, createSignal, mergeProps, onCleanup, type JSX } from "solid-js"
import configUpdate from "./configUpdate"
import { configEasing } from "./easing"
import type { EasingInput } from "./easing"
import type { AnimationManager } from "./AnimationManager"
import { useAnimationManager } from "./useAnimationManager"
import { Global } from "../util/Global"

type JavascriptAnimateProps = {
	animationId: string
	animationManager?: AnimationManager
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

type TimeAsObject = {
	t: number
}

const from: TimeAsObject = { t: 0 }
const to: TimeAsObject = { t: 1 }

export function JavascriptAnimate(outsideProps: JavascriptAnimateProps) {
	/* mergeProps preserves the props proxy lazily so child callbacks and
	 * downstream toggles (isActive, canBegin) stay reactive. resolveDefaultProps
	 * would freeze them at setup — see GOTCHA-005-C. */
	const props = mergeProps(defaultJavascriptAnimateProps, outsideProps)

	const isActive = createMemo(() =>
		props.isActive === "auto" ? Global.isSsr === false : props.isActive,
	)

	const animationManager = useAnimationManager(
		() => props.animationId,
		/* eslint-disable-next-line solid/reactivity -- animationManager is a stable reference; passed once to factory, not reactive */
		props.animationManager,
	)

	/* eslint-disable-next-line solid/reactivity -- reads initial isActive() to seed signal; subsequent changes handled by createEffect below */
	const [style, setStyle] = createSignal<TimeAsObject>(isActive() ? from : to)
	let stopJSAnimation: (() => void) | null = null

	createEffect(() => {
		if (isActive() === false) {
			setStyle(to)
		}
	})

	/* GOTCHA-014-G: when animationId flips, style holds last animation's t=1.
	   Downstream `tValue === 1` shortcuts (Line/Radar stepData) skip prev-point
	   interpolation and render the new dataset directly, defeating the whole
	   "previousPoints" mechanism. Reset to from BEFORE the new manager.start
	   schedules its first frame so the very next render reads t=0. */
	createEffect((prev: string | undefined) => {
		const id = props.animationId
		if (prev !== undefined && prev !== id && isActive()) {
			setStyle(from)
		}
		return id
	})

	createEffect(() => {
		if (isActive() === false || props.canBegin === false) {
			return
		}

		const manager = animationManager()
		const startAnimation = configUpdate<TimeAsObject>(
			from,
			to,
			configEasing(props.easing),
			props.duration,
			setStyle,
			manager.getTimeoutController(),
		)

		const onAnimationActive = () => {
			stopJSAnimation = startAnimation()
		}

		manager.start([
			props.onAnimationStart,
			props.begin,
			onAnimationActive,
			props.duration,
			props.onAnimationEnd,
		])

		onCleanup(() => {
			manager.stop()
			if (stopJSAnimation) {
				stopJSAnimation()
			}
			props.onAnimationEnd()
		})
	})

	/* perf: invoke children ONCE at setup. The accessor `() => style().t` is
	   reactive on its own, so consumers reading `t()` inside their createMemo
	   subscribe to the style signal directly. Wrapping the call in a Fragment
	   `<>{...}</>` previously made the JSX `_$insert` re-run children() per
	   tick — re-creating every createMemo/createEffect inside the children
	   thunk and triggering Solid's cleanNode tear-down per frame (the dominant
	   hot spot in the CPU profile, ~25ms over 500ms animation). Building the
	   subtree at setup, returning it directly, lets attribute bindings
	   (currX/currY/currWidth/currHeight memos) update in place. */
	/* eslint-disable-next-line solid/reactivity -- intentional one-time children() call at setup for perf (see comment above); () => style().t is a reactive accessor */
	const subtree = props.children(() => style().t)
	return subtree
}
