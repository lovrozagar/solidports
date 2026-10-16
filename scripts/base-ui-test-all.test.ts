import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { commandFor, EXCLUSIVE_LOCK, suites } from "../packages/base-ui/scripts/test-all.mjs"

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

	test("the lock is the one flare's gates take, unless GATES_LOCK overrides it", () => {
		expect(EXCLUSIVE_LOCK).toBe(process.env.GATES_LOCK ?? join(process.env.HOME ?? "", ".cache/flare-gates/heavy.lock"))
	})

	test("an exclusive suite's command runs under flock on the lock; others run as written", () => {
		const exclusive = { exclusive: true }
		expect(commandFor({}, "bun run lint")).toBe("bun run lint")
		const wrapped = commandFor(exclusive, "bun run test:e2e:solid", "/tmp/l.lock")
		expect(wrapped).toContain("flock '/tmp/l.lock' sh -c 'bun run test:e2e:solid'")
		expect(wrapped).toContain("flock -n '/tmp/l.lock' true || echo")
		expect(commandFor(exclusive, "echo 'it''s'", "/tmp/l.lock")).toContain(`sh -c 'echo '\\''it'\\'''\\''s'\\'''`)
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

	test("every fixed-port serve script checks its port first, since serve 14 switches ports regardless of --no-port-switching", () => {
		const scripts: Record<string, string> = JSON.parse(readFileSync(join(BASE_UI, "package.json"), "utf8")).scripts
		const unguarded = Object.entries(scripts)
			.filter(([, command]) => {
				const port = command.match(/\bserve\b.* -p (\d+)/)?.[1]
				return port && !command.startsWith(`node scripts/assert-port-free.mjs ${port} && `)
			})
			.map(([name]) => name)
		expect(unguarded).toEqual([])
	})

	test("assert-port-free fails naming a taken port and passes a free one", async () => {
		const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } })
		const check = (port: number) =>
			Bun.spawnSync(["node", "scripts/assert-port-free.mjs", String(port)], { cwd: BASE_UI, stderr: "pipe" })
		const taken = check(server.port)
		expect({ code: taken.exitCode, err: taken.stderr.toString().trim() }).toEqual({
			code: 1,
			err: `port ${server.port} is taken (127.0.0.1 answers); stop that server or wait for it, then rerun`,
		})
		const port = server.port
		server.stop(true)
		expect(check(port).exitCode).toBe(0)
	})

	test("the vitest browser server binds its port strictly", async () => {
		process.env.VITEST_ENV = "chromium"
		const { default: config } = await import(`../packages/base-ui/vitest.shared.mts?strict=${Date.now()}`)
		delete process.env.VITEST_ENV
		expect(config.test.browser.api).toEqual({ host: "127.0.0.1", port: 63315, strictPort: true })
	})
})
