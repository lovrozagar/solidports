import { createRoot } from "solid-js"
import type { JSX } from "@solidjs/web"

/**
 * Type-level specs: evaluates JSX once inside a disposed root so the compiler checks the
 * props and the components run without a mounted chart (upstream returns the element
 * from the test body and React never renders it).
 */
export function compileOnly(fn: () => JSX.Element): void {
	createRoot((dispose) => {
		fn()
		dispose()
	})
}
