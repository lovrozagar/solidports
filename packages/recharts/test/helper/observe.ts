import { createRenderEffect } from "solid-js"

/**
 * Test probe: runs `fn` in a tracked scope and re-runs it whenever a value it reads
 * changes, including writes committed in the same flush as its first run.
 * `fn` must only read reactive state and call spies.
 */
export function observe(fn: () => void): void {
	createRenderEffect(fn, () => undefined)
}
