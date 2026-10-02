import { runWithOwner } from "solid-js"

/**
 * Runs chart-state writes from a cleanup. Disposal can happen inside a computation
 * (for example a `Show` switching branches), where Solid 2 rejects owned writes;
 * teardown bookkeeping has no owner of its own.
 */
export function teardownWrite(write: () => void): void {
	runWithOwner(null, write)
}
