import { render } from "./render"
import type { JSX } from '@solidjs/web';
/**
 * Solid does not have StrictMode. This is a thin wrapper around
 * render kept for API compatibility with tests that import it.
 */
export function renderWithStrictMode(ui: () => JSX.Element): ReturnType<typeof render> {
	return render(ui)
}
