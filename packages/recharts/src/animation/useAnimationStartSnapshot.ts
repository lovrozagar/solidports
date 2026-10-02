import { createMemo, createSignal, untrack } from "solid-js"
import type { Accessor } from "solid-js"

export type AnimationStartSnapshot<T> = {
	/**
	 * The frozen value captured at the start of the current animation cycle.
	 *
	 * Consumers should read from this when computing interpolation pairs.
	 * It intentionally does not drift while the same animation is in progress,
	 * even if multiple frames are rendered for the same animation.
	 */
	startValue: Accessor<T>
	/**
	 * The start value without the `animationElapsedTime=1` refresh. Upstream keeps the
	 * refresh in a ref, so it never re-runs item matching by itself; matching reads this
	 * accessor to keep that behavior, while `startValue` lets `isEntrance` observe it.
	 */
	frozenStartValue: Accessor<T>
	/**
	 * Feed each rendered animation frame back into the snapshot state machine.
	 *
	 * This method serves two jobs:
	 * 1. it "arms" the hook once the new animation has rendered its animationElapsedTime=0 frame, and
	 * 2. it optionally commits later in-flight frames back into the mutable ref so
	 *    future animations can continue smoothly from the latest visible geometry.
	 */
	syncStepValue: (stepValue: T, animationElapsedTime: number, canCommit?: boolean) => void
}

/**
 * Small state machine shared by animated components that need interruption-safe
 * animations.
 *
 * Recharts stores the latest visible animation frame in mutable refs so the next
 * animation can resume from that exact geometry. When an animation is interrupted,
 * frames may be computed before the new animation has emitted its own
 * `animationElapsedTime=0` frame. Reading and writing the same live ref during that
 * window lets the start value of the new animation drift, which produces visible jumps.
 *
 * - `startValue` is a frozen snapshot of the previous animation state, captured
 *   once per animation cycle and kept stable while that cycle is matched and interpolated.
 * - `previousValueRef.current` remains the mutable "latest visible frame" store
 *   that future animations can resume from.
 *
 * Lifecycle:
 * 1. When `animationInput` changes, a new cycle begins. We capture the current ref
 *    value into `startValue` and temporarily block writes.
 * 2. When the new animation renders `animationElapsedTime=0`, we unlock writes.
 * 3. For `animationElapsedTime > 0`, callers may commit the visible frame back into the
 *    mutable ref. Callers can still veto that with `canCommit=false` (for example when
 *    a Line needs to wait until SVG path length has been measured).
 * 4. At `animationElapsedTime=1`, we also refresh the frozen snapshot so later frames in
 *    the completed state observe the finished geometry.
 */
export function useAnimationStartSnapshot<T>(
	animationInput: Accessor<unknown>,
	previousValueRef: { current: T },
): AnimationStartSnapshot<T> {
	/* Blocks writes into the live ref until the new cycle acknowledges its
	   animationElapsedTime=0 frame. Plain mutable state, never read reactively. */
	let isReadyToCommit = true
	let initialized = false
	/* Whether the current cycle rendered a frame before t=1. Plain mutable state. */
	let animatedThisCycle = false

	type Cycle = { value: T }
	const snapshot = createMemo<Cycle>(() => {
		animationInput()
		return untrack(() => {
			if (initialized) {
				isReadyToCommit = false
			}
			initialized = true
			animatedThisCycle = false
			return { value: previousValueRef.current }
		})
	})
	/* The t=1 refresh lives in a plain box like upstream's ref, so later reads see it.
	   It is also published to a signal, scoped to its cycle and written at most once,
	   but only when the cycle actually animated: upstream re-renders the item after
	   onAnimationEnd, while a cycle that jumps straight to t=1 never re-renders. */
	let refreshed: { cycle: Cycle; value: T } | null = null
	const [completed, setCompleted] = createSignal<{ cycle: Cycle; value: T } | null>(null)

	const syncStepValue = (stepValue: T, animationElapsedTime: number, canCommit: boolean = true) => {
		if (animationElapsedTime < 1) {
			animatedThisCycle = true
		}

		if (animationElapsedTime === 0) {
			isReadyToCommit = true
			return
		}

		if (animationElapsedTime === 1) {
			const cycle = untrack(snapshot)
			refreshed = { cycle, value: stepValue }
			if (animatedThisCycle && untrack(completed)?.cycle !== cycle) {
				setCompleted(refreshed)
			}
		}

		if (animationElapsedTime > 0 && isReadyToCommit && canCommit) {
			previousValueRef.current = stepValue
		}
	}

	return {
		frozenStartValue: () => snapshot().value,
		startValue: () => {
			const cycle = snapshot()
			/* tracked so a published refresh re-runs readers */
			completed()
			return refreshed != null && refreshed.cycle === cycle ? refreshed.value : cycle.value
		},
		syncStepValue,
	}
}
