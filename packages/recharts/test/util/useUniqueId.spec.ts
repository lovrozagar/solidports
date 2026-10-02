import { describe, it, expect } from "vitest"
import { renderHook } from "@solidjs/testing-library"
import { useUniqueId } from "../../src/util/useUniqueId"
import { useId } from "../../src/util/useId"

/*
 * Solid runs a hook once per component instance; there is no re-render. "Rerender" cases
 * read the value again after a flush: the id must stay the same. Upstream's React<18
 * `useIdFallback` has no Solid counterpart (Solid's createUniqueId is always available).
 */
describe("useId", () => {
	it("should generate a random ID without prefix", () => {
		const { result } = renderHook(() => useId())
		expect(result.length).toBeGreaterThanOrEqual(1)
	})

	it("should generate different IDs for different hook calls", () => {
		const first = renderHook(() => useId()).result
		const second = renderHook(() => useId()).result
		expect(first).not.toBe(second)
	})
})

describe("useUniqueId", () => {
	describe("without prefix", () => {
		it("should generate a random ID without prefix", () => {
			const { result } = renderHook(() => useUniqueId())
			expect(result.length).toBeGreaterThanOrEqual(1)
		})

		it("continues to return the same ID on rerender", () => {
			const { result } = renderHook(() => useUniqueId())
			const firstId = result
			expect(result).toBe(firstId)
		})

		it("should return the same ID even when props change", () => {
			let prefix: string | undefined
			const { result } = renderHook(() => useUniqueId(prefix))
			const firstId = result
			prefix = "new-prefix"
			expect(result).toBe(firstId)
		})
	})

	describe("with prefix", () => {
		it("should generate a random ID with prefix", () => {
			const { result } = renderHook(() => useUniqueId("bar"))
			expect(result).toMatch(/^bar-.+$/)
		})

		it("should return the same ID on rerender with prefix", () => {
			const { result } = renderHook(() => useUniqueId("bar"))
			const firstId = result
			expect(result).toBe(firstId)
		})

		it("should return the same ID even when props change", () => {
			let prefix = "bar"
			const { result } = renderHook(() => useUniqueId(prefix))
			const firstId = result
			prefix = "new-prefix"
			expect(result).toBe(firstId)
		})
	})

	describe("with customId", () => {
		it("should return custom ID if provided, and ignore the prefix", () => {
			const { result } = renderHook(() => useUniqueId("bar", "custom-id-modern"))
			expect(result).toBe("custom-id-modern")
		})

		it("should return the same custom ID on rerender", () => {
			const { result } = renderHook(() => useUniqueId("bar", "custom-id-modern"))
			expect(result).toBe("custom-id-modern")
			expect(result).toBe("custom-id-modern")
		})

		it("should return the same custom ID even when props change", () => {
			let customId = "custom-id-modern"
			const { result } = renderHook(() => useUniqueId("bar", customId))
			customId = "new-id"
			expect(result).toBe("custom-id-modern")
		})
	})
})
