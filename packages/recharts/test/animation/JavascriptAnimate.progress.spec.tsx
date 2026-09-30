import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { MockProgressAnimationManager } from "./MockProgressAnimationManager"
import { JavascriptAnimate } from "../../src/animation/JavascriptAnimate"

describe("JavascriptAnimate progress", () => {
	it.skip("should call the function child with the current time", async () => {
		const animationManager = new MockProgressAnimationManager("1")
		const child = vi.fn()

		render(() => (
			<JavascriptAnimate
				animationId="1"
				easing="linear"
				duration={500}
				animationManager={animationManager}
			>
				{child}
			</JavascriptAnimate>
		))

		expect(child).toHaveBeenLastCalledWith(0)
		expect(child).toHaveBeenCalledTimes(1)

		await animationManager.setAnimationProgress(0.3)

		expect(child).toHaveBeenLastCalledWith(0.3)

		await animationManager.setAnimationProgress(0.7)

		expect(child).toHaveBeenLastCalledWith(0.7)
		expect(child).toHaveBeenCalledTimes(4)
	})
})
