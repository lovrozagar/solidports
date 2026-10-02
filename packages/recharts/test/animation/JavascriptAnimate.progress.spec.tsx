import { createSignal, flush } from "solid-js"
import type { JSX } from "@solidjs/web"
import { render } from "../helper/render"
import { observe } from "../helper/observe"
import { describe, expect, it, vi } from "vitest"
import type { EasingInput } from "../../src/animation/easing"

import { JavascriptAnimate } from "../../src/animation/JavascriptAnimate"
import { CompositeAnimationManager } from "./CompositeAnimationManager"

/* Children receive `Accessor<number>` (GOTCHA-014-H); report every committed
   value to the spy, the Solid counterpart of React calling children per render. */
function trackT(spy: (t: number) => unknown): (t: () => number) => JSX.Element {
	return (t) => {
		observe(() => {
			spy(t())
		})
		return null
	}
}

describe("JavascriptAnimate progress", () => {
	it("should call the function child with the current time", async () => {
		const animationManager = new CompositeAnimationManager()
		const child = vi.fn()

		render(() => (
			<JavascriptAnimate animationId="1" easing="linear" duration={500} animationController={animationManager.factory}>
				{trackT(child)}
			</JavascriptAnimate>
		))

		expect(child).toHaveBeenLastCalledWith(0)
		expect(child).toHaveBeenCalledTimes(1)

		await animationManager.setAnimationProgress(0.3)
		expect(child).toHaveBeenLastCalledWith(0.3)
		expect(child).toHaveBeenCalledTimes(2)

		await animationManager.setAnimationProgress(0.7)
		expect(child).toHaveBeenLastCalledWith(0.7)
		expect(child).toHaveBeenCalledTimes(3)
	})

	describe("when easing changes in the middle of the animation", () => {
		it("should update the child with the new time and unfortunately it jumps in the middle", async () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()
			const [easing, setEasing] = createSignal<EasingInput>("linear")

			render(() => (
				<JavascriptAnimate
					animationId="1"
					easing={easing()}
					duration={500}
					animationController={animationManager.factory}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(child).toHaveBeenLastCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)

			await animationManager.setAnimationProgress(0.3)

			expect(child).toHaveBeenLastCalledWith(0.3)

			// Change easing in the middle of the animation
			setEasing("ease-out")
			flush()

			// the animation now is at the exact same point as before the props change, and will start progressing from there
			expect(child).toHaveBeenLastCalledWith(0.3)
			/* Solid reports committed values only; React adds a rerender with an unchanged value. */
			expect(child).toHaveBeenCalledTimes(2)

			await animationManager.setAnimationProgress(0.7)

			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.81, 2))
			expect(child).toHaveBeenCalledTimes(4)

			await animationManager.setAnimationProgress(1)

			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(5)
		})
	})
})
