import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import type { SetStoreFunction } from "solid-js/store"
import type { RechartsRootState } from "./store"

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

const seed: ZIndexState["zIndexMap"] = {}

export const initialZIndexState: ZIndexState = {
	zIndexMap: Object.values(DefaultZIndexes).reduce(
		(acc: ZIndexState["zIndexMap"], current: number): ZIndexState["zIndexMap"] => {
			acc[current] = { consumers: 0, element: undefined, panoramaElement: undefined }
			return acc
		},
		seed,
	),
}

const defaultZIndexSet = new Set<number>(Object.values(DefaultZIndexes))

export function isDefaultZIndex(zIndex: number): boolean {
	return defaultZIndexSet.has(zIndex)
}

/* Solid's setStore("zIndex","zIndexMap",N,key,...) crashes when zIndexMap[N]
   is undefined (custom zIndex outside DefaultZIndexes). Pre-seed before nested write. */
const ensureZIndexEntry = (
	setStore: SetStoreFunction<RechartsRootState>,
	zIndex: number,
	currentMap: Record<number, ZIndexEntry>,
): void => {
	if (currentMap[zIndex] != null) return
	setStore("zIndex", "zIndexMap", zIndex, {
		consumers: 0,
		element: undefined,
		panoramaElement: undefined,
	})
}

export const registerZIndexPortalElement =
	(payload: { element: Element; isPanorama: boolean; zIndex: number }) =>
	(setStore: SetStoreFunction<RechartsRootState>, store: RechartsRootState) => {
		ensureZIndexEntry(setStore, payload.zIndex, store.zIndex.zIndexMap)
		const key = payload.isPanorama ? "panoramaElement" : "element"
		setStore("zIndex", "zIndexMap", payload.zIndex, key, payload.element)
	}

export const unregisterZIndexPortalElement =
	(payload: { isPanorama: boolean; zIndex: number }) =>
	(setStore: SetStoreFunction<RechartsRootState>, store: RechartsRootState) => {
		ensureZIndexEntry(setStore, payload.zIndex, store.zIndex.zIndexMap)
		const key = payload.isPanorama ? "panoramaElement" : "element"
		setStore("zIndex", "zIndexMap", payload.zIndex, key, undefined)
	}

export const addZIndexLayer =
	(payload: { zIndex: number }) =>
	(setStore: SetStoreFunction<RechartsRootState>, store: RechartsRootState) => {
		ensureZIndexEntry(setStore, payload.zIndex, store.zIndex.zIndexMap)
		setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", (c: number) => c + 1)
	}

export const removeZIndexLayer =
	(payload: { zIndex: number }) =>
	(setStore: SetStoreFunction<RechartsRootState>) => {
		setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", (c: number) => Math.max(0, c - 1))
	}

export const registerZIndexPortal =
	(payload: { zIndex: number }) =>
	(setStore: SetStoreFunction<RechartsRootState>, store: RechartsRootState) => {
		const existing = store.zIndex.zIndexMap[payload.zIndex]
		if (existing) {
			setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", existing.consumers + 1)
		} else {
			setStore("zIndex", "zIndexMap", payload.zIndex, {
				consumers: 1,
				element: undefined,
				panoramaElement: undefined,
			})
		}
	}

export const unregisterZIndexPortal =
	(payload: { zIndex: number }) =>
	(setStore: SetStoreFunction<RechartsRootState>, store: RechartsRootState) => {
		const existing = store.zIndex.zIndexMap[payload.zIndex]
		if (existing) {
			const newConsumers = existing.consumers - 1
			if (newConsumers <= 0 && !isDefaultZIndex(payload.zIndex)) {
				setStore("zIndex", "zIndexMap", (prev) => {
					const next = { ...prev }
					delete next[payload.zIndex]
					return next
				})
			} else {
				setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", newConsumers)
			}
		}
	}
