import { createStore, runWithOwner } from "solid-js"

/**
 * Marks chart data as a raw record so the chart store serves it by reference instead of
 * wrapping every row in a proxy.
 *
 * Upstream treats chart data as immutable: a change replaces the whole array, and selectors
 * compare it by reference. A deep store would instead track each row field a selector reads,
 * so a derivation over N rows would subscribe to N × fields signals. A shallow store ingests
 * its values as raw records (Solid's sticky raw contract), after which no store wraps them; the
 * slot that holds the array still tracks replacement.
 *
 * Values that cannot be marked stay deep-tracked: proxies from a user store (Solid skips them),
 * and raw objects that already back a deep store (Solid throws, and exposes no query for it).
 */
export function markRawData<T>(value: T): T {
	if (value == null || typeof value !== "object") {
		return value
	}
	try {
		runWithOwner(null, () => createStore({ value }, { shallow: true }))
	} catch {
		/* already backs a deep store: keep it deep-tracked */
	}
	return value
}
