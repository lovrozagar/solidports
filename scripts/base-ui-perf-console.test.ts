import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { matchConsole } from "../packages/base-ui/test/perf-solid/shared/console.mjs"

const KNOWN_FILE = resolve(import.meta.dir, "../packages/base-ui/test/perf-solid/known-warnings.json")

describe("bench console capture", () => {
	const known = [
		{ variant: "solid", kind: "warn", pattern: "^\\[FLUSH_IN_EFFECT_CALLBACK\\]", reason: "harness flush" },
		{ variant: "*", kind: "error", pattern: "ResizeObserver loop", reason: "browser noise" },
	]

	test("a message matching a known entry by variant, kind and pattern is known, with its reason", () => {
		const result = matchConsole(
			[
				{ scenario: "menu/500", variant: "solid", kind: "warn", text: "[FLUSH_IN_EFFECT_CALLBACK] flush() was called" },
				{ scenario: "menu/500", variant: "react", kind: "error", text: "ResizeObserver loop limit exceeded" },
			],
			known,
		)
		expect(result.unknown).toEqual([])
		expect(result.known.map((hit) => hit.reason)).toEqual(["harness flush", "browser noise"])
	})

	test("anything else is unknown: another variant, another kind, or another text", () => {
		const result = matchConsole(
			[
				{ scenario: "a/1", variant: "react", kind: "warn", text: "[FLUSH_IN_EFFECT_CALLBACK] x" },
				{ scenario: "a/1", variant: "solid", kind: "error", text: "[FLUSH_IN_EFFECT_CALLBACK] x" },
				{ scenario: "a/1", variant: "solid", kind: "warn", text: "Base UI: something new" },
			],
			known,
		)
		expect(result.known).toEqual([])
		expect(result.unknown.map((entry) => `${entry.variant} ${entry.kind}`)).toEqual([
			"react warn",
			"solid error",
			"solid warn",
		])
	})

	test("known-warnings.json: every entry has a variant, a kind, a valid pattern and a reason", () => {
		const file = JSON.parse(readFileSync(KNOWN_FILE, "utf8"))
		expect(Array.isArray(file.entries)).toBe(true)
		for (const entry of file.entries) {
			expect(["solid", "react", "*"]).toContain(entry.variant)
			expect(["warn", "error"]).toContain(entry.kind)
			expect(() => new RegExp(entry.pattern)).not.toThrow()
			expect(entry.reason.length).toBeGreaterThan(10)
		}
	})
})
