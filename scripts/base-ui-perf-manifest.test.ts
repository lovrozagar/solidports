import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import {
	COMPONENTS,
	NON_COMPONENT_EXPORTS,
	PENDING_COVERAGE,
	SCENARIO_TAGS,
} from "../packages/base-ui/test/perf-solid/shared/manifest.ts"
import type { Scenario } from "../packages/base-ui/test/perf-solid/shared/types.ts"

const BASE_UI = resolve(import.meta.dir, "../packages/base-ui")
const PERF = join(BASE_UI, "test/perf-solid")
const SCENARIO_DIR = join(PERF, "shared/scenarios")

function exportSubpaths(): string[] {
	const pkg = JSON.parse(readFileSync(join(BASE_UI, "packages/solid/package.json"), "utf8"))
	return Object.keys(pkg.exports)
}

function isNonComponent(subpath: string): boolean {
	return Object.keys(NON_COMPONENT_EXPORTS).some((pattern) =>
		pattern.endsWith("/*") ? subpath.startsWith(pattern.slice(0, -1)) : subpath === pattern,
	)
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
		for (const [pattern, reason] of Object.entries(NON_COMPONENT_EXPORTS)) {
			expect(exportSubpaths().some((s) => isNonComponent(s) && (s === pattern || pattern.endsWith("/*")))).toBe(true)
			expect(reason.length).toBeGreaterThan(0)
		}
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
