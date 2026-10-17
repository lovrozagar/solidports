import { describe, expect, test } from "bun:test"
import { parseArgs, planSuites, runAll } from "../packages/base-ui/scripts/test-all.mjs"

type Suite = { name: string; heavy?: boolean; exclusive?: boolean; after?: string; run: string[]; generated?: string[] }
type Planned = Suite & { selected: boolean; detail?: string }

const byName = (suites: Planned[], name: string) => suites.find((s) => s.name === name) as Planned

describe("test:base-ui:all plan", () => {
	test("parseArgs reads --only, --list, --changed [ref] and --full-bench", () => {
		expect(parseArgs([])).toEqual({ only: null, list: false, changed: null, fullBench: false })
		expect(parseArgs(["--changed"]).changed).toBe("")
		expect(parseArgs(["--changed", "main~3", "--full-bench"])).toMatchObject({ changed: "main~3", fullBench: true })
		expect(parseArgs(["--changed", "--only", "jsdom"])).toMatchObject({ changed: "", only: ["jsdom"] })
	})

	test("the gate benchmark is a one-run correctness check unless --full-bench asks for the measured run", () => {
		expect(byName(planSuites({}), "benchmark").run).toEqual([
			"bun run bench:solid:build",
			"WARMUP=0 node test/perf-solid/run.mjs 1",
		])
		expect(byName(planSuites({ fullBench: true }), "benchmark").run).toEqual([
			"bun run bench:solid:build",
			"bun run bench:solid",
		])
	})

	test("heavy suites, ordering chains and generated paths are declared", () => {
		const suites = planSuites({})
		expect(suites.filter((s) => s.heavy).map((s) => s.name)).toEqual([
			"jsdom",
			"chromium",
			"parity-firefox",
			"parity-webkit",
			"e2e",
			"regressions",
			"screen-reader",
			"docs-validate",
			"docs-build",
			"docs-hydration",
			"benchmark",
		])
		expect(Object.fromEntries(suites.filter((s) => s.after).map((s) => [s.name, s.after]))).toEqual({
			"public-types": "package",
			"node-resolution": "public-types",
			"docs-build": "docs-validate",
			"docs-hydration": "docs-build",
		})
		expect(Object.fromEntries(suites.filter((s) => s.generated).map((s) => [s.name, s.generated]))).toEqual({
			"error-codes": ["packages/base-ui/docs/react/src/error-codes.json"],
			"docs-generate": ["packages/base-ui/docs/solid"],
			"inline-scripts": ["packages/base-ui/packages/react/src", "packages/base-ui/packages/solid/src"],
			"docs-validate": ["packages/base-ui/docs"],
		})
	})

	test("jsdom generates the declaration files before its run, as the workflow does", () => {
		expect(byName(planSuites({}), "jsdom").run).toEqual([
			"bun run --cwd packages/solid types",
			"bun run test:solid:jsdom --run --maxWorkers=2",
		])
	})

	test("--changed selects jsdom and chromium only, running vitest on the module-graph diff", () => {
		const suites = planSuites({ changed: "main~3" })
		expect(suites.filter((s) => s.selected).map((s) => s.name)).toEqual(["jsdom", "chromium"])
		expect(byName(suites, "jsdom").run).toEqual([
			"bun run test:solid:jsdom --run --maxWorkers=2 --changed main~3 --passWithNoTests",
		])
		expect(byName(planSuites({ changed: "" }), "chromium").run).toEqual([
			"bun run test:solid:chromium --run --maxWorkers=2 --changed --passWithNoTests",
		])
		expect(byName(suites, "eslint")).toMatchObject({ selected: false, detail: "not selected (--changed)" })
	})
})

describe("test:base-ui:all scheduler", () => {
	const suite = (name: string, extra: Partial<Suite> = {}): Planned => ({ name, run: [name], selected: true, ...extra })

	async function simulate(suites: Planned[], limits: { heavy: number; light: number }) {
		const active = new Set<string>()
		const peaks = { heavy: 0, light: 0, exclusive: 0 }
		const order: string[] = []
		const results = await runAll(
			suites,
			async (s: Planned) => {
				active.add(s.name)
				order.push(`start ${s.name}`)
				const now = suites.filter((x) => active.has(x.name))
				peaks.heavy = Math.max(peaks.heavy, now.filter((x) => x.heavy).length)
				peaks.light = Math.max(peaks.light, now.filter((x) => !x.heavy).length)
				peaks.exclusive = Math.max(peaks.exclusive, now.filter((x) => x.exclusive).length)
				await Bun.sleep(s.heavy ? 30 : 10)
				active.delete(s.name)
				order.push(`end ${s.name}`)
				return { status: s.name === "boom" ? "fail" : "pass", detail: "" }
			},
			limits,
		)
		return { results, peaks, order }
	}

	test("runs light suites together, caps heavy and exclusive ones, and keeps declaration order in results", async () => {
		const suites = [
			suite("lint"),
			suite("typecheck"),
			suite("package"),
			suite("format"),
			suite("vale"),
			suite("jsdom", { heavy: true }),
			suite("chromium", { heavy: true, exclusive: true }),
			suite("e2e", { heavy: true, exclusive: true }),
			suite("docs-build", { heavy: true }),
			suite("boom"),
		]
		const { results, peaks } = await simulate(suites, { heavy: 2, light: 4 })
		expect(peaks).toEqual({ heavy: 2, light: 4, exclusive: 1 })
		expect(results.map((r: { suite: Planned; status: string }) => [r.suite.name, r.status])).toEqual([
			["lint", "pass"],
			["typecheck", "pass"],
			["package", "pass"],
			["format", "pass"],
			["vale", "pass"],
			["jsdom", "pass"],
			["chromium", "pass"],
			["e2e", "pass"],
			["docs-build", "pass"],
			["boom", "fail"],
		])
	})

	test("a suite with `after` starts only once that suite has finished, pass or fail", async () => {
		const suites = [
			suite("docs-validate", { heavy: true }),
			suite("docs-build", { heavy: true, after: "docs-validate" }),
			suite("docs-hydration", { heavy: true, exclusive: true, after: "docs-build" }),
			suite("jsdom", { heavy: true }),
		]
		const { order } = await simulate(suites, { heavy: 4, light: 4 })
		const at = (event: string) => order.indexOf(event)
		expect(at("start docs-build")).toBeGreaterThan(at("end docs-validate"))
		expect(at("start docs-hydration")).toBeGreaterThan(at("end docs-build"))
		expect(at("start jsdom")).toBeLessThan(at("end docs-validate"))
	})

	test("unselected suites are reported as not run with their reason and never start", async () => {
		const suites = [
			suite("jsdom", { heavy: true }),
			{ ...suite("eslint"), selected: false, detail: "not selected (--changed)" },
		]
		const { results, order } = await simulate(suites, { heavy: 2, light: 4 })
		expect(order).toEqual(["start jsdom", "end jsdom"])
		expect(results[1]).toMatchObject({ status: "not run", detail: "not selected (--changed)", seconds: 0 })
	})
})
