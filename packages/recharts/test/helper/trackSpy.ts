import { createRenderEffect, untrack } from "solid-js"
import { structurallyEqual } from "./structurallyEqual"

/**
 * Solid analogue of calling a hook during every React render and passing the
 * result to a spy: `read` runs in a tracked scope, and `spy` receives each new value
 * (consecutive structurally equal values are reported once). Call it from a component body.
 */
export function trackSpy<T>(spy: (value: T) => void, read: () => T): void {
	let hasValue = false
	let last: T | undefined
	createRenderEffect(read, (value) => {
		if (hasValue && untrack(() => structurallyEqual(value, last))) {
			return
		}
		hasValue = true
		last = value
		spy(value)
	})
}
