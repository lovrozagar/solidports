import { render } from "@solidjs/testing-library"
import type { JSX } from "solid-js"

/**
 * Solid does not have StrictMode. This is a thin wrapper around
 * render kept for API compatibility with tests that import it.
 */
export function renderWithStrictMode(ui: () => JSX.Element): ReturnType<typeof render> {
	return render(ui)
}
