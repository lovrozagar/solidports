import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const PERF = join(import.meta.dir, "../packages/base-ui/test/perf-solid")
const profile = readFileSync(join(PERF, "profile.mjs"), "utf8")
const harness = readFileSync(join(PERF, "shared/harness.ts"), "utf8")

// profile.mjs evaluated `lib.mount(...)` after the harness moved the library under `window.bench`,
// so every profile failed with "lib is not defined" (regate c's menu/500 mount question).
describe("the CPU profiler", () => {
	test("drives the library through the harness's window.bench.debug", () => {
		expect(harness).toMatch(/\bdebug: lib\b/)
		const evaluated = [...profile.matchAll(/`([^`]*\.mount\([^`]*)`/g)].map((match) => match[1])
		expect(evaluated.length).toBeGreaterThan(0)
		for (const source of evaluated) {
			expect(source).toContain("window.bench.debug.")
		}
	})

	test("has a cold mode that profiles a fresh page's first mount, as the bench's mount step runs", () => {
		expect(profile).toContain("process.env.PROFILE_COLD")
		expect(profile).toMatch(/newPage\(\)[\s\S]*Profiler\.start[\s\S]*window\.bench\.debug\.mount/)
	})
})
