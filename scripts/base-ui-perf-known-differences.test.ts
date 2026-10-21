import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { knownDifference } from "../packages/base-ui/test/perf-solid/shared/known.mjs"

const KNOWN = JSON.parse(
	readFileSync(join(import.meta.dir, "../packages/base-ui/test/perf-solid/known-differences.json"), "utf8"),
)
const summary = (nodes: number, extra: Record<string, number> = {}) => JSON.stringify({ nodes, expanded: 0, ...extra })

describe("known React/Solid DOM differences", () => {
	test("a node delta allows exactly that delta and nothing else in the summary", () => {
		const known = { nodesDelta: 1, reason: "r" }
		expect(knownDifference(known, summary(2), summary(3))).toBe(true)
		expect(knownDifference(known, summary(2), summary(4))).toBe(false)
		expect(knownDifference(known, summary(2), summary(3, { expanded: 1 }))).toBe(false)
	})

	test("named fields are ignored and every other field must match", () => {
		const known = { fields: ["expanded"], reason: "r" }
		expect(knownDifference(known, summary(2), summary(2, { expanded: 1 }))).toBe(true)
		expect(knownDifference(known, summary(2), summary(3, { expanded: 1 }))).toBe(false)
		expect(knownDifference(undefined, summary(2), summary(3))).toBe(false)
	})

	test("the SSR menu page keeps Menu.Trigger's inert trailing guard, as the browser mount does", () => {
		// The SSR bench's hydrated summary: React renders the trigger alone, Solid the trigger and its
		// inert trailing focus guard (utils/popups/TriggerFocusGuards.tsx), on the server and after
		// hydration alike.
		const react = JSON.stringify({ nodes: 2, expanded: 0, checkboxes: 0, dialog: 0, tabsSelected: 0, labelled: 0 })
		const solid = JSON.stringify({ nodes: 3, expanded: 0, checkboxes: 0, dialog: 0, tabsSelected: 0, labelled: 0 })
		expect(knownDifference(KNOWN["menu/page"]?.hydrate, react, solid)).toBe(true)
		expect(KNOWN["menu/page"].hydrate.reason).toContain("TriggerFocusGuards")
	})
})
