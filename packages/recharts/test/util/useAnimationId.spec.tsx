import { describe, it, expect } from "vitest"
import { createRoot, createSignal, flush, untrack } from 'solid-js';
import { useAnimationId } from "../../src/util/useAnimationId"

describe("useAnimationId", () => {
	it("should return a unique animation id", () => {
		createRoot((dispose) => {
			const input = { foo: "bar" }
			const prefix = "test-"
			const animationId = untrack(() => useAnimationId(() => input, prefix))
			expect(animationId()).toBeDefined()
			expect(animationId().startsWith(prefix)).toBe(true)
			dispose()
		})
	})
	it("should change animation id when input changes", () => {
		const input1 = { foo: "bar" }
		const input2 = { foo: "baz" }
		const prefix = "test-"

		const [input, setInput] = createSignal<Record<string, string>>(input1)
		/* Writes happen outside the root; Solid 2 rejects writes from an owned scope. */
		const { animationId, dispose } = createRoot((dispose) => ({
			animationId: useAnimationId(input, prefix),
			dispose,
		}))

		const animationId1 = untrack(animationId)

		setInput(input2)
		flush()

		const animationId2 = untrack(animationId)

		expect(animationId1).not.toEqual(animationId2)
		dispose()
	})
	it("should not change animation id when input does not change", () => {
		createRoot((dispose) => {
			const input1 = { foo: "bar" }
			const prefix = "test-"

			const [input] = createSignal(input1)
			const animationId = untrack(() => useAnimationId(input, prefix))

			const animationId1 = animationId()

			/* Read again without changing the signal */
			const animationId2 = animationId()

			expect(animationId1).toBe(animationId2)
			dispose()
		})
	})
})
