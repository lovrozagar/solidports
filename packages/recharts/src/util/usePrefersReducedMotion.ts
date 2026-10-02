import { createSignal, untrack, onSettled } from 'solid-js';
import { Global } from "./Global"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function readPrefersReducedMotion(): boolean {
	if (Global.isSsr) {
		return false
	}
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
		return false
	}
	return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * Detects and subscribes to the user's `prefers-reduced-motion` system preference.
 * Returns `true` when the user prefers reduced motion, `false` otherwise.
 * SSR-safe: always returns `false` during server-side rendering.
 */
export function usePrefersReducedMotion(): boolean {
	const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(readPrefersReducedMotion())

	onSettled(() => {
		if (Global.isSsr || typeof window === "undefined" || typeof window.matchMedia !== "function") {
			return undefined
		}
		const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
		const handleChange = () => {
			setPrefersReducedMotion(mediaQuery.matches)
		}
		mediaQuery.addEventListener("change", handleChange)
		return () => {
			mediaQuery.removeEventListener("change", handleChange)
		}
	})

	/* Component bodies are untracked in Solid 2; reading the signal here is a
	   snapshot (components run once). untrack keeps STRICT_READ quiet. */
	return untrack(prefersReducedMotion)
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
