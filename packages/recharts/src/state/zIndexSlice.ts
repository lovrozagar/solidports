import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

export type ZIndexEntry = {
	/**
	 * Reference to the DOM element that corresponds to this z-index.
	 * This element is used to create a portal for rendering components at this z-index.
	 *
	 * If undefined, it means no element is currently registered for this z-index,
	 * and registration is in progress. If that happens, wait for the next render cycle.
	 */
	element: Element | undefined
	/**
	 * Panorama items can't mix with normal items in the same z-index layer,
	 * because they are rendered in a different SVG element.
	 * So we need to have a separate element reference for panorama z-index portals.
	 */
	panoramaElement: Element | undefined
	consumers: number
}

export type ZIndexState = {
	zIndexMap: Record<number, ZIndexEntry>
}

export function createInitialZIndexState(): ZIndexState {
	const zIndexMap: ZIndexState["zIndexMap"] = {}
	for (const current of Object.values(DefaultZIndexes)) {
		zIndexMap[current] = { consumers: 0, element: undefined, panoramaElement: undefined }
	}
	return { zIndexMap }
}

export const initialZIndexState: ZIndexState = createInitialZIndexState()

const defaultZIndexSet = new Set<number>(Object.values(DefaultZIndexes))

export function isDefaultZIndex(zIndex: number): boolean {
	return defaultZIndexSet.has(zIndex)
}
