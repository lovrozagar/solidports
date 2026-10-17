import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { main, vitestName } from "../packages/base-ui/scripts/bench-component.mjs"
import { summarize } from "../packages/base-ui/test/perf-solid/shared/report.mjs"
import { COST_TESTS } from "../packages/base-ui/test/perf-solid/shared/manifest.ts"

// bench-component's main path end to end, with the processes it starts replaced by canned output:
// builds do nothing, the browser and SSR runners write result files as `run.mjs` and
// `ssr/run.mjs` do, and the cost run writes a vitest JSON report. A fault in main itself (a
// shadowed name in its temporal dead zone once failed only on the Mac) fails here.

const REPO = resolve(import.meta.dir, "..")
const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** 24 samples around `ms`, deterministic. */
const samples = (ms: number) => Array.from({ length: 24 }, (_, i) => ms * (1 + ((i * 7) % 11) / 200))

const step = (ms: number) => ({
	sync: samples(ms),
	paint: samples(ms + 1),
	script: samples(ms),
	layout: samples(0),
	style: samples(0),
	settled: [],
})

/** The browser runner's result files for one scenario, `cur` at `curMs`. */
function browserResult(curMs: number) {
	const results = {
		"static/separator-input-1000": {
			react: { steps: { mount: step(10) }, heapKB: samples(2600) },
			base: { steps: { mount: step(40) }, heapKB: samples(11000) },
			cur: { steps: { mount: step(curMs) }, heapKB: samples(11000) },
		},
	}
	return {
		variants: ["react", "base", "cur"],
		summary: summarize(results, ["react", "base", "cur"], {}),
		raw: [],
		problems: [],
	}
}

function ssrResult(curMs: number) {
	const row = (ms: number) => ({
		serverMs: ms,
		hydrateCommitMs: ms * 2,
		samples: { serverMs: samples(ms), hydrateSyncMs: samples(ms * 2) },
	})
	return {
		variants: ["react", "base", "cur"],
		results: { "input/1000": { react: row(10), base: row(40), cur: row(curMs) } },
		problems: [],
	}
}

/** Runs main with canned runners; `curMs` sets cur's browser and server time (base is 40). */
async function bench(curMs: number) {
	const dir = mkdtempSync(join(tmpdir(), "bench-main-"))
	temps.push(dir)
	const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).stdout.trim()
	mkdirSync(join(dir, "baselines"))
	// The working tree's browser build, which main hashes for the report.
	mkdirSync(join(dir, "builds/solid/dist"), { recursive: true })
	writeFileSync(join(dir, "builds/solid/dist/index.js"), "export {}\n")
	writeFileSync(join(dir, "baselines", "b.json"), JSON.stringify({ label: "b", sha: head }))
	const commands: string[] = []
	const timeouts: Record<string, number | undefined> = {}
	const run = (
		command: string,
		args: string[],
		options: { env?: Record<string, string>; timeoutSeconds?: number } = {},
	) => {
		commands.push([command, ...args].join(" "))
		if (args.includes("test/perf-solid/run.mjs")) timeouts.browser = options.timeoutSeconds
		if (args.includes("test/perf-solid/ssr/run.mjs") && options.env?.RESULTS_FILE) timeouts.ssr = options.timeoutSeconds
		const file = options.env?.RESULTS_FILE
		const write = (result: object, title: string) => {
			writeFileSync(`${file}.json`, JSON.stringify(result))
			writeFileSync(`${file}.md`, `# ${title}\n\n(canned)\n`)
		}
		if (args.includes("test/perf-solid/run.mjs")) write(browserResult(curMs), "browser")
		else if (args.includes("test/perf-solid/ssr/run.mjs") && file) write(ssrResult(curMs), "ssr")
		else if (args.includes("vitest")) {
			const report = args.find((arg) => arg.startsWith("--outputFile="))!.slice("--outputFile=".length)
			const assertionResults = (COST_TESTS.separator ?? []).map((name) => ({
				fullName: vitestName(name),
				status: "passed",
			}))
			writeFileSync(report, JSON.stringify({ testResults: [{ assertionResults }] }))
		}
		return 0
	}
	const buildArchived = () => ({ browserOut: "base", ssrVariant: "base:solid", cached: true, buildHash: {} })
	const log = console.log
	console.log = () => {}
	let code: number
	try {
		code = await main(["separator", "--compare", "b"], {
			run,
			buildArchived,
			resultsDir: dir,
			buildsDir: join(dir, "builds"),
		})
	} finally {
		console.log = log
	}
	const md = readdirSync(dir).find((name) => /^component-separator-[^-].*\d{3}Z\.md$/.test(name))!
	return { code, md: readFileSync(join(dir, md), "utf8"), commands, timeouts }
}

describe("bench:component main", () => {
	test("an unchanged library compares clean: exit 0, the run's judging summary, every verdict same", async () => {
		const { code, md, commands } = await bench(40)
		expect(code).toBe(0)
		expect(md).toMatch(/\d+ pairs judged together; Benjamini–Hochberg at q = 0\.05/)
		expect(md).toContain("| static/separator-input-1000 › mount | sync |")
		expect(md).toContain("| input/1000 | serverMs |")
		expect(md).not.toContain("## Failures")
		expect(commands.some((c) => c.includes("--expose-gc test/perf-solid/ssr/run.mjs 20"))).toBe(true)
		expect(commands.some((c) => c.includes("test/perf-solid/run.mjs 12"))).toBe(true)
	})

	test("the browser and SSR runs get a timeout scaled to the work, never below the gate timeout", async () => {
		const { timeouts } = await bench(40)
		// One component at 12 runs, one SSR case at 20: both under the 1200 s floor.
		expect(timeouts).toEqual({ browser: 1200, ssr: 1200 })
	})

	test("a 2x slower library fails the run and names each regression", async () => {
		const { code, md } = await bench(80)
		expect(code).toBe(1)
		expect(md).toContain("## Failures")
		expect(md).toMatch(/- regressed: static\/separator-input-1000 › mount sync \d+\.\d+ → \d+\.\d+/)
		expect(md).toMatch(/- regressed: input\/1000 serverMs/)
	})
})
