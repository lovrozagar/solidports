// Runs the scripts suite under the Bun version `package.json` pins (`packageManager`), which CI
// installs, when the local Bun is a different version: a suite can pass under one Bun and fail
// under the other (a timer that fires early under 1.3.11 only). A matching local Bun already ran
// the suite in `bun run verify`, so then this does nothing. pre-push runs it (`lefthook.yml`).
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/** The Bun version a `packageManager` field pins, or `undefined`. */
export function pinnedBun(packageManager: string | undefined): string | undefined {
	return packageManager?.startsWith("bun@") ? packageManager.slice(4) : undefined
}

/**
 * The environment for the suite: without git's hook variables (`GIT_DIR`, `GIT_INDEX_FILE` and the
 * rest), which a pre-push hook inherits and which would point the tests' own temporary repos at
 * this one.
 */
export function suiteEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
	return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith("GIT_")))
}

/** The command that runs the scripts suite under the pinned Bun, or `null` when there is nothing to do. */
export function pinnedRun(packageManager: string | undefined, local: string): string[] | null {
	const pinned = pinnedBun(packageManager)
	return pinned === undefined || pinned === local ? null : ["bunx", `bun@${pinned}`, "test", "./scripts"]
}

if (import.meta.main) {
	const root = join(import.meta.dir, "..")
	const { packageManager } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
		packageManager?: string
	}
	const command = pinnedRun(packageManager, Bun.version)
	if (command === null) {
		console.log(`scripts suite: local Bun ${Bun.version} is the pinned one; verify ran it`)
		process.exit(0)
	}
	console.log(`scripts suite under the pinned Bun (local is ${Bun.version}): ${command.join(" ")}`)
	const run = spawnSync(command[0], command.slice(1), {
		cwd: root,
		env: suiteEnv(process.env),
		stdio: "inherit",
	})
	process.exit(run.status ?? 1)
}
