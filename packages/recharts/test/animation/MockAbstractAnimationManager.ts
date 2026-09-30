import type {
	AnimationManager,
	HandleChangeFn,
	ReactSmoothQueue,
	ReactSmoothStyle,
} from "../../src/animation/AnimationManager"
import type { TimeoutController } from "../../src/animation/timeoutController"
import { MockTimeoutController } from "./mockTimeoutController"

/**
 * Abstract class for mock animation managers.
 * Solid port — no act() wrapper needed.
 */
export abstract class MockAbstractAnimationManager implements AnimationManager {
	protected queue: ReactSmoothQueue | null = null

	protected readonly timeoutController: MockTimeoutController = new MockTimeoutController()

	private listener: HandleChangeFn | null = null

	protected async poll(count: number = 1) {
		for (let i = 0; i < count; i++) {
			await this.pollPrivate()
		}
	}

	protected async triggerNextTimeout(now: number): Promise<void> {
		if (this.timeoutController.getCallbacksCount() === 0) {
			return
		}
		await this.timeoutController.triggerNextTimeout(now)
	}

	public isAnimating(): boolean {
		return this.queue !== null && this.queue.length > 0
	}

	start(queue: ReactSmoothQueue): void {
		this.queue = queue
		this.timeoutController.clear()
	}

	stop(): void {
		this.queue = null
	}

	subscribe(handleChange: (style: ReactSmoothStyle) => void): () => void {
		this.listener = handleChange
		return () => {
			this.listener = null
		}
	}

	getTimeoutController(): TimeoutController {
		return this.timeoutController
	}

	private async pollPrivate(): Promise<void> {
		if (this.queue === null || this.queue.length === 0) {
			throw new Error("Queue is empty")
		}
		const head = this.queue[0]

		this.queue = this.queue.slice(1)
		if (typeof head === "function") {
			head()
		} else if (typeof head === "object" || typeof head === "string") {
			this.listener?.(head)
		} else if (typeof head === "number") {
			await Promise.resolve()
		}
	}
}
