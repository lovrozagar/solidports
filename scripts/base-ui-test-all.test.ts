import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import {
	changedBrowserTestFiles,
	commandFor,
	dockerUnavailable,
	failureDetail,
	EXCLUSIVE_LOCK,
	planSuites,
	suites,
	vitestIncomplete,
} from "../packages/base-ui/scripts/test-all.mjs"

const BASE_UI = resolve(import.meta.dir, "../packages/base-ui")
const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("test:base-ui:all machine lock", () => {
	test("every suite that launches a browser or binds a fixed port is exclusive, and only those", () => {
		expect(suites.filter((s: { exclusive?: boolean }) => s.exclusive).map((s: { name: string }) => s.name)).toEqual([
			"chromium",
			"parity-firefox",
			"parity-webkit",
			"e2e",
			"regressions",
			"screen-reader",
			"docs-hydration",
			"benchmark",
		])
	})

	test("the lock is the neutral one every repo's gates take, unless GATES_LOCK overrides it", () => {
		expect(EXCLUSIVE_LOCK).toBe(process.env.GATES_LOCK ?? join(process.env.HOME ?? "", ".cache/gates/heavy.lock"))
	})

	test("an exclusive suite's command runs under flock on the lock; others run as written", () => {
		const exclusive = { exclusive: true }
		expect(commandFor({}, "bun run lint")).toBe("bun run lint")
		const wrapped = commandFor(exclusive, "bun run test:e2e:solid", "/tmp/l.lock")
		expect(wrapped).toContain("flock '/tmp/l.lock' timeout -k 30 1200 sh -c 'bun run test:e2e:solid'")
		expect(commandFor({ exclusive: true, timeoutSeconds: 60 }, "x", "/tmp/l.lock")).toContain(
			"timeout -k 30 60 sh -c 'x'",
		)
		expect(wrapped).toContain("flock -n '/tmp/l.lock' true || echo")
		expect(commandFor(exclusive, "echo 'it''s'", "/tmp/l.lock")).toContain(`sh -c 'echo '\\''it'\\'''\\''s'\\'''`)
	})

	test("a failed command names its last step, or the timeout that killed it", () => {
		expect(failureDetail({}, "bun run lint", 1)).toBe("`bun run lint` failed")
		expect(failureDetail({ exclusive: true }, "bun run a\nnode check.mjs", 1)).toBe("`node check.mjs` failed")
		expect(failureDetail({ exclusive: true, timeoutSeconds: 60 }, "bun run a\nnode check.mjs", 124)).toBe(
			"timed out after 60 s",
		)
		expect(failureDetail({}, "bun run lint", 124)).toBe("`bun run lint` failed")
	})

	test("two exclusive commands on one lock never overlap", async () => {
		const dir = mkdtempSync(join(tmpdir(), "gates-lock-"))
		temps.push(dir)
		const lock = join(dir, "heavy.lock")
		const log = join(dir, "log")
		const job = (name: string) =>
			Bun.spawn(
				[
					"sh",
					"-c",
					commandFor({ exclusive: true }, `echo ${name} start >> ${log}; sleep 0.3; echo ${name} end >> ${log}`, lock),
				],
				{
					stdout: "ignore",
				},
			)
		const a = job("a")
		const b = job("b")
		await Promise.all([a.exited, b.exited])
		const lines = readFileSync(log, "utf8").trim().split("\n")
		expect(lines.map((l) => l.split(" ")[1])).toEqual(["start", "end", "start", "end"])
		expect(lines[0].split(" ")[0]).toBe(lines[1].split(" ")[0])
	})

	test("a hung exclusive command is killed at its timeout and the lock is free again", async () => {
		const dir = mkdtempSync(join(tmpdir(), "gates-lock-"))
		temps.push(dir)
		const lock = join(dir, "heavy.lock")
		const started = Date.now()
		const hung = Bun.spawn(["sh", "-c", commandFor({ exclusive: true, timeoutSeconds: 1 }, "sleep 30", lock)], {
			stdout: "ignore",
		})
		const code = await hung.exited
		expect(code).not.toBe(0)
		expect(Date.now() - started).toBeLessThan(10_000)
		const probe = Bun.spawnSync(["flock", "-n", lock, "true"])
		expect(probe.exitCode).toBe(0)
	})

	test("the measured benchmark gets an hour, WebKit parity its measured step time; every other exclusive suite the default 20 minutes", () => {
		const timeouts = Object.fromEntries(
			suites
				.filter((s: { exclusive?: boolean }) => s.exclusive)
				.map((s: { name: string; timeoutSeconds?: number }) => [s.name, s.timeoutSeconds]),
		)
		expect(timeouts.benchmark).toBe(3600)
		expect(timeouts["parity-webkit"]).toBeNumber()
		expect(
			Object.entries(timeouts).filter(([name, t]) => !["benchmark", "parity-webkit"].includes(name) && t !== undefined),
		).toEqual([])
	})

	test("the vitest browser servers stay on one address, and the Solid project binds its port strictly", async () => {
		process.env.VITEST_ENV = "chromium"
		const { default: shared } = await import(`../packages/base-ui/vitest.shared.mts?strict=${Date.now()}`)
		const { default: solid } = await import(`../packages/base-ui/packages/solid/vitest.config.mts?strict=${Date.now()}`)
		delete process.env.VITEST_ENV
		// Upstream's run starts two browser projects (react, utils): the second takes the next port.
		expect(shared.test.browser.api).toEqual({ host: "127.0.0.1", port: 63315 })
		// The Solid project is alone in its run: a taken port fails it.
		expect(solid.test.browser.api).toEqual({ host: "127.0.0.1", port: 63315, strictPort: true })
	})
})

describe("test:base-ui:all on a machine without pnpm", () => {
	test("reports error-codes as not run instead of failing it", () => {
		const module = join(import.meta.dir, "../packages/base-ui/scripts/test-all.mjs")
		const probe = `const m = await import(${JSON.stringify(module)}); console.log(String(m.suites.find((s) => s.name === "error-codes").unavailable))`
		const read = (path: string) =>
			Bun.spawnSync([process.execPath, "-e", probe], { env: { ...process.env, PATH: path } })
				.stdout.toString()
				.trim()
		// Only the runtime's own folder and the system tools: no pnpm.
		expect(read(`${dirname(process.execPath)}:/usr/bin:/bin`)).toBe(
			"needs pnpm (code-infra lists the workspace with it)",
		)
		expect(read(process.env.PATH ?? "")).toBe(
			Bun.which("pnpm") ? "null" : "needs pnpm (code-infra lists the workspace with it)",
		)
	})
})

describe("test:base-ui:all generated Solid docs", () => {
	// docs/solid is generated from docs/react; nothing re-ran the generator, so its error codes
	// went stale for two commits without failing a gate.
	test("a suite regenerates docs/solid and fails when that changes the tree, as the workflow does", () => {
		const suite = suites.find((s: { name: string }) => s.name === "docs-generate") as
			| { job: string; generated?: string[]; run: string[] }
			| undefined
		expect(suite).toBeDefined()
		expect(suite?.job).toBe("Generated files")
		expect(suite?.generated).toEqual(["packages/base-ui/docs/solid"])
		expect(suite?.run).toEqual(["bun run docs:generate"])
		const workflow = readFileSync(resolve(import.meta.dir, "../.github/workflows/base-ui-tests.yml"), "utf8")
		expect(workflow).toMatch(/bun run docs:generate\n\s+git diff --exit-code -- docs\/solid/)
	})
})

// A vitest run that ends early can still exit 0: the browser lost its iframe, or the run was cut,
// and the files after it never ran. The suite then reports incomplete, never passed.
describe("test:base-ui:all vitest completeness", () => {
	test("a run that reached every file is complete", () => {
		expect(vitestIncomplete(" Test Files  477 passed | 9 skipped (486)\n      Tests  10511 passed")).toBe(undefined)
		expect(vitestIncomplete("Test Files  1 failed | 475 passed | 9 skipped | 1 todo (486)")).toBe(undefined)
	})

	test("a run that ended before its last file is incomplete", () => {
		expect(vitestIncomplete(" Test Files  8 failed | 34 passed (485)")).toBe("ran 42 of 485 test files")
		expect(vitestIncomplete("\u001b[2m Test Files \u001b[22m \u001b[32m34 passed\u001b[39m (485)")).toBe(
			"ran 34 of 485 test files",
		)
	})

	test("every run in the log is checked, and a log without a summary is incomplete", () => {
		expect(vitestIncomplete("Test Files  3 passed (3)\nTest Files  2 passed (9)")).toBe("ran 2 of 9 test files")
		expect(vitestIncomplete("error: script exited")).toBe("no vitest summary in the log")
	})

	// `--changed` runs pass with no tests when no test file depends on the range (a scripts-only
	// change): vitest then prints no summary, and the run is complete.
	test("a run with no related tests is complete only where the suite passes with no tests", () => {
		const log = "\nNo test files found, exiting with code 0\n\nprojects: @solidports/base-ui\n"
		expect(vitestIncomplete(log, { passWithNoTests: true })).toBe(undefined)
		expect(vitestIncomplete(log)).toBe("no vitest summary in the log")
		expect(vitestIncomplete("error: script exited", { passWithNoTests: true })).toBe("no vitest summary in the log")
	})

	test("a --changed vitest suite passes with no tests", () => {
		const changed = planSuites({ changed: "main", only: null, fullBench: false }).filter((suite) => suite.vitest)
		expect(changed.every((suite) => suite.run.every((command) => command.includes("--passWithNoTests")))).toBe(true)
	})

	test("the vitest suites are checked", () => {
		expect(suites.filter((suite) => suite.vitest).map((suite) => suite.name)).toEqual(["jsdom", "chromium"])
	})
})

// A CI step no suite runs falls outside the local gate without a sound: four pushes failed CI that
// way (eslint, docs-generate, vale, error codes). Every command of the "Base UI tests" workflow is a
// suite's command in the step's directory, and `--changed` runs that suite or names why it leaves
// it to a full run.
describe("test:base-ui:all covers CI's Base UI workflows", () => {
	type Step = { run?: string; "working-directory"?: string }
	type Workflow = { jobs: Record<string, { steps: Step[] }> }
	const read = (name: string) =>
		Bun.YAML.parse(readFileSync(resolve(import.meta.dir, `../.github/workflows/${name}`), "utf8")) as Workflow
	// The runner's setup and the workflow's own tree checks (`generated` covers the latter).
	const SETUP = [
		/^bun install --frozen-lockfile$/,
		/^bunx playwright install --with-deps /,
		/^npm install --global pnpm@/,
		/^git checkout -- \.$/,
		/^git diff --exit-code( -- .+)?$/,
	]
	const planned = planSuites({ changed: "main" })

	test("every workflow command is a suite's command, run or named by --changed", () => {
		const uncovered: string[] = []
		const unscoped: string[] = []
		for (const [job, { steps }] of Object.entries(read("base-ui-tests.yml").jobs)) {
			for (const step of steps) {
				const cwd = step["working-directory"] ?? "."
				const lines = (step.run ?? "").split("\n").map((line) => line.trim())
				for (const line of lines.filter((l) => l !== "" && !SETUP.some((setup) => setup.test(l)))) {
					const suite = planned.find(
						(candidate) => candidate.cwd === cwd && suites.find((s) => s.name === candidate.name)?.run.includes(line),
					)
					if (!suite) {
						uncovered.push(`${job}: ${cwd}$ ${line}`)
					} else if (!suite.selected && typeof suite.fullOnly !== "string") {
						unscoped.push(`${job}: ${suite.name}`)
					}
				}
			}
		}
		expect(uncovered).toEqual([])
		expect(unscoped).toEqual([])
	})

	test("the parity suites are the browsers the parity workflow runs on a push", () => {
		const workflow = readFileSync(resolve(import.meta.dir, "../.github/workflows/base-ui-browser-parity.yml"), "utf8")
		expect(workflow).toContain(`github.event_name == 'push' && '["firefox","webkit"]'`)
		expect(suites.filter((s) => s.job === "Browser parity").map((s) => s.name)).toEqual([
			"parity-firefox",
			"parity-webkit",
		])
	})
})

// `--changed` runs browser parity on the Solid test files the range changed, and on the test files
// beside any library file it changed: a library change can break a cross-browser test it did not
// touch. Paths are relative to packages/base-ui, as the parity suites run there.
describe("the browser test files a range changed", () => {
	const SOLID = "packages/base-ui/packages/solid/src"
	const disk = new Set([
		"packages/solid/src/a/A.test.tsx",
		"packages/react/src/a/A.test.tsx",
		"packages/solid/src/b/B.test.tsx",
		"packages/solid/src/b/BSolidOnly.test.tsx",
		"packages/react/src/b/B.test.tsx",
		"packages/solid/src/c/C.test.ts",
	])
	const exists = (file: string) => disk.has(file)
	const listDir = (dir: string) =>
		[...disk].filter((file) => file.startsWith(`${dir}/`) && !file.slice(dir.length + 1).includes("/"))

	test("keeps a changed Solid test file that exists, with its upstream counterpart", () => {
		expect(changedBrowserTestFiles([`${SOLID}/a/A.test.tsx`], exists, listDir).files).toEqual([
			"packages/react/src/a/A.test.tsx",
			"packages/solid/src/a/A.test.tsx",
		])
	})

	test("drops deleted test files, packages/solid/test and files outside the Solid sources", () => {
		const names = [
			`${SOLID}/gone/Gone.test.tsx`,
			"packages/base-ui/packages/solid/test/pointerIsolation.test.tsx",
			"packages/base-ui/scripts/test-all.mjs",
			"packages/base-ui/packages/react/src/a/A.test.tsx",
			"README.md",
		]
		expect(changedBrowserTestFiles(names, exists, listDir).files).toEqual([])
	})

	test("adds the test files beside a changed library file, and maps only those upstream has", () => {
		const { files } = changedBrowserTestFiles([`${SOLID}/b/B.tsx`, `${SOLID}/c/c.ts`], exists, listDir)
		expect(files).toEqual([
			"packages/react/src/b/B.test.tsx",
			"packages/solid/src/b/B.test.tsx",
			"packages/solid/src/b/BSolidOnly.test.tsx",
			"packages/solid/src/c/C.test.ts",
		])
	})

	test("counts the Solid files once each and flags a selection over 40", () => {
		const many = new Set(Array.from({ length: 41 }, (_, i) => `packages/solid/src/m/M${i}.test.tsx`))
		const result = changedBrowserTestFiles(
			[`${SOLID}/m/index.ts`, `${SOLID}/m/M0.test.tsx`],
			(file) => many.has(file),
			(dir) => [...many].filter((file) => file.startsWith(`${dir}/`)),
		)
		expect(result.solidCount).toBe(41)
		expect(result.overBudget).toBe(true)
		expect(changedBrowserTestFiles([`${SOLID}/a/A.test.tsx`], exists, listDir).overBudget).toBe(false)
	})
})

// The scoped parity suites under `--changed`: both suites on the selected files only, the coverage
// check limited to them, and WebKit through Playwright's Docker image (local WebKit lacks the host's
// libraries). A full run keeps the whole-suite parity.

/** The planned parity suite for `browser`. */
const parity = (planned: ReturnType<typeof planSuites>, browser: string) =>
	planned.find((suite) => suite.name === `parity-${browser}`)!
/** The steps of a scoped parity suite's one command. */
const steps = (suite: ReturnType<typeof parity>) => suite.run.flatMap((command) => command.split("\n"))

describe("scoped browser parity under --changed", () => {
	const browserTests = {
		files: [
			"packages/react/src/a/A.test.tsx",
			"packages/solid/src/a/A.test.tsx",
			"packages/solid/src/b/BSolid.test.tsx",
		],
		solidCount: 2,
		overBudget: false,
	}
	const plan = (extra: Record<string, unknown> = {}) =>
		planSuites({ changed: "main", only: null, fullBench: false, browserTests, dockerUnavailable: null, ...extra })

	test("selects both parity suites with the changed files as exact filters", () => {
		for (const browser of ["firefox", "webkit"]) {
			const suite = parity(plan(), browser)
			expect(suite.selected).toBe(true)
			const react = steps(suite).find(
				(command) => command.includes(`react-${browser}.json`) && !command.startsWith("node"),
			)!
			const solid = steps(suite).find(
				(command) => command.includes(`solid-${browser}.json`) && !command.startsWith("node"),
			)!
			expect(react).toContain("'packages/react/src/a/A.test.tsx'")
			expect(react).not.toContain("packages/solid/src")
			expect(solid).toContain("'packages/solid/src/a/A.test.tsx'")
			expect(solid).toContain("'packages/solid/src/b/BSolid.test.tsx'")
			const check = steps(suite).at(-1)!
			expect(check).toContain(`--confirm ${browser}`)
			expect(check).toContain("--files")
		}
	})

	test("queues for the heavy lock once: the steps form one command", () => {
		for (const browser of ["firefox", "webkit"]) {
			const suite = parity(plan(), browser)
			expect(suite.run).toHaveLength(1)
			expect(commandFor(suite, suite.run[0], "/tmp/l.lock").match(/flock '\/tmp\/l\.lock' timeout/g)).toHaveLength(1)
		}
	})

	test("runs Firefox locally and WebKit, with its reruns, in the Docker image", () => {
		expect(parity(plan(), "firefox").run.join("\n")).not.toContain("webkit-docker.sh")
		const webkit = steps(parity(plan(), "webkit"))
		expect(webkit.filter((command) => command.includes("bash scripts/webkit-docker.sh"))).toHaveLength(2)
		expect(webkit.at(-1)).toContain("PARITY_RUNNER=scripts/webkit-docker.sh")
	})

	test("an upstream with none of the files gets an empty report instead of a whole-suite run", () => {
		const solidOnly = { files: ["packages/solid/src/b/BSolid.test.tsx"], solidCount: 1, overBudget: false }
		const firefox = steps(parity(plan({ browserTests: solidOnly }), "firefox"))
		expect(firefox.join("\n")).not.toContain("bun run test:firefox")
		expect(
			firefox.some((command) => command.includes('{"testResults":[]}') && command.includes("react-firefox.json")),
		).toBe(true)
	})

	test("passes both with a note when the range changed no browser test file", () => {
		const none = { files: [], solidCount: 0, overBudget: false }
		for (const browser of ["firefox", "webkit"]) {
			const suite = parity(plan({ browserTests: none }), browser)
			expect(suite.selected).toBe(true)
			expect(suite.run).toEqual([])
			expect(suite.note).toBe("no browser test file changed")
		}
	})

	test("reports the count, flagged over the budget, and still runs every file", () => {
		expect(parity(plan(), "firefox").note).toBe("2 Solid test files")
		const many = { ...browserTests, solidCount: 41, overBudget: true }
		const suite = parity(plan({ browserTests: many }), "firefox")
		expect(suite.note).toBe("41 Solid test files, over the 40-file budget")
		expect(suite.run.length).toBeGreaterThan(0)
	})

	test("WebKit without Docker is not run, which fails --changed", () => {
		const suite = parity(plan({ dockerUnavailable: "Docker is not available for WebKit" }), "webkit")
		expect(suite.selected).toBe(true)
		expect(suite.unavailable).toBe("Docker is not available for WebKit")
	})

	test("a full run keeps the whole-suite parity", () => {
		for (const browser of ["firefox", "webkit"]) {
			const suite = parity(
				planSuites({ changed: null, only: null, fullBench: false, dockerUnavailable: null }),
				browser,
			)
			expect(suite.run).toEqual(suites.find((s) => s.name === `parity-${browser}`)!.run)
		}
	})
})

// A full run's WebKit parity runs both whole suites, and its confirm reruns, in Playwright's Docker
// image too: the host's WebKit lacks its libraries on this machine, so a host run measured nothing.
describe("full browser parity", () => {
	const full = (extra: Record<string, unknown> = {}) =>
		planSuites({ changed: null, only: null, fullBench: false, dockerUnavailable: null, ...extra })

	test("runs WebKit's whole suites and its reruns in the Docker image, and Firefox locally", () => {
		const webkit = parity(full(), "webkit").run
		expect(webkit.filter((command) => command.startsWith("bash scripts/webkit-docker.sh"))).toEqual([
			'bash scripts/webkit-docker.sh test:webkit "$TEST_ALL_RUN_DIR/react-webkit.json" || true',
			'bash scripts/webkit-docker.sh test:solid:webkit "$TEST_ALL_RUN_DIR/solid-webkit.json" || true',
		])
		expect(webkit.join("\n")).not.toContain("bun run test:webkit")
		expect(webkit.at(-1)).toStartWith("PARITY_RUNNER=scripts/webkit-docker.sh node scripts/browser-parity.mjs")
		expect(parity(full(), "firefox").run.join("\n")).not.toContain("webkit-docker.sh")
	})

	test("WebKit without Docker is not run, with the probe's reason", () => {
		const reason = "Docker permission: re-login or newgrp docker"
		const suite = parity(full({ dockerUnavailable: reason }), "webkit")
		expect(suite.selected).toBe(true)
		expect(suite.unavailable).toBe(reason)
		expect(parity(full({ dockerUnavailable: reason }), "firefox").unavailable).toBeUndefined()
	})

	test("a WebKit run bounds each step by its own timeout", () => {
		const timeout = parity(full(), "webkit").timeoutSeconds
		expect(timeout).toBeNumber()
		expect(commandFor(parity(full(), "webkit"), "x", "/tmp/l.lock")).toContain(`timeout -k 30 ${timeout} `)
	})
})

// Why Docker cannot run WebKit, from `docker info`: before a re-login adds the docker group, the
// socket exists but refuses this user, which a re-login or `newgrp docker` fixes.
describe("the Docker probe", () => {
	const permission = "permission denied while trying to connect to the docker API at unix:///var/run/docker.sock"

	test("passes when docker info succeeds", () => {
		expect(dockerUnavailable({ status: 0, stderr: "" }, true)).toBeNull()
	})

	test("names the permission when the socket exists but refuses the user", () => {
		expect(dockerUnavailable({ status: 1, stderr: permission }, true)).toBe(
			"Docker permission: re-login or newgrp docker",
		)
	})

	test("reports Docker unavailable otherwise", () => {
		const unavailable = "Docker is not available for WebKit"
		expect(dockerUnavailable({ status: 1, stderr: permission }, false)).toBe(unavailable)
		expect(dockerUnavailable({ status: 1, stderr: "Cannot connect to the Docker daemon" }, true)).toBe(unavailable)
		expect(dockerUnavailable({ status: null, error: new Error("spawnSync docker ENOENT"), stderr: "" }, false)).toBe(
			unavailable,
		)
	})
})
