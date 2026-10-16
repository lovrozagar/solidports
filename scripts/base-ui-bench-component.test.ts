import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	costPattern,
	costPlan,
	depsDrift,
	dirHash,
	gitProvenance,
	parseArgs,
	resolveComponents,
	treeHash,
} from "../packages/base-ui/scripts/bench-component.mjs"

const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const temp = () => {
	const dir = mkdtempSync(join(tmpdir(), "bench-component-"))
	temps.push(dir)
	return dir
}
const git = (cwd: string, ...args: string[]) => {
	const run = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
	if (run.exitCode !== 0) throw new Error(run.stderr.toString())
	return run.stdout.toString().trim()
}
function repo() {
	const dir = temp()
	git(dir, "init", "-q")
	git(dir, "config", "user.email", "bench@test")
	git(dir, "config", "user.name", "bench")
	git(dir, "config", "commit.gpgsign", "false")
	writeFileSync(join(dir, "a.txt"), "one\n")
	git(dir, "add", ".")
	git(dir, "commit", "-q", "--no-verify", "-m", "init")
	return dir
}

describe("bench:component driver", () => {
	test("parseArgs reads names, runs, an extra filter, and the baseline flags", () => {
		expect(parseArgs(["collapsible,accordion", "--runs", "4", "--filter", "!tag:raw", "--compare", "b0"])).toEqual({
			names: ["collapsible", "accordion"],
			runs: 4,
			ssrRuns: 10,
			filter: "!tag:raw",
			saveBaseline: null,
			compare: "b0",
		})
		expect(() => parseArgs([])).toThrow("bench:component <name>[,...]|all")
		expect(() => parseArgs(["button", "--save-baseline", "b0", "--compare", "b0"])).toThrow(
			"--save-baseline and --compare",
		)
	})

	test("resolveComponents expands all and rejects an unknown name with the closest one", () => {
		const known = ["accordion", "collapsible", "tabs"]
		expect(resolveComponents(["all"], known)).toEqual(known)
		expect(() => resolveComponents(["colapsible"], known)).toThrow(
			'Unknown component "colapsible"; did you mean "collapsible"?',
		)
	})

	test("costPlan collects each component's cost tests once and lists pending ones with their leaf", () => {
		const shared = "toggles > Toggle in a ToggleGroup"
		const plan = costPlan(
			["toggle", "toggle-group", "meter"],
			{ toggle: ["toggles > Toggle", shared], "toggle-group": [shared] },
			{
				meter: "1.13",
			},
		)
		expect(plan).toEqual({ names: ["toggles > Toggle", shared], pending: { meter: "1.13" }, missing: [] })
		expect(costPlan(["tabs"], {}, {}).missing).toEqual(["tabs"])
	})

	test("costPattern anchors each full name, joins describe and test by a space, and escapes regex syntax", () => {
		const pattern = costPattern(["native toggles cost > Switch.Root + Thumb: ≤ 10 nodes (dev)"])
		expect(pattern).toBe("^(?:native toggles cost Switch\\.Root \\+ Thumb: ≤ 10 nodes \\(dev\\))$")
		expect(new RegExp(pattern).test("native toggles cost Switch.Root + Thumb: ≤ 10 nodes (dev)")).toBe(true)
		expect(new RegExp(pattern).test("native toggles cost Switch.Root + Thumb: ≤ 10 nodes (dev) extra")).toBe(false)
	})

	test("gitProvenance records the SHA, a dirty flag, a diff hash and untracked paths", () => {
		const dir = repo()
		const clean = gitProvenance(dir)
		expect(clean).toEqual({ sha: git(dir, "rev-parse", "HEAD"), dirty: false, diffSha256: null, untracked: [] })
		writeFileSync(join(dir, "a.txt"), "two\n")
		writeFileSync(join(dir, "new.txt"), "x\n")
		const dirty = gitProvenance(dir)
		expect(dirty).toMatchObject({ dirty: true, untracked: ["new.txt"] })
		expect(dirty.diffSha256).toMatch(/^[0-9a-f]{64}$/)
		expect(gitProvenance(dir).diffSha256).toBe(dirty.diffSha256)
		writeFileSync(join(dir, "a.txt"), "three\n")
		expect(gitProvenance(dir).diffSha256).not.toBe(dirty.diffSha256)
	})

	test("depsDrift reports a bun.lock that differs between the baseline commit and the working tree", () => {
		const dir = repo()
		writeFileSync(join(dir, "bun.lock"), "v1\n")
		git(dir, "add", ".")
		git(dir, "commit", "-q", "--no-verify", "-m", "lock v1")
		const base = git(dir, "rev-parse", "HEAD")
		expect(depsDrift(dir, base)).toBe(false)
		writeFileSync(join(dir, "bun.lock"), "v2\n")
		expect(depsDrift(dir, base)).toBe(true)
		git(dir, "commit", "-q", "--no-verify", "-am", "lock v2")
		expect(depsDrift(dir, base)).toBe(true)
	})

	test("treeHash covers tracked and untracked file contents under the given paths", () => {
		const dir = repo()
		mkdirSync(join(dir, "h"))
		writeFileSync(join(dir, "h", "x.ts"), "1")
		const before = treeHash(dir, ["h"])
		writeFileSync(join(dir, "h", "x.ts"), "2")
		expect(treeHash(dir, ["h"])).not.toBe(before)
		writeFileSync(join(dir, "a.txt"), "outside")
		const inside = treeHash(dir, ["h"])
		writeFileSync(join(dir, "a.txt"), "outside again")
		expect(treeHash(dir, ["h"])).toBe(inside)
	})

	test("dirHash is stable and depends on every file's path and content", () => {
		const dir = temp()
		mkdirSync(join(dir, "assets"))
		writeFileSync(join(dir, "index.html"), "<p>")
		writeFileSync(join(dir, "assets", "a.js"), "1")
		const first = dirHash(dir)
		expect(dirHash(dir)).toBe(first)
		writeFileSync(join(dir, "assets", "a.js"), "2")
		expect(dirHash(dir)).not.toBe(first)
	})
})
