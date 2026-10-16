import { describe, expect, test } from "bun:test"
import { matchesFilter, parseFilter } from "../packages/base-ui/test/perf-solid/shared/filter.mjs"

const entry = (id: string, components: string[], tags: string[]) => ({ id, components, tags })
const accordion = entry("accordion/300", ["accordion"], ["scale-100", "controlled"])
const accordionRaw = entry("accordion/raw-300", ["accordion"], ["scale-100", "raw"])
const form = entry("form/50-fields", ["form", "field"], ["scale-100", "typing"])

const pick = (raw: string | undefined) =>
	[accordion, accordionRaw, form].filter((e) => matchesFilter(e, parseFilter(raw))).map((e) => e.id)

describe("perf bench filter", () => {
	test("no filter keeps everything", () => {
		expect(pick(undefined)).toEqual(["accordion/300", "accordion/raw-300", "form/50-fields"])
		expect(pick("")).toEqual(["accordion/300", "accordion/raw-300", "form/50-fields"])
	})

	test("a bare term is an id prefix, as before", () => {
		expect(pick("accordion/raw")).toEqual(["accordion/raw-300"])
	})

	test("component: matches any declared component, not only the id prefix", () => {
		expect(pick("component:field")).toEqual(["form/50-fields"])
	})

	test("tag: matches a declared tag; positive terms are OR'd", () => {
		expect(pick("tag:raw,component:form")).toEqual(["accordion/raw-300", "form/50-fields"])
	})

	test("! excludes, and exclusion alone starts from everything", () => {
		expect(pick("component:accordion,!tag:raw")).toEqual(["accordion/300"])
		expect(pick("!tag:raw")).toEqual(["accordion/300", "form/50-fields"])
	})

	test("! composes with component:, tag: and id terms in either order", () => {
		expect(pick("!tag:raw,component:accordion")).toEqual(pick("component:accordion,!tag:raw"))
		expect(pick("tag:scale-100,!component:form")).toEqual(["accordion/300", "accordion/raw-300"])
		expect(pick("!component:form,tag:scale-100")).toEqual(["accordion/300", "accordion/raw-300"])
		expect(pick("!accordion/raw,tag:scale-100,!component:form")).toEqual(["accordion/300"])
	})

	test("an unknown term kind fails instead of matching nothing", () => {
		expect(() => parseFilter("comp:accordion")).toThrow("Unknown filter kind comp")
	})
})
