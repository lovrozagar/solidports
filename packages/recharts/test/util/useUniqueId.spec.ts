import { describe, it, expect } from "vitest"
import { useUniqueId } from "../../src/util/useUniqueId"
import { useId } from "../../src/util/useId"

describe("useId", () => {
	it("should generate a unique ID", () => {
		const id = useId()
		expect(id.length).toBeGreaterThanOrEqual(1)
	})
	it("should generate different IDs on each call", () => {
		const id1 = useId()
		const id2 = useId()
		expect(id1).not.toBe(id2)
	})
})
describe("useUniqueId", () => {
	describe("without prefix", () => {
		it("should generate a unique ID without prefix", () => {
			const id = useUniqueId()
			expect(id.length).toBeGreaterThanOrEqual(1)
		})
	})
	describe("with prefix", () => {
		it("should generate a unique ID with prefix", () => {
			const id = useUniqueId("bar")
			expect(id).toMatch(/^bar-.+$/)
		})
	})
	describe("with customId", () => {
		it("should return custom ID if provided, and ignore the prefix", () => {
			const id = useUniqueId("bar", "custom-id-modern")
			expect(id).toBe("custom-id-modern")
		})
	})
})
