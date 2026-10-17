import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { filterMisses } from "../packages/base-ui/scripts/vitest-filter-guard.mjs"

const BASE_UI = resolve(import.meta.dir, "../packages/base-ui")
const file = (rel: string) => resolve(BASE_UI, rel)

describe("vitest filter guard", () => {
	const under = (files: Record<string, string[]>) => (path: string) => files[path] ?? []

	test("a path filter that matched every test file under it passes", () => {
		const dir = file("packages/solid/src/separator")
		const tests = [file("packages/solid/src/separator/Separator.test.tsx")]
		expect(filterMisses(["packages/solid/src/separator"], tests, BASE_UI, under({ [dir]: tests }))).toEqual([])
	})

	test("a filter that matched no file fails, whether or not it names a path", () => {
		const matched = [file("packages/solid/src/separator/Separator.test.tsx")]
		expect(filterMisses(["solid/src/collapsible", "noSuchTest"], matched, BASE_UI, under({}))).toEqual([
			'"solid/src/collapsible" matched 0 files',
			'"noSuchTest" matched 0 files',
		])
	})

	test("a path filter that matched fewer files than the path contains fails with both counts", () => {
		const dir = file("packages/solid/src/collapsible")
		const all = [file("packages/solid/src/collapsible/a.test.tsx"), file("packages/solid/src/collapsible/b.test.tsx")]
		expect(filterMisses(["packages/solid/src/collapsible"], all.slice(0, 1), BASE_UI, under({ [dir]: all }))).toEqual([
			'"packages/solid/src/collapsible" matched 1 of 2 files',
		])
	})

	test("a name filter that matched some file passes", () => {
		const matched = [file("packages/solid/src/utils/native/native.cost.test.tsx")]
		expect(filterMisses(["cost.test"], matched, BASE_UI, under({}))).toEqual([])
	})

	test("a jsdom run with one filter that misses exits non-zero and names it", () => {
		const run = spawnSync(
			"bun",
			["run", "test:solid:jsdom", "packages/solid/src/separator", "solid/src/collapsible", "--run"],
			{ cwd: BASE_UI, encoding: "utf8", timeout: 300_000 },
		)
		const output = `${run.stdout}${run.stderr}`
		expect(output).toContain('filter "solid/src/collapsible" matched 0 files')
		expect(run.status).not.toBe(0)
	}, 300_000)
})
