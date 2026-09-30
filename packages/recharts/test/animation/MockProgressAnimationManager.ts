import { MockAbstractAnimationManager } from "./MockAbstractAnimationManager"
import type { AnimationManager, ReactSmoothQueue } from "../../src/animation/AnimationManager"

export interface MockAnimationManager {
	/**
	 * Sets the eased animation progress to a specific percentage.
	 */
	setAnimationProgress(percent: number): Promise<void>

	/**
	 * Completes the animation immediately.
	 */
	completeAnimation(): Promise<void>

	isAnimating(): boolean
}

/**
 * A higher level mock animation manager that allows for less granular
 * control but requires less setup to reach a certain animation point.
 */
export class MockProgressAnimationManager
	extends MockAbstractAnimationManager
	implements AnimationManager, MockAnimationManager
{
	private readonly onStop?: () => void

	constructor(
		private animationId: string,
		onStop?: () => void,
	) {
		super()
		this.onStop = onStop
	}

	async setAnimationProgress(percent: number): Promise<void> {
		if (this.queue === null || this.queue.length === 0) {
			throw new Error(`[${this.animationId}] Queue is empty`)
		}
		if (percent < 0) {
			throw new Error("Percent must be greater than or equal to 0")
		}

		if (this.animationProgress >= 1) {
			throw new Error(
				"Animation is already complete. " +
					"Call completeAnimation to finish the queue. " +
					"MockProgressAnimationManager does not support rewinding.",
			)
		}

		this.animationProgress = percent

		const animationDuration = await this.peekAnimationDuration()

		const timeToAdvance = animationDuration * percent + this.firstTick

		await this.timeoutController.triggerNextTimeout(timeToAdvance)
	}

	async completeAnimation(): Promise<void> {
		if (this.queue === null || this.queue.length === 0) {
			throw new Error("Queue is empty")
		}

		if (this.animationProgress < 1) {
			await this.setAnimationProgress(1)
		}

		const result = this.poll(this.queue.length)
		this.onStop?.()
		return result
	}

	start(queue: ReactSmoothQueue) {
		super.start(queue)
		this.isPrimed = false
		this.animationProgress = 0
	}

	stop() {
		super.stop()
		this.isPrimed = false
		this.animationProgress = 0
		this.onStop?.()
	}

	private isPrimed: boolean = false
	private firstTick: number = 16
	private animationProgress: number = 0

	private async prime(): Promise<void> {
		if (this.isPrimed) {
			return
		}
		this.isPrimed = true

		await this.poll(2)
		await this.poll(1)
		await this.triggerNextTimeout(this.firstTick)
	}

	private async peekAnimationDuration(): Promise<number> {
		if (this.queue === null || this.queue.length === 0) {
			throw new Error(`[${this.animationId}] Queue is empty`)
		}

		await this.prime()

		const animationDuration = this.queue[0]

		if (typeof animationDuration !== "number") {
			throw new Error(
				`[${this.animationId}] We assume the first item ` +
					"in the queue is the animation duration. " +
					`Found: [${typeof animationDuration}] instead.`,
			)
		}

		return animationDuration
	}
}
