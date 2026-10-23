import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const SCRIPT = join(import.meta.dir, "../packages/base-ui/scripts/webkit-docker.sh")
const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** The environment without GIT_*: a hook-spawned test would otherwise run git on the real repo. */
function cleanEnv() {
	return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")))
}

/** A git tree with an install of its own at `<temp>/<name>`, as the script requires. */
function tree(name: string) {
	const root = mkdtempSync(join(tmpdir(), "webkit-docker-"))
	temps.push(root)
	const dir = join(root, name)
	mkdirSync(join(dir, "node_modules/.bin"), { recursive: true })
	mkdirSync(join(dir, "packages/base-ui"), { recursive: true })
	spawnSync("git", ["init", "-q", dir], { env: cleanEnv() })
	return dir
}

function run(cwd: string, report: string, env: Record<string, string | undefined> = cleanEnv()) {
	return spawnSync("bash", [SCRIPT, "test:solid:webkit", report], { cwd, env, encoding: "utf8" })
}

/** `node` and `docker` stubs on PATH: node prints a version, docker logs each call's argv. */
function stubs() {
	const bin = mkdtempSync(join(tmpdir(), "webkit-docker-bin-"))
	temps.push(bin)
	const log = join(bin, "docker.log")
	writeFileSync(join(bin, "node"), "#!/usr/bin/env bash\necho 1.61.1\n")
	writeFileSync(join(bin, "docker"), `#!/usr/bin/env bash\nprintf '%s\\0' "$@" >> '${log}'\nprintf '\\n' >> '${log}'\n`)
	chmodSync(join(bin, "node"), 0o755)
	chmodSync(join(bin, "docker"), 0o755)
	return { env: { ...cleanEnv(), PATH: `${bin}:${process.env.PATH}` }, log }
}

describe("webkit-docker.sh", () => {
	// The overlay's mount options separate fields with commas and lower layers with colons, and the
	// --mount value quotes them in double quotes: a path with any of these would mount the wrong
	// layers, so the script refuses it before Docker sees it.
	for (const name of ["a,b", "a:b", 'a"b']) {
		test(`refuses a tree path with ${name.replace(/a|b/g, "")}`, () => {
			const dir = tree(name)
			const result = run(join(dir, "packages/base-ui"), join(dir, "report.json"))
			expect(result.status).toBe(2)
			expect(result.stderr).toContain("webkit-docker: the overlay cannot mount")
		})
	}

	test("takes a tree path with a space through to the overlay mount", () => {
		const dir = tree("a b")
		const { env, log } = stubs()
		const result = run(join(dir, "packages/base-ui"), join(dir, "report.json"), env)
		expect(result.stderr).not.toContain("cannot mount")
		expect(result.status).toBe(0)
		const calls = readFileSync(log, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => line.split("\0").filter(Boolean))
		const runCall = calls.find((args) => args[0] === "run" && args.includes("--init"))!
		const mount = runCall[runCall.indexOf("--mount") + 1]
		expect(mount).toContain(`dst=${dir},`)
		expect(mount).toContain(`"volume-opt=o=lowerdir=${dir},upperdir=${dir}/webkit-docker.`)
		expect(runCall).toContain("mcr.microsoft.com/playwright:v1.61.1-noble")
	})

	test("refuses a report folder whose path the overlay cannot take", () => {
		const dir = tree("ok")
		const result = run(join(dir, "packages/base-ui"), join(dir, "out,put/report.json"))
		expect(result.status).toBe(2)
		expect(result.stderr).toContain("webkit-docker: the overlay cannot mount")
	})
})
