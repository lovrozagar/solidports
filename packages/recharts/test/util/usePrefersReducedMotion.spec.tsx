import { describe, expect, it, vi, afterEach } from "vitest"
import { render } from "@solidjs/testing-library"
import { usePrefersReducedMotion } from "../../src/util/usePrefersReducedMotion"
import { Global } from "../../src/util/Global"

function readPrefersReducedMotion(): boolean | undefined {
	let value: boolean | undefined
	const Probe = (): null => {
		value = usePrefersReducedMotion()
		return null
	}
	render(() => <Probe />)
	return value
}

describe("usePrefersReducedMotion", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("prefers-reduced-motion query is not supported", () => {
		vi.spyOn(Global, "isSsr", "get").mockReturnValue(false)
		expect(readPrefersReducedMotion()).toBe(false)
	})

	it("prefers-reduced-motion query is supported and matches", () => {
		vi.spyOn(Global, "isSsr", "get").mockReturnValue(false)
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: vi.fn(),
			matches: true,
			removeEventListener: vi.fn(),
		}))

		expect(readPrefersReducedMotion()).toBe(true)
	})

	it("prefers-reduced-motion query is supported and does not match", () => {
		vi.spyOn(Global, "isSsr", "get").mockReturnValue(false)
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: vi.fn(),
			matches: false,
			removeEventListener: vi.fn(),
		}))

		expect(readPrefersReducedMotion()).toBe(false)
	})

	it("in SSR should return false", () => {
		vi.spyOn(Global, "isSsr", "get").mockReturnValue(true)
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: vi.fn(),
			matches: false,
			removeEventListener: vi.fn(),
		}))
		expect(readPrefersReducedMotion()).toBe(false)
	})
})
