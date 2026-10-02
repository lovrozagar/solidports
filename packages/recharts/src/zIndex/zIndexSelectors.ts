import type { ChartState } from "../state/store"
import { DefaultZIndexes } from "./DefaultZIndexes"

/**
 * Given a zIndex, returns the corresponding portal element reference.
 * If no zIndex is provided or if the zIndex is not registered, returns undefined.
 *
 * It also returns undefined in case the z-index portal has not been rendered yet.
 */
export function selectZIndexPortalElement(
	state: ChartState,
	zIndex: number | undefined,
	isPanorama: boolean,
): Element | undefined {
	if (zIndex == null) {
		return undefined
	}
	const entry = state.zIndex.zIndexMap[zIndex]
	if (entry == null) {
		return undefined
	}
	if (isPanorama) {
		return entry.panoramaElement
	}
	return entry.element
}

/* Upstream memoizes with a result equality check: an equal list keeps its reference. */
const lastRegisteredZIndexes = new WeakMap<object, ReadonlyArray<number>>()

export function selectAllRegisteredZIndexes(state: ChartState): ReadonlyArray<number> {
	const zIndexMap = state.zIndex.zIndexMap
	const allNumbers = Object.keys(zIndexMap)
		.map((zIndexStr) => parseInt(zIndexStr, 10))
		.concat(Object.values(DefaultZIndexes))
	const uniqueNumbers = Array.from(new Set(allNumbers)).sort((a, b) => a - b)
	const key = state.zIndex as object
	const previous = lastRegisteredZIndexes.get(key)
	if (
		previous != null &&
		previous.length === uniqueNumbers.length &&
		previous.every((value, index) => value === uniqueNumbers[index])
	) {
		return previous
	}
	lastRegisteredZIndexes.set(key, uniqueNumbers)
	return uniqueNumbers
}
