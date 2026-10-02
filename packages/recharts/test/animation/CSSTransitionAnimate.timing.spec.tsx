import { createSignal, flush, Show } from "solid-js"
import { render } from "../helper/render"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { CSSTransitionAnimate } from "../../src/animation/CSSTransitionAnimate"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"
import { CompositeAnimationManager } from "./CompositeAnimationManager"

function getNamedSpy(name: string): () => void {
	return vi.fn().mockName(name)
}

describe("CSSTransitionAnimate timing", () => {
	const handleAnimationStart = getNamedSpy("handleAnimationStart")
	const handleAnimationEnd = getNamedSpy("handleAnimationEnd")

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("with animation steps as strings", () => {
		describe("test using vi fake timers", () => {
			it("should call children function with animated style", () => {
				vi.useFakeTimers()
				expect.assertions(2)
				const childFunction = vi.fn()
				render(() => (
					<CSSTransitionAnimate animationId="1" from="1" to="0" attributeName="opacity" duration={500}>
						{childFunction}
					</CSSTransitionAnimate>
				))

				expectLastCalledWith(childFunction, {
					opacity: "1",
				})

				vi.advanceTimersByTime(700)
				flush()

				expectLastCalledWith(childFunction, {
					opacity: "0",
					transition: "opacity 500ms ease",
				})
			})

			it("should call onAnimationEnd at the end of the animation", () => {
				vi.useFakeTimers()
				expect.assertions(2)
				const spy = vi.fn()

				render(() => (
					<CSSTransitionAnimate
						animationId="1"
						from="1"
						to="0"
						attributeName="opacity"
						duration={500}
						onAnimationEnd={handleAnimationEnd}
					>
						{spy}
					</CSSTransitionAnimate>
				))

				expect(handleAnimationEnd).not.toHaveBeenCalled()

				vi.advanceTimersByTime(700)
				flush()

				expect(handleAnimationEnd).toHaveBeenCalledTimes(1)
			})
		})

		describe("test using MockTimeoutController", () => {
			it("should call children function with animated style", async () => {
				const animationManager = new CompositeAnimationManager()
				const childFunction = vi.fn()

				render(() => (
					<CSSTransitionAnimate
						animationId="1"
						from="scaleY(0)"
						to="scaleY(1)"
						attributeName="transform"
						duration={500}
						animationController={animationManager.factory}
						canBegin
					>
						{childFunction}
					</CSSTransitionAnimate>
				))

				expect(childFunction).toHaveBeenLastCalledWith({
					transform: "scaleY(0)",
				})
				expect(childFunction).toHaveBeenCalledTimes(1)

				await animationManager.completeAnimation()

				/* Solid skips React's intermediate render with the unchanged `from` value. */
				expect(childFunction).toHaveBeenCalledTimes(2)
				expect(childFunction).toHaveBeenLastCalledWith({
					transform: "scaleY(1)",
					transition: "transform 500ms ease",
				})
			})

			it("should call onAnimationStart and onAnimationEnd", async () => {
				const animationManager = new CompositeAnimationManager()
				const childFunction = vi.fn()

				render(() => (
					<CSSTransitionAnimate
						animationId="1"
						from="scaleY(0)"
						to="scaleY(1)"
						attributeName="transform"
						duration={500}
						onAnimationStart={handleAnimationStart}
						onAnimationEnd={handleAnimationEnd}
						animationController={animationManager.factory}
					>
						{childFunction}
					</CSSTransitionAnimate>
				))

				expect(handleAnimationStart).toHaveBeenCalledTimes(1)
				expect(handleAnimationEnd).not.toHaveBeenCalled()

				await animationManager.completeAnimation()

				expect(handleAnimationStart).toHaveBeenCalledTimes(1)
				expect(handleAnimationEnd).toHaveBeenCalledTimes(1)
			})

			it("should start animation on mount, and stop on unmount", () => {
				const animationManager = new CompositeAnimationManager()
				const childFunction = vi.fn()

				const [mounted, setMounted] = createSignal(true)
				render(() => (
					<Show when={mounted()}>
						<CSSTransitionAnimate
							animationId="1"
							from="1"
							to="0"
							attributeName="opacity"
							duration={500}
							onAnimationStart={handleAnimationStart}
							onAnimationEnd={handleAnimationEnd}
							animationController={animationManager.factory}
						>
							{childFunction}
						</CSSTransitionAnimate>
					</Show>
				))

				expect(animationManager.isAnimating()).toBe(true)

				setMounted(false)
				flush()

				expect(animationManager.isAnimating()).toBe(false)
			})

			it("should not start animation if canBegin is false, and render with starting state", () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()

				render(() => (
					<CSSTransitionAnimate
						animationId="1"
						from="1"
						to="0"
						attributeName="opacity"
						easing="ease-in-out"
						duration={500}
						canBegin={false}
						onAnimationStart={handleAnimationStart}
						animationController={animationManager.factory}
					>
						{child}
					</CSSTransitionAnimate>
				))

				expect(animationManager.isAnimating()).toBe(false)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(child).toHaveBeenCalledWith({ opacity: "1" })
				expect(child).toHaveBeenCalledTimes(1)
			})

			it("should go straight to final state when isActive is false, and do not pass any transition", () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()

				render(() => (
					<CSSTransitionAnimate
						animationId="1"
						from="1"
						to="0"
						attributeName="opacity"
						duration={500}
						isActive={false}
						onAnimationStart={handleAnimationStart}
						animationController={animationManager.factory}
					>
						{child}
					</CSSTransitionAnimate>
				))

				expect(animationManager.isAnimating()).toBe(false)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(child).toHaveBeenCalledWith({ opacity: "0" })
				expect(child).toHaveBeenCalledTimes(1)
			})

			it("should restart animation when isActive changes to true via rerender", async () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()

				const [props, setProps] = createSignal({ duration: 500, isActive: false })
				render(() => (
					<CSSTransitionAnimate
						{...props()}
						animationId="1"
						from="1"
						to="0"
						attributeName="opacity"
						onAnimationStart={handleAnimationStart}
						animationController={animationManager.factory}
					>
						{child}
					</CSSTransitionAnimate>
				))

				expect(animationManager.isAnimating()).toBe(false)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(child).toHaveBeenLastCalledWith({ opacity: "0" })
				expect(child).toHaveBeenCalledTimes(1)

				// Now we change isActive to true
				setProps({ duration: 300, isActive: true })
				flush()

				// queue should be populated with the animation steps
				expect(animationManager.isAnimating()).toBe(true)
				expect(handleAnimationStart).toHaveBeenCalledTimes(1)

				expect(child).toHaveBeenLastCalledWith({ opacity: "1", transition: "opacity 300ms ease" })
				expect(child).toHaveBeenCalledTimes(3)

				await animationManager.setAnimationProgress(0.1)

				// After the first animation tick, we should receive a `to` value with transition applied
				expect(child).toHaveBeenLastCalledWith({
					opacity: "0",
					transition: "opacity 300ms ease",
				})
			})

			it("should restart animation when isActive changes to true via button click", async () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()
				const MyTestComponent = () => {
					const [isActive, setIsActive] = createSignal(false)
					return (
						<>
							<CSSTransitionAnimate
								animationId="1"
								from="1"
								to="0"
								attributeName="opacity"
								duration={500}
								isActive={isActive()}
								onAnimationStart={handleAnimationStart}
								animationController={animationManager.factory}
							>
								{child}
							</CSSTransitionAnimate>
							<button type="button" onClick={() => setIsActive(true)}>
								Start Animation
							</button>
						</>
					)
				}

				const { getByText } = render(() => <MyTestComponent />)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(child).toHaveBeenLastCalledWith({ opacity: "0" })
				expect(child).toHaveBeenCalledTimes(1)
				expect(animationManager.isAnimating()).toBe(false)

				const button = getByText("Start Animation")
				button.click()
				flush()

				expect(animationManager.isAnimating()).toBe(true)
				expect(child).toHaveBeenCalledTimes(3)
				expect(child).toHaveBeenNthCalledWith(2, { opacity: "1" })
				expect(child).toHaveBeenNthCalledWith(3, { opacity: "1", transition: "opacity 500ms ease" })
				expect(handleAnimationStart).toHaveBeenCalledTimes(1)

				await animationManager.setAnimationProgress(0.1)

				/* React renders this frame twice with identical style; Solid once. */
				expect(child).toHaveBeenNthCalledWith(4, { opacity: "0", transition: "opacity 500ms ease" })
				expect(child).toHaveBeenCalledTimes(4)
			})

			it("should rerender with the final state when isActive is false", () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()

				const [props, setProps] = createSignal({ from: "1", to: "0" })
				render(() => (
					<CSSTransitionAnimate
						{...props()}
						animationId="1"
						attributeName="opacity"
						duration={500}
						isActive={false}
						onAnimationStart={handleAnimationStart}
						onAnimationEnd={handleAnimationEnd}
						animationController={animationManager.factory}
					>
						{child}
					</CSSTransitionAnimate>
				))

				expect(animationManager.isAnimating()).toBe(false)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(handleAnimationEnd).not.toHaveBeenCalled()
				expect(child).toHaveBeenLastCalledWith({ opacity: "0" })
				expect(child).toHaveBeenCalledTimes(1)

				setProps({ from: "0.7", to: "0.3" })
				flush()

				expect(child).toHaveBeenLastCalledWith({ opacity: "0.3" })
				expect(child).toHaveBeenCalledTimes(2)
				expect(animationManager.isAnimating()).toBe(false)
				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(handleAnimationEnd).not.toHaveBeenCalled()
			})

			it("should not start animation on rerender if canBegin is false", () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()

				const [props, setProps] = createSignal({ from: "1", to: "0" })
				render(() => (
					<CSSTransitionAnimate
						{...props()}
						animationId="1"
						attributeName="opacity"
						duration={500}
						canBegin={false}
						onAnimationStart={handleAnimationStart}
						animationController={animationManager.factory}
					>
						{child}
					</CSSTransitionAnimate>
				))

				expect(animationManager.isAnimating()).toBe(false)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(child).toHaveBeenLastCalledWith({ opacity: "1" })
				expect(child).toHaveBeenCalledTimes(1)

				setProps({ from: "0.7", to: "0.3" })
				flush()

				// rerendering should not start the animation, this appears correct
				expect(animationManager.isAnimating()).toBe(false)

				// the child should now be rerendered with the fresh "from" state
				expect(child).toHaveBeenLastCalledWith({ opacity: "0.7" })
				expect(child).toHaveBeenCalledTimes(2)
			})

			it("should start animation on rerender if canBegin changes from false to true", async () => {
				const animationManager = new CompositeAnimationManager()
				const child = vi.fn()

				const [props, setProps] = createSignal({ from: "1", to: "0", canBegin: false })
				render(() => (
					<CSSTransitionAnimate
						{...props()}
						animationId="1"
						attributeName="opacity"
						duration={500}
						onAnimationStart={handleAnimationStart}
						animationController={animationManager.factory}
					>
						{child}
					</CSSTransitionAnimate>
				))

				expect(animationManager.isAnimating()).toBe(false)

				expect(handleAnimationStart).not.toHaveBeenCalled()
				expect(child).toHaveBeenLastCalledWith({ opacity: "1" })
				expect(child).toHaveBeenCalledTimes(1)

				setProps({ from: "0.7", to: "0.3", canBegin: true })
				flush()

				expect(handleAnimationStart).toHaveBeenCalledTimes(1)
				/*
				 * now the child should be rerendered with the fresh "from" state, using the latest "from" value
				 *  - NOT the `from` from before when canBegin was false
				 * This is necessary for the stroke-dasharray animation in Trapezoid and Rectangle to work correctly.
				 * It is equally important that the transition is not applied here, as the animation is not yet running.
				 * If there was a transition then the browser starts animating from the previous irrelevant `from` value.
				 * This is tricky but necessary because the input into the `from` is calculated from a DOM ref,
				 *  and it takes a tick for the ref to arrive.
				 */
				expect(child).toHaveBeenLastCalledWith({ opacity: "0.7", transition: "opacity 500ms ease" })
				expect(child).toHaveBeenCalledTimes(3)

				await animationManager.setAnimationProgress(0.1)

				/*
				 * Now after the first animation tick, we should receive a `to` value
				 * with transition applied.
				 */
				expect(child).toHaveBeenLastCalledWith({
					opacity: "0.3",
					transition: "opacity 500ms ease",
				})
				/* React renders the first `to` frame twice with identical style; Solid once. */
				expect(child).toHaveBeenCalledTimes(4)
			})
		})
	})
})
