import { createContext, createMemo, useContext, type Accessor } from "solid-js"
import type { AnimationManager } from "./AnimationManager"
import { createDefaultAnimationManager } from "./createDefaultAnimationManager"

export type AnimationManagerFactory = (animationId: string) => AnimationManager

export const AnimationManagerContext = createContext<AnimationManagerFactory>(
	createDefaultAnimationManager,
)

/* Returns an accessor — reading it inside a tracked scope subscribes to
   animationId changes. Each new id mints a fresh AnimationManager via the
   context factory, mirroring upstream React where a `key` change remounts
   JsAnimate and re-instantiates the manager. */
export function useAnimationManager(
	animationId: Accessor<string>,
	animationManagerFromProps: AnimationManager | undefined,
): Accessor<AnimationManager> {
	const contextAnimationManager = useContext(AnimationManagerContext)
	const manager = createMemo(() => animationManagerFromProps ?? contextAnimationManager(animationId()))
	return manager
}
