import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import {
	COMPONENTS,
	COST_TESTS,
	GENERIC_COST_TESTS,
	PENDING_COST,
	NON_COMPONENT_EXPORTS,
	PENDING_COVERAGE,
	SCENARIO_TAGS,
} from "../packages/base-ui/test/perf-solid/shared/manifest.ts"
import type { Scenario } from "../packages/base-ui/test/perf-solid/shared/types.ts"
import { ssrCases } from "../packages/base-ui/test/perf-solid/ssr/cases.ts"

const BASE_UI = resolve(import.meta.dir, "../packages/base-ui")
const PERF = join(BASE_UI, "test/perf-solid")
const SCENARIO_DIR = join(PERF, "shared/scenarios")

function exportSubpaths(): string[] {
	const pkg = JSON.parse(readFileSync(join(BASE_UI, "packages/solid/package.json"), "utf8"))
	return Object.keys(pkg.exports)
}

function matchesPattern(pattern: string, subpath: string): boolean {
	return pattern.endsWith("/*") ? subpath.startsWith(pattern.slice(0, -1)) : subpath === pattern
}

function isNonComponent(subpath: string): boolean {
	return Object.keys(NON_COMPONENT_EXPORTS).some((pattern) => matchesPattern(pattern, subpath))
}

/** Allowlist keys that match no export, so a removed export cannot leave a stale entry. */
function unmatchedAllowlistKeys(patterns: string[], subpaths: string[]): string[] {
	return patterns.filter((pattern) => !subpaths.some((s) => matchesPattern(pattern, s)))
}

async function loadScenarios(): Promise<{ file: string; scenario: Scenario }[]> {
	const files = [...new Bun.Glob("*.ts").scanSync(SCENARIO_DIR)].filter((f) => f !== "index.ts").sort()
	const out: { file: string; scenario: Scenario }[] = []
	for (const file of files) {
		const mod = (await import(join(SCENARIO_DIR, file))) as { default: Scenario[] }
		for (const scenario of mod.default) out.push({ file, scenario })
	}
	return out
}

describe("base-ui perf scenario manifest", () => {
	test("COMPONENTS matches the package exports minus the reasoned non-component allowlist", () => {
		const fromExports = exportSubpaths()
			.filter((subpath) => !isNonComponent(subpath))
			.map((subpath) => subpath.slice(2))
			.sort()
		expect([...COMPONENTS].sort()).toEqual(fromExports)
		expect(unmatchedAllowlistKeys(Object.keys(NON_COMPONENT_EXPORTS), exportSubpaths())).toEqual([])
		for (const reason of Object.values(NON_COMPONENT_EXPORTS)) expect(reason.length).toBeGreaterThan(0)
	})

	test("an allowlist key that matches no export is reported, wildcard or exact", () => {
		const subpaths = [".", "./types", "./accordion"]
		expect(unmatchedAllowlistKeys([".", "./types", "./internals/*", "./merge-props"], subpaths)).toEqual([
			"./internals/*",
			"./merge-props",
		])
	})

	test("every scenario declares known components and closed-vocabulary tags", async () => {
		const known = new Set<string>(COMPONENTS)
		const tags = new Set<string>(SCENARIO_TAGS)
		const problems: string[] = []
		for (const { file, scenario } of await loadScenarios()) {
			const where = `${file} ${scenario.id}`
			if (!Array.isArray(scenario.components) || scenario.components.length === 0) {
				problems.push(`${where}: missing components`)
			} else {
				for (const c of scenario.components) if (!known.has(c)) problems.push(`${where}: unknown component ${c}`)
				if (scenario.id.split("/")[0] !== "static" && scenario.id.split("/")[0] !== "composition") {
					if (scenario.id.split("/")[0] !== scenario.components[0])
						problems.push(`${where}: id prefix must name the primary component ${scenario.components[0]}`)
				}
			}
			if (!Array.isArray(scenario.tags) || scenario.tags.length === 0) {
				problems.push(`${where}: missing tags`)
			} else {
				for (const t of scenario.tags) if (!tags.has(t)) problems.push(`${where}: unknown tag ${t}`)
				if (new Set(scenario.tags).size !== scenario.tags.length) problems.push(`${where}: duplicate tags`)
				if (scenario.tags.filter((t) => t.startsWith("scale-")).length !== 1)
					problems.push(`${where}: needs exactly one scale-* tag`)
			}
			for (const step of scenario.steps) {
				if ((step.until === undefined) !== (step.timerMs === undefined))
					problems.push(`${where} › ${step.name}: until and timerMs go together`)
			}
		}
		expect(problems).toEqual([])
	})

	test("every public component has a component scenario, or a pending entry naming the leaf that adds it", async () => {
		const covered = new Set<string>()
		for (const { scenario } of await loadScenarios()) {
			if (scenario.tags?.includes("raw")) continue
			for (const c of scenario.components ?? []) covered.add(c)
		}
		const missing = COMPONENTS.filter((c) => !covered.has(c) && !(c in PENDING_COVERAGE))
		const stalePending = Object.keys(PENDING_COVERAGE).filter((c) => covered.has(c))
		expect({ missing, stalePending }).toEqual({ missing: [], stalePending: [] })
	})

	test("every SSR case declares known components and tags, including ssr and hydrate", () => {
		const known = new Set<string>(COMPONENTS)
		const tags = new Set<string>(SCENARIO_TAGS)
		const problems: string[] = []
		const ids = new Set<string>()
		for (const c of ssrCases) {
			if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`)
			ids.add(c.id)
			if (c.components.length === 0) problems.push(`${c.id}: missing components`)
			for (const name of c.components) if (!known.has(name)) problems.push(`${c.id}: unknown component ${name}`)
			if (c.id.split("/")[0] !== c.components[0]) problems.push(`${c.id}: id prefix must name ${c.components[0]}`)
			for (const t of c.tags) if (!tags.has(t)) problems.push(`${c.id}: unknown tag ${t}`)
			for (const t of ["ssr", "hydrate"]) if (!c.tags.includes(t as never)) problems.push(`${c.id}: missing tag ${t}`)
			if (c.tags.filter((t) => t.startsWith("scale-")).length !== 1)
				problems.push(`${c.id}: needs exactly one scale-* tag`)
		}
		expect(problems).toEqual([])
	})

	test("each library's SSR fixture files register exactly the SSR case ids, one file per primary component", () => {
		const expected = Object.groupBy(ssrCases, (c) => c.components[0])
		for (const lib of ["react", "solid"]) {
			const dir = join(PERF, "ssr", lib, "fixtures")
			const files = [...new Bun.Glob("*.tsx").scanSync(dir)].sort()
			expect({ lib, files }).toEqual({
				lib,
				files: Object.keys(expected)
					.sort()
					.map((c) => `${c}.tsx`),
			})
			for (const file of files) {
				const source = readFileSync(join(dir, file), "utf8")
				const registered = [...source.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]).sort()
				const component = file.replace(/\.tsx$/, "")
				expect({ lib, file, registered }).toEqual({
					lib,
					file,
					registered: (expected[component] ?? []).map((c) => c.id).sort(),
				})
			}
		}
	})

	test("every component claims its cost tests or names the leaf that adds them, and every cost test is claimed", () => {
		const list = join(BASE_UI, "../../.tmp/grunt/cost-test-list.json")
		const run = Bun.spawnSync(
			["bun", "x", "vitest", "list", "--project", "@solidports/base-ui", ".cost.test.tsx", `--json=${list}`],
			{ cwd: BASE_UI, env: { ...process.env, TZ: "UTC", VITEST_ENV: "jsdom" }, stdout: "pipe", stderr: "pipe" },
		)
		expect({ code: run.exitCode, err: run.exitCode ? run.stderr.toString().slice(-400) : "" }).toEqual({
			code: 0,
			err: "",
		})
		const real = new Set<string>((JSON.parse(readFileSync(list, "utf8")) as { name: string }[]).map((t) => t.name))
		const claimed = new Set(Object.values(COST_TESTS).flat())
		const both = COMPONENTS.filter((c) => c in COST_TESTS && c in PENDING_COST)
		const neither = COMPONENTS.filter((c) => !(c in COST_TESTS) && !(c in PENDING_COST))
		const missingNames = [...claimed, ...Object.keys(GENERIC_COST_TESTS)].filter((name) => !real.has(name))
		const unclaimed = [...real].filter((name) => !claimed.has(name) && !(name in GENERIC_COST_TESTS))
		const empty = Object.entries(COST_TESTS)
			.filter(([, names]) => names.length === 0)
			.map(([c]) => c)
		expect({ both, neither, missingNames, unclaimed, empty }).toEqual({
			both: [],
			neither: [],
			missingNames: [],
			unclaimed: [],
			empty: [],
		})
	}, 60_000)

	test("scenario sources typecheck, so a tag or component typo fails", () => {
		const run = Bun.spawnSync(["bun", "run", "--cwd", PERF, "tsc", "-p", "tsconfig.json"], {
			stderr: "pipe",
			stdout: "pipe",
		})
		expect({ code: run.exitCode, out: run.stdout.toString() + run.stderr.toString() }).toEqual({
			code: 0,
			out: expect.any(String),
		})
	})
})
