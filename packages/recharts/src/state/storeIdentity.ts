import { snapshot } from "solid-js"

/**
 * Inside a store draft, entries are store proxies, never `===` the raw object that was
 * written. Compare through `snapshot`, which resolves a proxy to its backing object.
 */
export function isSameStoreEntry(a: unknown, b: unknown): boolean {
	return a === b || snapshot(a) === snapshot(b)
}
