import { createSignal, createEffect, onCleanup } from "solid-js"
import type { Accessor } from "solid-js"
import type { MockAnimationManager } from "./MockProgressAnimationManager"
import { MockProgressAnimationManager } from "./MockProgressAnimationManager"
import type { AnimationManager } from "../../src/animation/AnimationManager"
import type { AnimationManagerFactory } from "../../src/animation/useAnimationManager"

/**
 * CompositeAnimationManager allows managing multiple animations.
 * Exposes the same interface as MockProgressAnimationManager but
 * manages multiple animations at once.
 */
export class CompositeAnimationManager implements MockAnimationManager {
	public animationManagers: Map<string, MockAnimationManager> = new Map()

	private subscribers: Set<() => void> = new Set()

	public subscribe = (callback: () => void): (() => void) => {
		this.subscribers.add(callback)
		return () => {
			this.subscribers.delete(callback)
		}
	}

	private notifySubscribers = () => {
		this.subscribers.forEach((callback) => callback())
	}

	async setAnimationProgress(percent: number): Promise<void> {
		const animatingManagers = this.getAnimatingManagers()
		if (animatingManagers.size === 0) {
			throw new Error("No active animation managers available")
		}

		for (const [, manager] of animatingManagers) {
			await manager.setAnimationProgress(percent)
		}
	}

	async completeAnimation(): Promise<void> {
		const animatingManagers = this.getAnimatingManagers()
		if (animatingManagers.size === 0) {
			throw new Error("No active animation managers available")
		}

		for (const [, manager] of animatingManagers) {
			await manager.completeAnimation()
		}
	}

	isAnimating(): boolean {
		return this.getAnimatingManagers().size > 0
	}

	public factory: AnimationManagerFactory = (animationId: string): AnimationManager => {
		const onStop = () => {
			this.animationManagers.delete(animationId)
			this.notifySubscribers()
		}
		const manager = new MockProgressAnimationManager(animationId, onStop)
		this.animationManagers.set(animationId, manager)
		this.notifySubscribers()
		return manager
	}

	public getAnimatingManagers(): Map<string, MockAnimationManager> {
		const animatingManagers = new Map<string, MockAnimationManager>()

		for (const [id, manager] of this.animationManagers) {
			if (manager.isAnimating()) {
				animatingManagers.set(id, manager)
			}
		}
		return animatingManagers
	}
}

/**
 * Solid reactive hook that returns all animation managers
 * from a CompositeAnimationManager.
 */
export function useAllAnimationManagers(
	compositeAnimationManager: CompositeAnimationManager,
): Accessor<Map<string, MockAnimationManager>> {
	const [managers, setManagers] = createSignal(compositeAnimationManager.animationManagers)

	createEffect(() => {
		const unsub = compositeAnimationManager.subscribe(() => {
			setManagers(new Map(compositeAnimationManager.animationManagers))
		})
		onCleanup(unsub)
	})

	return managers
}
