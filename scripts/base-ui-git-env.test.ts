import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { repoEnv } from "../packages/base-ui/scripts/repoEnv.mjs"

/*
 * A git hook runs with `GIT_DIR` (and often `GIT_INDEX_FILE`) set to the repo it fires
 * in, and every process it starts inherits them. A script that then runs git in another directory
 * acts on the hook's repo instead: `git init` in a cache directory re-initialized the main checkout
 * as bare. Each script's git `run` must drop git's variables. The run goes through a child process
 * with the variables set, as a hook would start it.
 */
const SCRIPTS = resolve(import.meta.dir, "../packages/base-ui/scripts")
const RUNNERS = {
	"sync-docs-react": join(SCRIPTS, "docs/sync-docs-react.mjs"),
	"remote-mac": join(SCRIPTS, "remote-mac.mjs"),
}

const dirs: string[] = []
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(name: string) {
	const dir = mkdtempSync(join(tmpdir(), `git-env-${name}-`))
	dirs.push(dir)
	return dir
}

// This file runs under the pre-push hook too: its own git calls start from an environment without
// the hook's variables, or they would act on the real repo.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")))

function git(cwd: string, args: string[]) {
	return spawnSync("git", args, { cwd, encoding: "utf8", env: cleanEnv })
}

describe("git runs drop the inherited git environment", () => {
	for (const [name, file] of Object.entries(RUNNERS)) {
		test(`${name}: git init lands in its cwd, not in the inherited GIT_DIR`, () => {
			const hookRepo = tempDir("hook")
			expect(git(hookRepo, ["init", "-q"]).status).toBe(0)
			const target = tempDir("target")
			const script = `import { run } from ${JSON.stringify(file)}; run("git", ["init", "-q"], { cwd: ${JSON.stringify(target)} })`
			const result = spawnSync(process.execPath, ["-e", script], {
				encoding: "utf8",
				env: {
					...cleanEnv,
					GIT_DIR: join(hookRepo, ".git"),
					GIT_INDEX_FILE: join(hookRepo, ".git/index"),
				},
			})
			expect(result.stderr).toBe("")
			expect(result.status).toBe(0)
			expect(existsSync(join(target, ".git"))).toBe(true)
			// Re-initialized through GIT_DIR, the hook's repo would read as bare.
			expect(git(hookRepo, ["config", "--get", "core.bare"]).stdout.trim()).toBe("false")
		})
	}
})

describe("repoEnv", () => {
	test("drops the variables that aim git at a repo and keeps the user's other git settings", () => {
		const env = repoEnv({
			PATH: "/usr/bin",
			GIT_DIR: "/elsewhere/.git",
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: "core.bare",
			GIT_CONFIG_VALUE_0: "true",
			GIT_SSH_COMMAND: "ssh -i key",
		})
		expect(env).toEqual({ PATH: "/usr/bin", GIT_SSH_COMMAND: "ssh -i key" })
	})
})
