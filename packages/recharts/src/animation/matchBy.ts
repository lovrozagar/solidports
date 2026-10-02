import { getValueByDataKey } from "../util/ChartUtils"
import type { DataKey } from "../util/types"
import type {
	AnimationItem,
	AnimationMatchBy,
	AnimationMatchByProp,
} from "../state/types/AnimationSettings"

export type { AnimationItem, AnimationMatchBy, AnimationMatchByProp }

/**
 * Match animation items by their array index (the default behavior).
 *
 * Previous items are paired with next items based on their position
 * in the array, with proportional stretching when array lengths differ.
 *
 * @since 3.9
 */
export const matchByIndex = "index" as const

/**
 * Match animation items sequentially: previous item 0 pairs with next item 0,
 * previous item 1 pairs with next item 1, and so on. Extra next items animate in;
 * extra previous items are dropped.
 *
 * @since 3.9
 */
export const matchAppend = "append" as const

/**
 * Create a matching function that pairs items by a data key from their payload.
 *
 * @since 3.9
 */
export function matchByDataKey(
	dataKey: DataKey<Record<string, unknown>>,
): AnimationMatchBy<{ payload?: unknown }> {
	return (item: { payload?: unknown }): string | number | null => {
		if (item.payload == null || typeof item.payload !== "object") {
			return null
		}
		const value = getValueByDataKey(item.payload as Record<string, unknown>, dataKey)
		if (value == null) {
			return null
		}
		if (typeof value === "string" || typeof value === "number") {
			return value
		}
		return JSON.stringify(value)
	}
}

function tagAlignedItems<T>(
	alignedPrevItems: ReadonlyArray<T | undefined>,
	nextItems: ReadonlyArray<T>,
	removedPrevItems: ReadonlyArray<T> = [],
): ReadonlyArray<AnimationItem<T>> {
	const tagged: Array<AnimationItem<T>> = []
	for (const prev of removedPrevItems) {
		tagged.push({ status: "removed", prev })
	}
	for (let i = 0; i < nextItems.length; i++) {
		const prev = alignedPrevItems[i]
		/* i is within bounds; noUncheckedIndexedAccess cannot see that */
		const next = nextItems[i] as T
		if (prev != null) {
			tagged.push({ status: "matched", prev, next })
		} else {
			tagged.push({ status: "added", next })
		}
	}
	return tagged
}

function matchByIndexImpl<T>(
	prevItems: ReadonlyArray<T>,
	nextItems: ReadonlyArray<T>,
): ReadonlyArray<AnimationItem<T>> {
	const factor = prevItems.length / nextItems.length
	const alignedPrevItems = nextItems.map((_, i) => prevItems[Math.floor(i * factor)])
	return tagAlignedItems(alignedPrevItems, nextItems)
}

function matchAppendImpl<T>(
	prevItems: ReadonlyArray<T>,
	nextItems: ReadonlyArray<T>,
): ReadonlyArray<AnimationItem<T>> {
	const alignedPrevItems = nextItems.map((_, i) => prevItems[i])
	return tagAlignedItems(alignedPrevItems, nextItems)
}

function buildPrevKeyMap<T>(
	prevItems: ReadonlyArray<T>,
	matchBy: AnimationMatchBy<T>,
): ReadonlyMap<string | number, T> {
	const prevMap = new Map<string | number, T>()
	for (let i = 0; i < prevItems.length; i++) {
		const item = prevItems[i]
		if (item == null) {
			continue
		}
		const key = matchBy(item, i)
		if (key != null && !prevMap.has(key)) {
			prevMap.set(key, item)
		}
	}
	return prevMap
}

function matchByKey<T>(
	prevItems: ReadonlyArray<T>,
	nextItems: ReadonlyArray<T>,
	matchBy: AnimationMatchBy<T>,
): ReadonlyArray<AnimationItem<T>> {
	const prevMap = buildPrevKeyMap(prevItems, matchBy)
	const matchedKeys = new Set<string | number>()

	const alignedPrevItems = nextItems.map((next, i) => {
		const key = matchBy(next, i)
		if (key != null) {
			const prev = prevMap.get(key)
			if (prev !== undefined) {
				matchedKeys.add(key)
				return prev
			}
		}
		return undefined
	})

	const removedPrevItems: Array<T> = []
	for (const [key, item] of prevMap) {
		if (!matchedKeys.has(key)) {
			removedPrevItems.push(item)
		}
	}

	return tagAlignedItems(alignedPrevItems, nextItems, removedPrevItems)
}

/**
 * Match previous items to next items using the given matching strategy.
 *
 * On first render, all next items are returned as `{ status: 'added' }`.
 * For key-based matching, unmatched previous items are `{ status: 'removed' }`.
 */
export function matchAnimationItems<T>(
	prevItems: ReadonlyArray<T> | null,
	nextItems: ReadonlyArray<T> | undefined,
	matchBy: AnimationMatchByProp<T>,
): ReadonlyArray<AnimationItem<T>> | null {
	if (nextItems == null) {
		return null
	}
	if (prevItems == null) {
		return nextItems.map((next) => ({ status: "added" as const, next }))
	}
	if (matchBy === matchByIndex) {
		return matchByIndexImpl(prevItems, nextItems)
	}
	if (matchBy === matchAppend) {
		return matchAppendImpl(prevItems, nextItems)
	}
	return matchByKey(prevItems, nextItems, matchBy)
}
