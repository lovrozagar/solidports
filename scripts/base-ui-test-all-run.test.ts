import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireRunLock, planSuites, runDirFor } from "../packages/base-ui/scripts/test-all.mjs"

const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("test:base-ui:all run isolation", () => {
	test("a second run in the same tree is refused, naming the PID that holds the run lock", async () => {
		const dir = mkdtempSync(join(tmpdir(), "test-all-run-"))
		temps.push(dir)
		const lock = join(dir, "run.lock")
		const first = await acquireRunLock(lock)
		await expect(acquireRunLock(lock)).rejects.toThrow(
			`another test:base-ui:all run holds ${lock} (pid ${process.pid}); wait for it or stop it`,
		)
		await first.release()
		const again = await acquireRunLock(lock)
		await again.release()
	})

	test("a run that dies without releasing does not strand the lock", async () => {
		const dir = mkdtempSync(join(tmpdir(), "test-all-run-"))
		temps.push(dir)
		const lock = join(dir, "run.lock")
		const module = join(import.meta.dir, "../packages/base-ui/scripts/test-all.mjs")
		const crashed = Bun.spawn(
			[
				"node",
				"--input-type=module",
				"-e",
				`const m = await import(${JSON.stringify(module)}); await m.acquireRunLock(${JSON.stringify(lock)}); process.kill(process.pid, "SIGKILL")`,
			],
			{ stdout: "ignore", stderr: "ignore" },
		)
		await crashed.exited
		let acquired = null
		for (let i = 0; i < 40 && !acquired; i += 1) {
			acquired = await acquireRunLock(lock).catch(() => null)
			if (!acquired) await Bun.sleep(100)
		}
		expect(acquired).not.toBeNull()
		await acquired?.release()
	})

	test("each run writes its logs to its own stamped folder", () => {
		expect(runDirFor("/repo", new Date("2026-10-16T16:50:01.234Z"))).toBe(
			"/repo/.tmp/base-ui-test-all/2026-10-16T16-50-01-234Z",
		)
	})

	test("parity reports land in the run folder, not a shared path", () => {
		const firefox = planSuites({}).find((s: { name: string }) => s.name === "parity-firefox") as { run: string[] }
		expect(firefox.run.join("\n")).not.toContain("../../.tmp/base-ui-test-all/")
		expect(firefox.run[0]).toContain('--outputFile="$TEST_ALL_RUN_DIR/react-firefox.json"')
		expect(firefox.run[2]).toBe(
			'node scripts/browser-parity.mjs "$TEST_ALL_RUN_DIR/react-firefox.json" "$TEST_ALL_RUN_DIR/solid-firefox.json" --confirm firefox',
		)
	})
})
