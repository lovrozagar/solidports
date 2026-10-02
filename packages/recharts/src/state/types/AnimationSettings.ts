/**
 * Tagged union for an item during animation.
 * Match helpers live in `src/animation/matchBy.ts`.
 */
export type AnimationItem<T> =
	| { readonly status: "matched"; readonly prev: T; readonly next: T }
	| { readonly status: "added"; readonly next: T }
	| { readonly status: "removed"; readonly prev: T }

export type AnimationMatchBy<T> = (item: T, index: number) => string | number | null

export type AnimationMatchBySentinel = "index" | "append"

export type AnimationMatchByProp<T> = AnimationMatchBySentinel | AnimationMatchBy<T>

export type AnimationInterpolateFn<ItemType, Layout = unknown> = (
	items: ReadonlyArray<AnimationItem<ItemType>> | null,
	animationElapsedTime: number,
	layout: Layout,
) => ReadonlyArray<ItemType>
