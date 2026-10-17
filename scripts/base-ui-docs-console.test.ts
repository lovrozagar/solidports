import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { consoleProblem } from "../packages/base-ui/scripts/docs/consoleCheck.mjs"

const KNOWN_FILE = resolve(import.meta.dir, "../packages/base-ui/scripts/docs/known-console.json")

describe("docs crawl console check", () => {
	const known = [{ variant: "docs", kind: "warn", pattern: "^Download the", reason: "a listed warning" }]

	test("an unlisted warning or error is a problem; a listed one is not", () => {
		expect(consoleProblem({ type: "warning", text: "Base UI: new warning" }, known)).toBe(
			"console warning: Base UI: new warning",
		)
		expect(consoleProblem({ type: "error", text: "Boom" }, known)).toBe("console error: Boom")
		expect(consoleProblem({ type: "warning", text: "Download the devtools" }, known)).toBe(null)
	})

	test("other levels pass, except a message about hydration, which is a problem at any level", () => {
		expect(consoleProblem({ type: "log", text: "ready" }, known)).toBe(null)
		expect(consoleProblem({ type: "info", text: "Hydration mismatch at #root" }, known)).toBe(
			"console info: Hydration mismatch at #root",
		)
		// A listed pattern never excuses a hydration message.
		expect(consoleProblem({ type: "warning", text: "Download the hydration report" }, known)).toBe(
			"console warning: Download the hydration report",
		)
	})

	test("known-console.json: every entry is for the docs, with a kind, a valid pattern and a reason", () => {
		const file = JSON.parse(readFileSync(KNOWN_FILE, "utf8"))
		expect(Array.isArray(file.entries)).toBe(true)
		for (const entry of file.entries) {
			expect(["docs", "*"]).toContain(entry.variant)
			expect(["warn", "error"]).toContain(entry.kind)
			expect(() => new RegExp(entry.pattern)).not.toThrow()
			expect(entry.reason.length).toBeGreaterThan(10)
		}
	})
})
