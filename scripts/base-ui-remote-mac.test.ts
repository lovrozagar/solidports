import { afterEach, describe, expect, test } from "bun:test"
import { spawn, spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FLOCK_SHIM, parseArgs, quote, remoteScript, TIMEOUT_SHIM } from "../packages/base-ui/scripts/remote-mac.mjs"

const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Writes both stand-ins to a temporary bin folder. */
function shims() {
	const dir = mkdtempSync(join(tmpdir(), "remote-mac-"))
	temps.push(dir)
	for (const [name, source] of [
		["flock", FLOCK_SHIM],
		["timeout", TIMEOUT_SHIM],
	]) {
		writeFileSync(join(dir, name), source)
		chmodSync(join(dir, name), 0o755)
	}
	return { dir, lock: join(dir, "heavy.flock") }
}

const tryLock = (dir: string, lock: string, ...flags: string[]) =>
	spawnSync(join(dir, "flock"), [...flags, lock, "true"]).status

describe("remote-mac arguments", () => {
	test("reads the commit, options and the command after --", () => {
		expect(parseArgs(["HEAD", "--timeout", "900", "--fetch", "a.json", "--", "bun", "run", "x"])).toEqual({
			sha: "HEAD",
			timeout: 900,
			fetch: ["a.json"],
			command: ["bun", "run", "x"],
		})
		expect(parseArgs(["abc", "--", "true"]).timeout).toBe(1200)
	})

	test("rejects a missing command, an unknown option and a bad timeout", () => {
		expect(() => parseArgs(["HEAD"])).toThrow("usage")
		expect(() => parseArgs(["HEAD", "--"])).toThrow("usage")
		expect(() => parseArgs(["HEAD", "--retries", "2", "--", "true"])).toThrow("unknown option --retries")
		expect(() => parseArgs(["HEAD", "--timeout", "-1", "--", "true"])).toThrow("positive whole number")
	})

	test("quotes the command so the remote shell runs it word for word", () => {
		expect(quote("it's")).toBe(`'it'\\''s'`)
		const script = remoteScript({ sha: "abc", timeout: 60, command: ["echo", "a b", "$HOME"] })
		expect(script).toContain("flock ~/.gates/heavy.flock timeout -k 30 60 sh -c")
		const run = spawnSync("sh", ["-c", `sh -c ${quote(["echo", "a b", "$HOME"].map(quote).join(" "))}`], {
			encoding: "utf8",
		})
		expect(run.stdout).toBe("a b $HOME\n")
	})
})

describe("macOS stand-ins", () => {
	test("flock excludes a second holder, with -E's exit code, and releases when the holder dies", () => {
		const { dir, lock } = shims()
		// Its own process group: the command inherits the lock, as with flock(1), so the holder is
		// the whole group.
		const holder = spawn(join(dir, "flock"), [lock, "sleep", "30"], { detached: true })
		const deadline = Date.now() + 5000
		while (tryLock(dir, lock, "-n") === 0 && Date.now() < deadline) Bun.sleepSync(20)
		expect(tryLock(dir, lock, "-n")).toBe(1)
		expect(tryLock(dir, lock, "-n", "-E", "75")).toBe(75)
		process.kill(-holder.pid!, "SIGKILL")
		while (tryLock(dir, lock, "-n") !== 0 && Date.now() < deadline + 5000) Bun.sleepSync(20)
		// A holder killed outright leaves no stale lock.
		expect(tryLock(dir, lock, "-n")).toBe(0)
	}, 20_000)

	test.skipIf(!existsSync("/proc/self/fd"))(
		"flock -o keeps the lock out of the command",
		() => {
			const { dir, lock } = shims()
			const holder = spawn(join(dir, "flock"), ["-o", lock, "sleep", "30"], { detached: true })
			const deadline = Date.now() + 5000
			while (tryLock(dir, lock, "-n") === 0 && Date.now() < deadline) Bun.sleepSync(20)
			const holders = readdirSync("/proc")
				.filter((pid) => /^\d+$/.test(pid))
				.filter((pid) => {
					try {
						return readdirSync(`/proc/${pid}/fd`).some((fd) => readlinkSync(`/proc/${pid}/fd/${fd}`) === lock)
					} catch {
						return false
					}
				})
			process.kill(-holder.pid!, "SIGKILL")
			expect(holders).toEqual([String(holder.pid)])
		},
		20_000,
	)

	test("timeout returns the command's code, or kills its process group with 124", () => {
		const { dir } = shims()
		expect(spawnSync(join(dir, "timeout"), ["5", "sh", "-c", "exit 3"]).status).toBe(3)
		const started = Date.now()
		const killed = spawnSync(join(dir, "timeout"), ["-k", "1", "0.5", "sh", "-c", "sleep 30 & sleep 30"], {
			encoding: "utf8",
		})
		expect(killed.status).toBe(124)
		expect(killed.stderr).toContain("killed after 0.5s")
		expect(Date.now() - started).toBeLessThan(10_000)
	}, 20_000)
})
