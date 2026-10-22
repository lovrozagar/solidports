import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Every dependency resolves from the npm registry, a workspace or a vendored tarball (`file:`),
// never from a URL. Preview hosts purge their builds (pkg.pr.new dropped TanStack/form#2122's on
// 2026-10-22, and every CI install failed with a 404) and git refs move, so a URL in the lockfile
// is an install that works only from a warm cache. Vendor such a build instead (vendor/tanstack).
// A spec alone (`"https://…"`) or after its package name (`"name@github:…"`, as resolutions read).
const URL_SPEC = /"(?:@?[^"@\s]+@)?((?:https?|git\+https?|git\+ssh|git|github|gitlab|bitbucket):[^"]*)"/g

/** The URL specs in a bun.lock's text, with the line each sits on. */
export function urlSpecs(lock: string) {
	const found: string[] = []
	lock.split("\n").forEach((line, index) => {
		for (const match of line.matchAll(URL_SPEC)) found.push(`${index + 1}: ${match[1]}`)
	})
	return found
}

describe("lockfile sources", () => {
	test("finds a preview-host or git resolution in a lockfile line", () => {
		const lock = [
			'    "@tanstack/solid-form": "https://pkg.pr.new/@tanstack/solid-form@1db6f68",',
			'    "x": ["x@github:owner/x#abc", {}],',
			'    "y": ["y@1.0.0", "", {}, "sha512-abc"],',
			'    "z": ["z@./vendor/z.tgz", {}],',
		].join("\n")
		expect(urlSpecs(lock)).toEqual(["1: https://pkg.pr.new/@tanstack/solid-form@1db6f68", "2: github:owner/x#abc"])
	})

	test("bun.lock resolves nothing from a URL", () => {
		const lock = readFileSync(join(import.meta.dir, "../bun.lock"), "utf8")
		expect(urlSpecs(lock)).toEqual([])
	})
})
