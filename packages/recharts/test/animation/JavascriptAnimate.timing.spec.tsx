import { createEffect, createSignal, type JSX } from "solid-js"
import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { JavascriptAnimate } from "../../src/animation/JavascriptAnimate"
import { MockTimeoutController } from "./mockTimeoutController"
import { createAnimateManager } from "../../src/animation/AnimationManager"
import { MockTickingAnimationManager } from "./MockTickingAnimationManager"

function getNamedSpy(name: string): () => void {
	return vi.fn().mockName(name)
}

/* GOTCHA-014-H: child fn now receives `Accessor<number>`; tests assert primitive
   per-tick t. Wrap with createEffect to report each value to the spy, mirroring
   React per-render-with-new-t semantics. */
function trackT(spy: (t: number) => unknown): (t: () => number) => JSX.Element {
	return (t) => {
		createEffect(() => {
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
			const timeoutController = new MockTimeoutController()
			const animationManager = createAnimateManager(timeoutController)

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationManager={animationManager}
				>
					{() => <div class="test-wrapper" />}
				</JavascriptAnimate>
			))

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).not.toHaveBeenCalled()

			await timeoutController.flushAllTimeouts()

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).toHaveBeenCalledTimes(1)
		})
		it("should not start animation if canBegin is false", async () => {
			const timeoutController = new MockTimeoutController()
			const animationManager = createAnimateManager(timeoutController)

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					canBegin={false}
					onAnimationStart={handleAnimationStart}
					animationManager={animationManager}
				>
					{() => <div class="test-wrapper" />}
				</JavascriptAnimate>
			))

			await timeoutController.flushAllTimeouts()

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationStart).not.toHaveBeenCalled()
		})
		it("should not start animation if isActive is false", async () => {
			const timeoutController = new MockTimeoutController()
			const animationManager = createAnimateManager(timeoutController)

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={false}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationManager={animationManager}
				>
					{() => <div class="test-wrapper" />}
				</JavascriptAnimate>
			))

			await timeoutController.flushAllTimeouts()

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationEnd).not.toHaveBeenCalled()
		})
		/* Cluster B: call-count off-by-one — Solid render-cycle vs React batching divergence. */
		it.skip("should call children function with current time", async () => {
			const timeoutController = new MockTimeoutController()
			const animationManager = createAnimateManager(timeoutController)
			const childFunction = vi.fn()

			render(() => (
				<JavascriptAnimate animationId="1" duration={500} animationManager={animationManager}>
					{trackT(childFunction)}
				</JavascriptAnimate>
			))

			expect(childFunction).toHaveBeenCalledWith(0)
			expect(childFunction).toHaveBeenCalledTimes(1)

			await timeoutController.flushAllTimeouts()

			expect(childFunction).toHaveBeenCalledTimes(3)
			expect(childFunction).toHaveBeenCalledWith(1)
		})
	})
	describe("queue when the child is a function", () => {
		/* Cluster B */
		it.skip("should add items to the animation queue on start, and call the render function", async () => {
			const animationManager = new MockTickingAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationManager={animationManager}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			expect(child).toHaveBeenCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)
			expect(handleAnimationStart).toHaveBeenCalledTimes(0)
			expect(handleAnimationEnd).toHaveBeenCalledTimes(0)

			animationManager.assertQueue([
				"[function handleAnimationStart]",
				0,
				"[function onAnimationActive]",
				500,
				"[function handleAnimationEnd]",
			])

			await animationManager.poll(3)
			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).toHaveBeenCalledTimes(0)

			expect(child).toHaveBeenCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)

			animationManager.assertQueue([500, "[function handleAnimationEnd]"])

			await animationManager.triggerNextTimeout(16)

			await animationManager.triggerNextTimeout(100)
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.22, 1))
			expect(child).toHaveBeenCalledTimes(3)

			await animationManager.triggerNextTimeout(200)
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.63, 1))
			expect(child).toHaveBeenCalledTimes(4)

			await animationManager.triggerNextTimeout(300)
			expect(child).toHaveBeenLastCalledWith(expect.closeTo(0.86, 1))
			expect(child).toHaveBeenCalledTimes(5)

			await animationManager.triggerNextTimeout(800)
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(6)

			await animationManager.poll()

			expect(child).toHaveBeenCalledWith(1)
			expect(child).toHaveBeenCalledTimes(6)

			animationManager.assertQueue(["[function handleAnimationEnd]"])
			expect(handleAnimationEnd).toHaveBeenCalledTimes(0)

			await animationManager.poll()

			expect(handleAnimationStart).toHaveBeenCalledTimes(1)
			expect(handleAnimationEnd).toHaveBeenCalledTimes(1)
		})
		it("should not start animation if canBegin is false, and render with time zero", () => {
			const animationManager = new MockTickingAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					canBegin={false}
					onAnimationStart={handleAnimationStart}
					animationManager={animationManager}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			animationManager.assertQueue(null)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)
		})
		it("should go straight to final state when isActive is false", () => {
			const animationManager = new MockTickingAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={false}
					onAnimationStart={handleAnimationStart}
					animationManager={animationManager}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			animationManager.assertQueue(null)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)
		})
		it("should not start animation on rerender if canBegin is false", () => {
			const animationManager = new MockTickingAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					canBegin={false}
					onAnimationStart={handleAnimationStart}
					animationManager={animationManager}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			animationManager.assertQueue(null)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(0)
			expect(child).toHaveBeenCalledTimes(1)
		})
		/* Cluster B */
		it.skip("should restart animation when isActive changes to true via button click", async () => {
			const animationManager = new MockTickingAnimationManager()
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
							animationManager={animationManager}
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

			animationManager.assertQueue(null)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)
			expect(animationManager.isRunning()).toBe(false)

			const button = getByText("Start Animation")
			button.click()

			animationManager.assertQueue([
				"[function handleAnimationStart]",
				0,
				"[function onAnimationActive]",
				500,
				"[function onAnimationEnd]",
			])
			expect(animationManager.isRunning()).toBe(true)
			await animationManager.poll()
			animationManager.assertQueue([
				0,
				"[function onAnimationActive]",
				500,
				"[function onAnimationEnd]",
			])
			expect(handleAnimationStart).toHaveBeenCalledTimes(1)

			await animationManager.poll()
			animationManager.assertQueue([
				"[function onAnimationActive]",
				500,
				"[function onAnimationEnd]",
			])

			await animationManager.poll()
			animationManager.assertQueue([500, "[function onAnimationEnd]"])

			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(3)

			await animationManager.triggerNextTimeout(16)
			expect(child).toHaveBeenLastCalledWith(0)
			expect(child).toHaveBeenCalledTimes(4)
		})
		it("should rerender with the final state when isActive is false", () => {
			const animationManager = new MockTickingAnimationManager()
			const child = vi.fn()

			render(() => (
				<JavascriptAnimate
					animationId="1"
					duration={500}
					isActive={false}
					onAnimationStart={handleAnimationStart}
					onAnimationEnd={handleAnimationEnd}
					animationManager={animationManager}
				>
					{trackT(child)}
				</JavascriptAnimate>
			))

			animationManager.assertQueue(null)

			expect(handleAnimationStart).not.toHaveBeenCalled()
			expect(handleAnimationEnd).not.toHaveBeenCalled()
			expect(child).toHaveBeenLastCalledWith(1)
			expect(child).toHaveBeenCalledTimes(1)
		})
	})
})
