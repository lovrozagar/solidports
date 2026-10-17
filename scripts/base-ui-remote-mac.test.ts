import { afterEach, describe, expect, test } from "bun:test"
import { spawn, spawnSync } from "node:child_process"
import {
	chmodSync,
	closeSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	FLOCK_SHIM,
	lockedRun,
	parseArgs,
	quote,
	remoteScript,
	TIMEOUT_SHIM,
} from "../packages/base-ui/scripts/remote-mac.mjs"

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

/** Whether process `pid` is alive. */
const alive = (pid: number) => {
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

/** Waits up to `ms` for `check` to hold. */
function waitFor(check: () => boolean, ms = 10_000) {
	const deadline = Date.now() + ms
	while (!check() && Date.now() < deadline) Bun.sleepSync(50)
	return check()
}

/** Starts `bin/<shim> ...args` running `sh` that records its own pid, and returns both pids. */
function startRecording(dir: string, shimArgs: string[]) {
	const pidFile = join(dir, "command.pid")
	const shim = spawn(join(dir, shimArgs[0]), [...shimArgs.slice(1), "sh", "-c", `echo $$ > ${pidFile}; exec sleep 30`])
	expect(waitFor(() => Bun.file(pidFile).size > 0)).toBe(true)
	return { shim, command: Number(readFileSync(pidFile, "utf8").trim()) }
}

describe("stopping a Mac run", () => {
	test("TERM to the timeout stand-in ends its command", () => {
		const { dir } = shims()
		const { shim, command } = startRecording(dir, ["timeout", "-k", "1", "60"])
		shim.kill("SIGTERM")
		expect(waitFor(() => !alive(command))).toBe(true)
	}, 20_000)

	test("TERM to the flock stand-in reaches its command", () => {
		const { dir, lock } = shims()
		const { shim, command } = startRecording(dir, ["flock", lock])
		shim.kill("SIGTERM")
		expect(waitFor(() => !alive(command))).toBe(true)
	}, 20_000)

	test("a locked run runs heavy suites one at a time unless the caller sets GATES_HEAVY", async () => {
		const { dir } = shims()
		const home = join(dir, "home")
		mkdirSync(join(home, ".gates"), { recursive: true })
		const seen = async (heavy: string | undefined) => {
			const out = join(dir, `heavy-${heavy ?? "default"}`)
			const env: Record<string, string | undefined> = { ...process.env, HOME: home, PATH: `${dir}:${process.env.PATH}` }
			delete env.GATES_HEAVY
			if (heavy !== undefined) env.GATES_HEAVY = heavy
			const run = Bun.spawn(["bash", "-c", lockedRun(60, ["sh", "-c", `echo "$GATES_HEAVY" > ${out}`])], {
				env,
				stdout: "ignore",
				stderr: "ignore",
			})
			expect(await run.exited).toBe(0)
			return readFileSync(out, "utf8").trim()
		}
		// On the Mac, jsdom beside a browser suite took 922 s and timed out a cold import test;
		// one after the other they took 527 s together.
		expect(await seen(undefined)).toBe("1")
		expect(await seen("2")).toBe("2")
	}, 30_000)

	test("a locked run ends when the machine that started it stops refreshing its heartbeat", async () => {
		// Stopping the local driver left the Mac's sshd session (the watched parent) alive for 48
		// minutes, holding the lock: with no tty, sshd notices a vanished client only when it next
		// forwards output, and a run prints little. The heartbeat file stops being refreshed instead.
		const { dir } = shims()
		const home = join(dir, "home")
		mkdirSync(join(home, ".gates"), { recursive: true })
		const session = Bun.spawn(["sleep", "60"])
		const heartbeat = join(dir, "heartbeat")
		writeFileSync(heartbeat, "")
		const pidFile = join(dir, "command.pid")
		const run = Bun.spawn(["bash", "-c", lockedRun(60, ["sh", "-c", `echo $$ > ${pidFile}; exec sleep 30`])], {
			env: {
				...process.env,
				HOME: home,
				PATH: `${dir}:${process.env.PATH}`,
				REMOTE_MAC_WATCH: String(session.pid),
				REMOTE_MAC_HEARTBEAT: heartbeat,
				REMOTE_MAC_STALE: "2",
			},
			stdout: "ignore",
			stderr: "ignore",
		})
		expect(waitFor(() => Bun.file(pidFile).size > 0)).toBe(true)
		const command = Number(readFileSync(pidFile, "utf8").trim())
		// Refreshed, the run goes on.
		for (let beat = 0; beat < 3; beat += 1) {
			writeFileSync(heartbeat, String(beat))
			await Bun.sleep(1000)
		}
		expect(alive(command)).toBe(true)
		// No longer refreshed: the run stops while its session is still alive.
		expect(waitFor(() => !alive(command), 10_000)).toBe(true)
		expect(alive(session.pid)).toBe(true)
		expect(await run.exited).toBe(143)
		// The run removes its own heartbeat file: a driver stopped by force never does.
		expect(existsSync(heartbeat)).toBe(false)
		session.kill()
	}, 30_000)

	test("a locked run ends even when its stderr's reader is gone, as when sshd has exited", async () => {
		// The watcher reported before it killed: with sshd gone, the report raised SIGPIPE and killed
		// the watcher, and the run went on holding the Mac's lock.
		const { dir } = shims()
		const home = join(dir, "home")
		mkdirSync(join(home, ".gates"), { recursive: true })
		const session = Bun.spawn(["sleep", "60"])
		const heartbeat = join(dir, "heartbeat")
		writeFileSync(heartbeat, "")
		const fifo = join(dir, "stderr.fifo")
		expect(spawnSync("mkfifo", [fifo]).status).toBe(0)
		const pidFile = join(dir, "command.pid")
		const script = lockedRun(60, ["sh", "-c", `echo $$ > ${pidFile}; exec sleep 30`])
		const run = Bun.spawn(["bash", "-c", `exec 2>${quote(fifo)}\n${script}`], {
			env: {
				...process.env,
				HOME: home,
				PATH: `${dir}:${process.env.PATH}`,
				REMOTE_MAC_WATCH: String(session.pid),
				REMOTE_MAC_HEARTBEAT: heartbeat,
				REMOTE_MAC_STALE: "2",
			},
			stdout: "ignore",
		})
		// Open the reader so the run starts, then close it: every later write to stderr fails.
		const reader = openSync(fifo, "r")
		expect(waitFor(() => Bun.file(pidFile).size > 0)).toBe(true)
		closeSync(reader)
		const command = Number(readFileSync(pidFile, "utf8").trim())
		expect(waitFor(() => !alive(command), 10_000)).toBe(true)
		await run.exited
		session.kill()
	}, 30_000)

	test("a locked run ends when the session that started it goes away", async () => {
		const { dir } = shims()
		const home = join(dir, "home")
		mkdirSync(join(home, ".gates"), { recursive: true })
		const session = Bun.spawn(["sleep", "60"])
		const pidFile = join(dir, "command.pid")
		const run = Bun.spawn(["bash", "-c", lockedRun(60, ["sh", "-c", `echo $$ > ${pidFile}; exec sleep 30`])], {
			env: { ...process.env, HOME: home, PATH: `${dir}:${process.env.PATH}`, REMOTE_MAC_WATCH: String(session.pid) },
			stdout: "ignore",
			stderr: "ignore",
		})
		expect(waitFor(() => Bun.file(pidFile).size > 0)).toBe(true)
		const command = Number(readFileSync(pidFile, "utf8").trim())
		expect(alive(command)).toBe(true)
		session.kill("SIGKILL")
		// Reaped, so the watcher sees it gone (a zombie still answers `kill -0`).
		await session.exited
		expect(waitFor(() => !alive(command))).toBe(true)
		// The stand-in reports the signal that stopped it.
		expect(await run.exited).toBe(143)
	}, 30_000)
})

describe("queued Mac runs", () => {
	test("two runs started together check out and run one after the other", async () => {
		const { dir } = shims()
		const home = join(dir, "home")
		const bin = join(home, ".bun/bin")
		mkdirSync(join(home, "solidports-ci/.git"), { recursive: true })
		mkdirSync(bin, { recursive: true })
		const events = join(dir, "events")
		// Stand-ins for git and bun: a checkout takes a moment, so an unlocked second run would land
		// between the first run's checkout and its command.
		writeFileSync(
			join(bin, "git"),
			`#!/bin/sh\nif [ "$1" = checkout ]; then echo "$RUN_ID checkout" >> ${events}; sleep 0.5; fi\nexit 0\n`,
		)
		writeFileSync(join(bin, "bun"), "#!/bin/sh\nexit 0\n")
		chmodSync(join(bin, "git"), 0o755)
		chmodSync(join(bin, "bun"), 0o755)
		const start = (id: string) =>
			Bun.spawn(
				[
					"bash",
					"-c",
					remoteScript({
						sha: "abc",
						timeout: 60,
						command: ["sh", "-c", `echo "$RUN_ID command" >> ${events}; sleep 0.5`],
						bundle: `solidports-remote-${id}.bundle`,
						ref: `refs/remote-mac/${id}`,
						fetch: [],
						outDir: `remote-mac-out/${id}`,
					}),
				],
				{ env: { ...process.env, HOME: home, RUN_ID: id }, stdout: "ignore", stderr: "ignore" },
			)
		const runs = [start("a"), start("b")]
		expect(await Promise.all(runs.map((run) => run.exited))).toEqual([0, 0])
		const lines = readFileSync(events, "utf8").trim().split("\n")
		const [first, second] = [lines[0].split(" ")[0], lines[2]?.split(" ")[0]]
		expect(lines).toEqual([`${first} checkout`, `${first} command`, `${second} checkout`, `${second} command`])
		expect(new Set([first, second])).toEqual(new Set(["a", "b"]))
	}, 30_000)

	test("a run copies its --fetch files to its own folder before the next run starts", async () => {
		const { dir } = shims()
		const home = join(dir, "home")
		const bin = join(home, ".bun/bin")
		mkdirSync(join(home, "solidports-ci/.git"), { recursive: true })
		mkdirSync(bin, { recursive: true })
		writeFileSync(join(bin, "git"), "#!/bin/sh\nexit 0\n")
		writeFileSync(join(bin, "bun"), "#!/bin/sh\nexit 0\n")
		chmodSync(join(bin, "git"), 0o755)
		chmodSync(join(bin, "bun"), 0o755)
		const run = Bun.spawn(
			[
				"bash",
				"-c",
				remoteScript({
					sha: "abc",
					timeout: 60,
					command: ["sh", "-c", "mkdir -p out && echo result > out/r.json; exit 3"],
					bundle: "b.bundle",
					ref: "refs/remote-mac/x",
					fetch: ["out/r.json", "missing.json"],
					outDir: ".gates/remote-mac-out/x",
				}),
			],
			{ env: { ...process.env, HOME: home }, stdout: "pipe", stderr: "ignore" },
		)
		// The command's exit code survives the copy.
		expect(await run.exited).toBe(3)
		expect(readFileSync(join(home, ".gates/remote-mac-out/x/out/r.json"), "utf8")).toBe("result\n")
		expect(await new Response(run.stdout).text()).toContain("remote-mac: could not collect missing.json")
	}, 30_000)
})
