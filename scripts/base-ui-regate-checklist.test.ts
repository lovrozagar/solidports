import { describe, expect, test } from "bun:test"
import { regateChecklist } from "../packages/base-ui/scripts/regate-checklist.mjs"

// D28: the regate checklist is generated from the reports, so a flagged row cannot drop out
// unrouted (navigation-menu/8x100 mount flagged in regate6 and again in regate8).
const row = (key: string, metric: string, verdict: string) => ({ key, metric, verdict })
const report = (over: Partial<Record<string, unknown>>) => ({
	verdicts: { browser: [], ssr: [] },
	regressions: { failing: [], allowed: [], generated: [] },
	exitBar: [],
	...over,
})

describe("the generated regate checklist", () => {
	test("lists every unallowed regression, and exit-bar targets apart from them", () => {
		const r = report({
			verdicts: { browser: [row("menu/500 › open", "sync", "regressed")], ssr: [] },
			regressions: { failing: [row("menu/500 › open", "sync", "regressed")], allowed: [], generated: [] },
			exitBar: [
				{ key: "accordion/300", metric: "serverMs", pass: false },
				{ key: "tabs/200", metric: "serverMs", pass: true },
			],
		})
		const list = regateChecklist([r], [])
		expect(list.rows).toEqual([{ key: "menu/500 › open", metric: "sync", status: "regressed" }])
		expect(list.targets).toEqual([{ key: "accordion/300", metric: "serverMs" }])
	})

	test("carries a previous row until a report shows it fixed or allowed", () => {
		const previous = [
			{ key: "navigation-menu/8x100 › mount", metric: "sync" },
			{ key: "tabs/200 › unmount", metric: "sync" },
			{ key: "toolbar/200 › close menu", metric: "sync" },
		]
		const r = report({
			verdicts: {
				browser: [row("tabs/200 › unmount", "sync", "same"), row("toolbar/200 › close menu", "sync", "regressed")],
				ssr: [],
			},
			regressions: { failing: [], allowed: [row("toolbar/200 › close menu", "sync", "regressed")], generated: [] },
		})
		const list = regateChecklist([r], previous)
		// navigation-menu was not measured by this report: it carries. tabs is fixed, toolbar allowed.
		expect(list.rows).toEqual([{ key: "navigation-menu/8x100 › mount", metric: "sync", status: "carried" }])
	})

	test("a carried row that regresses again is listed once, as regressed", () => {
		const previous = [{ key: "menu/500 › open", metric: "sync" }]
		const r = report({
			verdicts: { browser: [row("menu/500 › open", "sync", "regressed")], ssr: [] },
			regressions: { failing: [row("menu/500 › open", "sync", "regressed")], allowed: [], generated: [] },
		})
		expect(regateChecklist([r], previous).rows).toEqual([
			{ key: "menu/500 › open", metric: "sync", status: "regressed" },
		])
	})
})
