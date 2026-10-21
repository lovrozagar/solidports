import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	baseArchivePaths,
	baselineBlockers,
	costPattern,
	costPlan,
	depsDrift,
	dirHash,
	extractBase,
	gitProvenance,
	lockedCommand,
	benchTimeoutSeconds,
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
// The tests build throwaway repos and run git in them. Git's hook variables (`GIT_DIR`,
// `GIT_INDEX_FILE` and the rest) would point every such command at the repo that runs the suite: a
// pre-push hook once committed and configured into it this way. Each command gets an environment
// without them.
const withoutGitVariables = () =>
	Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")))
const git = (cwd: string, ...args: string[]) => {
	const run = Bun.spawnSync(["git", ...args], { cwd, env: withoutGitVariables(), stdout: "pipe", stderr: "pipe" })
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
	test("parseArgs reads a CPU throttle for the SSR runs (D29: the daily regate's 4x set)", () => {
		expect(parseArgs(["menu", "--cpu-throttle", "4"]).cpuThrottle).toBe(4)
		expect(() => parseArgs(["menu", "--cpu-throttle", "0.5"])).toThrow("--cpu-throttle")
	})

	test("parseArgs reads names, runs, an extra filter, and the baseline flags", () => {
		expect(parseArgs(["collapsible,accordion", "--runs", "4", "--filter", "!tag:raw", "--compare", "b0"])).toEqual({
			names: ["collapsible", "accordion"],
			runs: 4,
			ssrRuns: 20,
			filter: "!tag:raw",
			saveBaseline: null,
			at: null,
			compare: "b0",
			cpuThrottle: 1,
			scoped: false,
		})
		expect(() => parseArgs([])).toThrow("bench:component <name>[,...]|all")
		expect(() => parseArgs(["button", "--save-baseline", "b0", "--compare", "b0"])).toThrow(
			"--save-baseline and --compare",
		)
	})

	test("--at names the commit a baseline measures, and only with --save-baseline", () => {
		expect(parseArgs(["accordion", "--save-baseline", "b0", "--at", "d2164d9d"])).toMatchObject({
			saveBaseline: "b0",
			at: "d2164d9d",
		})
		expect(() => parseArgs(["accordion", "--at", "d2164d9d"])).toThrow("pass it with --save-baseline")
	})

	test("a baseline records exit-bar misses as targets; every other failure blocks it", () => {
		const bar = "exit bar: collapsible/300 serverMs 1.94 ms is 1.53x the floor and 0.55x React"
		expect(baselineBlockers([bar])).toEqual([])
		expect(baselineBlockers([bar, "ssr: accordion/300 [solid] hydration mismatch", "cost: x: failed"])).toEqual([
			"ssr: accordion/300 [solid] hydration mismatch",
			"cost: x: failed",
		])
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

	test("browser and SSR runs take the machine lock with a timeout, so a hang can never hold it", () => {
		expect(lockedCommand("node", ["run.mjs", "8"], { lock: "/l.lock", timeoutSeconds: 1200 })).toEqual([
			"flock",
			["/l.lock", "timeout", "-k", "30", "1200", "node", "run.mjs", "8"],
		])
	})

	test("a bench's timeout scales with its work, so every family at 12 runs is not cut off at 20 minutes", () => {
		// The browser bench: 600 s a family at 12 runs. Every family once timed out at the 1200 s
		// gate timeout and saved no baseline.
		expect(benchTimeoutSeconds(42 * 12, 50)).toBe(25200)
		expect(benchTimeoutSeconds(1 * 12, 50)).toBe(1200)
		// SSR: 10 s a case and run.
		expect(benchTimeoutSeconds(16 * 20, 10)).toBe(3200)
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

	test("reads the repo it is given even when git's hook variables point elsewhere", () => {
		// A process started under a git hook inherits GIT_DIR: run the driver's code in one.
		const dir = repo()
		const canary = repo()
		// Its own history: two repos built alike share their SHAs.
		git(canary, "commit", "-q", "--no-verify", "--allow-empty", "-m", "canary")
		const canaryHead = git(canary, "rev-parse", "HEAD")
		const driver = join(import.meta.dir, "../packages/base-ui/scripts/bench-component.mjs")
		const run = Bun.spawnSync(
			[
				"bun",
				"-e",
				`const m = await import(${JSON.stringify(driver)}); console.log(m.gitProvenance(${JSON.stringify(dir)}).sha)`,
			],
			{ env: { ...withoutGitVariables(), GIT_DIR: join(canary, ".git") }, stdout: "pipe", stderr: "pipe" },
		)
		expect(run.stderr.toString()).toBe("")
		expect(run.stdout.toString().trim()).toBe(git(dir, "rev-parse", "HEAD"))
		expect(git(canary, "rev-parse", "HEAD")).toBe(canaryHead)
	})
})

describe("baseline archive", () => {
	const root = join(import.meta.dir, "..")
	const baseUi = join(root, "packages/base-ui")

	test("holds the whole Solid package and every config its tsconfig extends chain reaches outside it", () => {
		const dir = repo()
		const pkg = join(dir, "packages/base-ui/packages/solid")
		mkdirSync(join(pkg, "src"), { recursive: true })
		mkdirSync(join(dir, "configs"), { recursive: true })
		writeFileSync(join(pkg, "src/index.ts"), "export {}\n")
		// JSONC, as TypeScript reads it: a comment and a trailing comma.
		writeFileSync(
			join(pkg, "tsconfig.json"),
			'{\n  // the package config\n  "extends": "../../tsconfig.base.json",\n}\n',
		)
		writeFileSync(join(pkg, "tsconfig.build.json"), '{ "extends": ["./tsconfig.json", "@tsconfig/strictest"] }\n')
		writeFileSync(join(dir, "packages/base-ui/tsconfig.base.json"), '{ "extends": "../../configs/root" }\n')
		writeFileSync(join(dir, "configs/root.json"), "{}\n")
		writeFileSync(join(dir, "configs/unused.json"), "{}\n")
		git(dir, "add", ".")
		git(dir, "commit", "-q", "--no-verify", "-m", "package")
		expect(baseArchivePaths(dir, git(dir, "rev-parse", "HEAD"))).toEqual([
			"configs/root.json",
			"packages/base-ui/packages/solid",
			"packages/base-ui/tsconfig.base.json",
		])
	})

	test("a commit built from its archive bundles byte for byte like the same tree checked out", () => {
		// D30: a baseline built from `src` alone lost the tsconfig chain (no inlined enums) and the
		// package's `sideEffects: false` (no tree shaking), so base and cur bundles of one commit
		// differed. The commit holds the working tree's content, written through a scratch index:
		// objects only, no ref or index of the repo changes.
		const env = {
			...withoutGitVariables(),
			GIT_INDEX_FILE: join(temp(), "index"),
			GIT_AUTHOR_NAME: "bench",
			GIT_AUTHOR_EMAIL: "bench@test",
			GIT_COMMITTER_NAME: "bench",
			GIT_COMMITTER_EMAIL: "bench@test",
		}
		const gitIn = (...args: string[]) => {
			const run = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe" })
			if (run.exitCode !== 0) throw new Error(run.stderr.toString())
			return run.stdout.toString().trim()
		}
		gitIn("read-tree", "HEAD")
		gitIn("add", "-A")
		const commit = gitIn("commit-tree", gitIn("write-tree"), "-p", "HEAD", "-m", "archive test")
		const tag = `archive-test-${process.pid}`
		const src = join(root, ".tmp/grunt/bench-src", tag)
		const outputs = [`solid/${tag}-archive`, `solid/${tag}-tree`, `ssr-${tag}-archive`, `ssr-${tag}-tree`].map((out) =>
			join(root, ".tmp/grunt/bench-builds", out),
		)
		const bundle = (command: string[], extra: Record<string, string>) => {
			const run = Bun.spawnSync(command, {
				cwd: baseUi,
				env: { ...withoutGitVariables(), ...extra },
				stdout: "pipe",
				stderr: "pipe",
			})
			if (run.exitCode !== 0) throw new Error(`${command.join(" ")}: ${run.stderr.toString()}`)
		}
		try {
			const srcRoot = extractBase(root, commit, src)
			const vite = ["bun", "x", "vite", "build", "-c", "test/perf-solid/vite.config.mjs"]
			bundle(vite, { LIB: "solid", SOLID_SRC: srcRoot, OUT: `${tag}-archive` })
			bundle(vite, { LIB: "solid", OUT: `${tag}-tree` })
			bundle(["node", "test/perf-solid/ssr/run.mjs"], {
				BUILD_ONLY: "1",
				SSR_VARIANTS: `archive:solid:${srcRoot}:ssr-${tag}-archive,tree:solid::ssr-${tag}-tree`,
			})
			const [browserArchive, browserTree, ssrArchive, ssrTree] = outputs.map(dirHash)
			expect(browserArchive).toBe(browserTree)
			expect(ssrArchive).toBe(ssrTree)
		} finally {
			for (const dir of [src, ...outputs]) rmSync(dir, { recursive: true, force: true })
		}
	}, 600_000)
})
