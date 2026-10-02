import { untrack } from "solid-js"
import type { Accessor } from "solid-js"
import { round } from "../util/round"

/**
 * Tracks the animated visible length of a Line's SVG path across data changes.
 *
 * Invariants:
 * 1. The visible length only grows (monotonically non-decreasing with animationElapsedTime).
 * 2. The visible length changes continuously — no jumps when data changes mid-animation.
 *    This is achieved by tracking the maximum animated length in pixels and using it
 *    as the starting point for the next animation.
 * 3. Once the line reaches 100% visibility, it never becomes partially visible again.
 *    In that case the callback returns `null`, meaning no animation stroke-dasharray is needed.
 *
 * @param animationInput Identity of the current data. When it changes, the next call
 *   starts a new animation from the current visible length.
 * @returns A callback `(animationElapsedTime, totalLength) => number | null` where:
 *   - `animationElapsedTime` is the animation progress (0 to 1)
 *   - `totalLength` is the current total length of the SVG path in pixels
 *   - returns the visible length in pixels, or `null` if the line is fully visible
 */
export function useAnimatedLineLength(
	animationInput: Accessor<unknown>,
): (animationElapsedTime: number, totalLength: number) => number | null {
	let startingLength = 0
	let maxAnimatedLength = 0
	let reachedFull = false
	let prevInput = untrack(animationInput)

	return (animationElapsedTime: number, totalLength: number): number | null => {
		const input = animationInput()
		if (input !== prevInput) {
			startingLength = maxAnimatedLength
			prevInput = input
		}

		if (reachedFull) {
			return null
		}

		const visibleLength = Math.min(round(startingLength + animationElapsedTime * totalLength), totalLength)

		if (animationElapsedTime > 0 && totalLength > 0) {
			maxAnimatedLength = Math.max(maxAnimatedLength, visibleLength)
			if (visibleLength >= totalLength) {
				reachedFull = true
				return null
			}
		}

		return visibleLength
	}
}
