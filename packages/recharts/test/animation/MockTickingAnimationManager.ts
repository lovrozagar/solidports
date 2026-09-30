import { expect } from "vitest"
import type { AnimationManager, ReactSmoothQueue } from "../../src/animation/AnimationManager"
import { MockAbstractAnimationManager } from "./MockAbstractAnimationManager"
import { assertNotNull } from "../helper/assertNotNull"

/**
 * It's a faff trying to match function so let's have another type for the easy assertions
 */
export type SerializableQueue = ReadonlyArray<string | number | Record<string, unknown>>

/**
 * This mock animation manager is used for testing purposes.
 * Useful for detailed control over the animation queue,
 * insight into the current state of the animation,
 * and for stepping through the animation queue in a controlled manner.
 */
export class MockTickingAnimationManager
	extends MockAbstractAnimationManager
	implements AnimationManager
{
	/**
	 * Allows writing assertions against the current state of the queue.
	 * It doesn't use the queue directly, but rather a serializable view of it,
	 * where functions are represented by their names which makes it easier to write tests for it.
	 */
	public assertQueue(expectedQueue: SerializableQueue | null): void {
		if (expectedQueue === null) {
			expect(this.queue).toBeNull()
			return
		}
		assertNotNull(this.queue)
		const serializedQueue: SerializableQueue = this.queue.map((item) => {
			if (typeof item === "function") {
				const name =
					"getMockName" in item && typeof item.getMockName === "function"
						? item.getMockName()
						: item.name
				return `[function ${name || "anonymous"}]`
			}
			return item
		})
		expect(serializedQueue).toEqual(expectedQueue)
	}

	/**
	 * Processes a specified number of items in the queue.
	 */
	public poll(count: number = 1): Promise<void> {
		return super.poll(count)
	}

	/**
	 * Triggers the next timeout in the queue.
	 */
	public async triggerNextTimeout(now: number): Promise<void> {
		return super.triggerNextTimeout(now)
	}

	private isRunningPrivate: boolean = false

	start(queue: ReactSmoothQueue): void {
		super.start(queue)
		this.isRunningPrivate = true
	}

	stop(): void {
		super.stop()
		this.isRunningPrivate = false
	}

	isRunning(): boolean {
		return this.isRunningPrivate
	}
}
