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

export function selectAllRegisteredZIndexes(state: ChartState): ReadonlyArray<number> {
	const zIndexMap = state.zIndex.zIndexMap
	const allNumbers = Object.keys(zIndexMap)
		.map((zIndexStr) => parseInt(zIndexStr, 10))
		.concat(Object.values(DefaultZIndexes))
	const uniqueNumbers = Array.from(new Set(allNumbers))
	return uniqueNumbers.sort((a, b) => a - b)
}
