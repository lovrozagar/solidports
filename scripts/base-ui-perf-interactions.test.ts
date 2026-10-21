import { describe, expect, test } from "bun:test"
import { ssrCases } from "../packages/base-ui/test/perf-solid/ssr/cases.ts"

// D29: TTI and INP share one definition per SSR case: the trigger a user clicks, the effect only
// the library's JavaScript can produce, and how to undo it before the warm second click.
const INTERACTIVE = [
	"accordion/300",
	"checkbox/1000",
	"dialog/page",
	"menu/page",
	"popover/page",
	"select/1000",
	"tabs/200",
]

describe("SSR case interactions (TTI and INP)", () => {
	test("the cases a user can click name an interaction; the others name none", () => {
		const named = ssrCases.filter((c) => c.interaction).map((c) => c.id)
		expect(named.sort()).toEqual([...INTERACTIVE].sort())
	})

	test("every interaction names a trigger, a JS-set effect and an undo", () => {
		const problems: string[] = []
		for (const c of ssrCases) {
			const i = c.interaction
			if (!i) continue
			if (!i.trigger.trim()) problems.push(`${c.id}: empty trigger`)
			const effect = i.effect
			const byAttribute = effect.attribute !== undefined && effect.value !== undefined
			if (byAttribute === Boolean(effect.absent)) {
				problems.push(`${c.id}: the effect is an attribute value or an absent element, exactly one`)
			}
			if (effect.absent && !effect.selector) problems.push(`${c.id}: an absent effect names its selector`)
			const undo = i.undo
			if (!(undo === "toggle" || undo === "escape" || (typeof undo === "object" && undo.click.trim()))) {
				problems.push(`${c.id}: undo is toggle, escape or a click on a selector`)
			}
		}
		expect(problems).toEqual([])
	})

	test("the popups whose dead trigger shipped to Safari have their own cases", () => {
		const ids = new Set(ssrCases.map((c) => c.id))
		expect(ids.has("menu/page")).toBe(true)
		expect(ids.has("popover/page")).toBe(true)
	})
})
