import { Global } from "./Global"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/* One live MediaQueryList for the page (re-queried only if `matchMedia` itself is replaced).
   Every animated shape reads it on mount, so a query per instance shows up on chart switch. */
let queriedWith: typeof window.matchMedia | undefined
let mediaQuery: MediaQueryList | undefined

function readPrefersReducedMotion(): boolean {
	if (Global.isSsr) {
		return false
	}
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
		return false
	}
	if (mediaQuery === undefined || queriedWith !== window.matchMedia) {
		queriedWith = window.matchMedia
		mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
	}
	return mediaQuery.matches
}

/**
 * Reads the user's `prefers-reduced-motion` system preference.
 * Returns `true` when the user prefers reduced motion, `false` otherwise.
 * SSR-safe: always returns `false` during server-side rendering.
 *
 * Components run once in Solid, so the value is read at mount, as upstream's first render
 * does. Upstream re-renders on a preference change; a snapshot here never would, so no
 * change listener is kept per instance.
 */
export function usePrefersReducedMotion(): boolean {
	return readPrefersReducedMotion()
}

/**
 * `'auto'` follows reduced-motion and is off during SSR; a boolean is returned as-is.
 */
export function resolveIsAnimationActive(
	isActive: boolean | "auto",
	prefersReducedMotion: boolean,
): boolean {
	if (isActive === "auto") {
		return Global.isSsr === false && prefersReducedMotion === false
	}
	return isActive
}
