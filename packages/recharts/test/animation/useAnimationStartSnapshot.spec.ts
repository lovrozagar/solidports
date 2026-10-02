import { createRoot, createSignal, flush } from "solid-js"
import { afterEach, describe, expect, it } from "vitest"
import { useAnimationStartSnapshot } from "../../src/animation/useAnimationStartSnapshot"
import type { AnimationStartSnapshot } from "../../src/animation/useAnimationStartSnapshot"

function createMutableRef<T>(current: T): { current: T } {
	return { current }
}

const disposers: Array<() => void> = []

afterEach(() => {
	disposers.splice(0).forEach((dispose) => dispose())
})

/* Solid counterpart of renderHook: the animation input is a signal, `rerender` writes it. */
function renderSnapshot<T>(
	initialInput: string,
	previousValueRef: { current: T },
): { result: AnimationStartSnapshot<T>; rerender: (animationInput: string) => void } {
	const [animationInput, setAnimationInput] = createSignal(initialInput)
	const result = createRoot((dispose) => {
		disposers.push(dispose)
		return useAnimationStartSnapshot(animationInput, previousValueRef)
	})
	flush()
	return {
		rerender: (next: string) => {
			setAnimationInput(next)
			flush()
		},
		result,
	}
}

describe("useAnimationStartSnapshot", () => {
	it("should expose the current ref value as the initial startValue", () => {
		const previousValueRef = createMutableRef("frame-10")

		const { result } = renderSnapshot("animation-a", previousValueRef)

		expect(result.startValue()).toBe("frame-10")
	})

	it("should keep startValue frozen for the duration of the same animation cycle", () => {
		const previousValueRef = createMutableRef("frame-10")

		const { result, rerender } = renderSnapshot("animation-a", previousValueRef)

		result.syncStepValue("frame-40", 0.4)
		flush()

		expect(previousValueRef.current).toBe("frame-40")

		rerender("animation-a")

		expect(result.startValue()).toBe("frame-10")
	})

	it("should capture the previous ref value as the new startValue when animationInput changes", () => {
		const previousValueRef = createMutableRef("frame-40")

		const { result, rerender } = renderSnapshot("animation-a", previousValueRef)

		rerender("animation-b")

		expect(result.startValue()).toBe("frame-40")

		result.syncStepValue("frame-52", 0.4)
		flush()

		expect(previousValueRef.current).toBe("frame-40")

		rerender("animation-b")

		expect(result.startValue()).toBe("frame-40")
	})

	it("should unlock commits at t=0 without mutating the live ref", () => {
		const previousValueRef = createMutableRef("frame-40")

		const { result, rerender } = renderSnapshot("animation-a", previousValueRef)

		rerender("animation-b")

		result.syncStepValue("frame-40", 0)
		flush()

		expect(previousValueRef.current).toBe("frame-40")

		result.syncStepValue("frame-41", 0.1)
		flush()

		expect(previousValueRef.current).toBe("frame-41")
	})

	it("should honor canCommit=false even after the new animation has been armed", () => {
		const previousValueRef = createMutableRef("frame-40")

		const { result, rerender } = renderSnapshot("animation-a", previousValueRef)

		rerender("animation-b")

		result.syncStepValue("frame-40", 0)
		result.syncStepValue("frame-41", 0.1, false)
		flush()

		expect(previousValueRef.current).toBe("frame-40")

		result.syncStepValue("frame-42", 0.2, true)
		flush()

		expect(previousValueRef.current).toBe("frame-42")
	})

	it("should use the completed frame as the startValue for the next animation cycle", () => {
		const previousValueRef = createMutableRef("frame-10")

		const { result, rerender } = renderSnapshot("animation-a", previousValueRef)

		result.syncStepValue("frame-100", 1)
		flush()

		expect(previousValueRef.current).toBe("frame-100")

		rerender("animation-b")

		expect(result.startValue()).toBe("frame-100")
	})

	it("should update the frozen snapshot to the completed frame after t=1 in the same cycle", () => {
		const previousValueRef = createMutableRef("frame-10")

		const { result, rerender } = renderSnapshot("animation-a", previousValueRef)

		result.syncStepValue("frame-100", 1)
		flush()

		rerender("animation-a")

		expect(result.startValue()).toBe("frame-100")
	})
})
