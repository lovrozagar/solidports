import { createSignal, flush } from "solid-js"
import type { JSX } from "@solidjs/web"
import { render } from "../helper/render"
import { observe } from "../helper/observe"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { JavascriptAnimate } from "../../src/animation/JavascriptAnimate"
import { CompositeAnimationManager } from "./CompositeAnimationManager"

function getNamedSpy(name: string): () => void {
	return vi.fn().mockName(name)
}

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

describe("JavascriptAnimate timing", () => {
	const handleAnimationStart = getNamedSpy("handleAnimationStart")
	const handleAnimationEnd = getNamedSpy("handleAnimationEnd")

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("with animation steps as objects with a simple numeric values", () => {
		it("should call onAnimationStart and onAnimationEnd", async () => {
			const animationManager = new CompositeAnimationManager()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationController={animationManager.factory}
				>
					{() => <div class="test-wrapper" />}
				</JavascriptAnimate>
			))

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).not.toHaveBeenCalled()

			await animationManager.setAnimationProgress(0.5)

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).not.toHaveBeenCalled()

			await animationManager.completeAnimation()

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).toHaveBeenCalledTimes(1)
		})

		it("should not start animation if canBegin is false", async () => {
			const animationManager = new CompositeAnimationManager()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					canBegin={false}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationController={animationManager.factory}
				>
					{() => <div class="test-wrapper" />}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationEnd).not.toHaveBeenCalled()
		})

		it("should not start animation if isActive is false", async () => {
			const animationManager = new CompositeAnimationManager()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={false}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationController={animationManager.factory}
				>
					{() => <div class="test-wrapper" />}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationEnd).not.toHaveBeenCalled()
		})

		it("should call children function with current time", async () => {
			const animationManager = new CompositeAnimationManager()
			const childFunction = vi.fn()

			render(() => (
				<JavascriptAnimate animationId="1" duration={500} animationController={animationManager.factory}>
					{trackT(childFunction)}
				</JavascriptAnimate>
			))

			expect(childFunction).toHaveBeenLastCalledWith(0)
			expect(childFunction).toHaveBeenCalledTimes(1)

			await animationManager.completeAnimation()

			expect(childFunction).toHaveBeenCalledTimes(2)
			expect(childFunction).toHaveBeenLastCalledWith(1)
		})
	})

	describe("queue when the child is a function", () => {
		it("should not start animation if canBegin is false, and render with time zero", () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					canBegin={false}
					onAnimationStart={handleAnimationStart}
					animationController={animationManager.factory}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)
		})

		it("should go straight to final state when isActive is false", () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={false}
					onAnimationStart={handleAnimationStart}
					animationController={animationManager.factory}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)
		})

		it("should restart animation when isActive changes to true", async () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()

			const [isActive, setIsActive] = createSignal(false)
			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={isActive()}
					onAnimationStart={handleAnimationStart}
					animationController={animationManager.factory}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)

			// Now we change isActive to true
			setIsActive(true)
			flush()

			expect(animationManager.isAnimating()).toBe(true)
			expect(child).toHaveBeenLastCalledWith(1)

			await animationManager.setAnimationProgress(0.1)

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			/*
			 * Now we're seeing new animation with new time ticking.
			 * It is the responsibility of the child component to figure out reference to the latest animated state
			 * and continue from there.
			 * Solid reports distinct committed values only (1 -> 0 -> 0.1), so counts run one below React's renders.
			 */
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.1, 1))
			expect(child).toHaveBeenCalledTimes(3)

			await animationManager.setAnimationProgress(0.2)
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.29, 1))
			expect(child).toHaveBeenCalledTimes(4)

			await animationManager.setAnimationProgress(0.5)
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.8, 1))
			expect(child).toHaveBeenCalledTimes(5)

			await animationManager.setAnimationProgress(0.9)
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.99, 1))
			expect(child).toHaveBeenCalledTimes(6)

			await animationManager.setAnimationProgress(1)
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(7)
		})

		it("should restart animation when isActive changes to true via button click", async () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()
			const MyTestComponent = () => {
				const [isActive, setIsActive] = createSignal(false)
				return (
					<>
						<JavascriptAnimate
							animationId="1"
							duration={500}
							isActive={isActive()}
							onAnimationStart={handleAnimationStart}
							animationController={animationManager.factory}
						>
							{trackT(child)}
						</JavascriptAnimate>
						<button type="button" onClick={() => setIsActive(true)}>
							Start Animation
						</button>
					</>
				)
			}

			const { getByText } = render(() => <MyTestComponent />)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)
			expect(animationManager.isAnimating()).toBe(false)

			const button = getByText("Start Animation")
			button.click()
			flush()

			expect(animationManager.isAnimating()).toBe(true)

			await animationManager.setAnimationProgress(1)

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(child).toHaveBeenLastCalledWith(1)
			/* Solid: 1 -> 0 -> 1 committed values; React adds rerenders with unchanged values. */
			expect(child).toHaveBeenCalledTimes(3)
		})

		it("should rerender with the final state when isActive is false", () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()

			const [isActive, setIsActive] = createSignal(false)
			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={isActive()}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationController={animationManager.factory}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationEnd).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)

			setIsActive(false)
			flush()

			expect(child).toHaveBeenLastCalledWith(1)
			/* Same props: Solid does not re-run the child. */
			expect(child).toHaveBeenCalledTimes(1)
			expect(animationManager.isAnimating()).toBe(false)
			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationEnd).not.toHaveBeenCalled()
		})

		it("should not start animation on rerender if canBegin is false", () => {
			const animationManager = new CompositeAnimationManager()
			const child = vi.fn()

			const [canBegin, setCanBegin] = createSignal(false)
			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					canBegin={canBegin()}
					onAnimationStart={handleAnimationStart}
					animationController={animationManager.factory}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(animationManager.isAnimating()).toBe(false)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)

			setCanBegin(false)
			flush()

			// rerendering should not start the animation, this appears correct
			expect(animationManager.isAnimating()).toBe(false)

			// the child keeps the starting state; Solid does not re-run it for unchanged props
			expect(child).toHaveBeenLastCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)
		})
	})
})
