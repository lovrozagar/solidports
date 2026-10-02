import { afterEach, expect, test, vi } from "vitest"
import { createRoot } from "solid-js"

import { usePrefersReducedMotion } from "../../src/util/usePrefersReducedMotion"
import { Global } from "../../src/util/Global"

/* Solid counterpart of renderHook: run the hook once inside a root and read its value. */
function renderPrefersReducedMotion(): { result: { current: boolean } } {
	return createRoot((dispose) => {
		const current = usePrefersReducedMotion()
		dispose()
		return { result: { current } }
	})
}

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

test("prefers-reduced-motion query is not supported", () => {
	vi.spyOn(Global, "isSsr", "get").mockReturnValue(false)
	const { result } = renderPrefersReducedMotion()

	expect(result.current).toBe(false)
})

test("prefers-reduced-motion query is supported and matches", () => {
	vi.spyOn(Global, "isSsr", "get").mockReturnValue(false)
	vi.stubGlobal("matchMedia", () => ({
		addEventListener: vi.fn(),
		matches: true,
		removeEventListener: vi.fn(),
	}))

	const { result } = renderPrefersReducedMotion()

	expect(result.current).toBe(true)
})

test("prefers-reduced-motion query is supported and does not match", () => {
	vi.spyOn(Global, "isSsr", "get").mockReturnValue(false)
	vi.stubGlobal("matchMedia", () => ({
		addEventListener: vi.fn(),
		matches: false,
		removeEventListener: vi.fn(),
	}))

	const { result } = renderPrefersReducedMotion()

	expect(result.current).toBe(false)
})

test("in SSR should return false", () => {
	vi.spyOn(Global, "isSsr", "get").mockReturnValue(true)
	vi.stubGlobal("matchMedia", () => ({
		addEventListener: vi.fn(),
		matches: false,
		removeEventListener: vi.fn(),
	}))
	const { result } = renderPrefersReducedMotion()

	expect(result.current).toBe(false)
})
