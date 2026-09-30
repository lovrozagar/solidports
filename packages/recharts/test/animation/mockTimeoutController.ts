import type {
	CallbackType,
	CancelableTimeout,
	TimeoutController,
} from "../../src/animation/timeoutController"

/**
 * Mock implementation of TimeoutController for testing purposes.
 * Does not use requestAnimationFrame — allows manual control of timeouts.
 */
export class MockTimeoutController implements TimeoutController {
	private timeouts: Array<{
		callback: CallbackType
		delay: number | undefined
	}> = []

	private cancelledFramesCount = 0

	setTimeout(callback: CallbackType, delay?: number): CancelableTimeout {
		this.timeouts.push({ callback, delay })

		return () => {
			this.removeTimeout(callback)
			this.cancelledFramesCount++
		}
	}

	/**
	 * Manually triggers the next timeout callback by registration order.
	 */
	async triggerNextTimeout(now: number): Promise<void> {
		const next = this.timeouts.shift()

		if (next == null) {
			return
		}

		const { callback } = next
		await Promise.resolve()
		this.removeTimeout(callback)
		callback(now)
	}

	/**
	 * Flushes all registered timeouts by triggering them in order.
	 */
	async flushAllTimeouts(tickSize: number = 1000): Promise<void> {
		let time = 0
		while (this.timeouts.length > 0) {
			await this.triggerNextTimeout(tickSize * time++)
		}
	}

	clear() {
		this.timeouts = []
		this.cancelledFramesCount = 0
	}

	private removeTimeout(callback: CallbackType) {
		this.timeouts = this.timeouts.filter((t) => t.callback !== callback)
	}

	getCallbacksCount() {
		return this.timeouts.length
	}

	getCancelledFramesCount() {
		return this.cancelledFramesCount
	}

	getTimeouts() {
		return this.timeouts.map((t) => t.delay)
	}
}
