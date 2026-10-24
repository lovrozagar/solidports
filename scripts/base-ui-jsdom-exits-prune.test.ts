import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pruneExitRuns } from "../packages/base-ui/packages/solid/test/exitDiagnosticsSetup"

const temps: string[] = []
afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A records dir with run dirs named by pid, each `age` seconds old, plus whatever else is given. */
function records(ages: Record<string, number>) {
	const dir = mkdtempSync(join(tmpdir(), "jsdom-exits-"))
	temps.push(dir)
	const now = Date.now() / 1000
	for (const [name, age] of Object.entries(ages)) {
		mkdirSync(join(dir, name))
		writeFileSync(join(dir, name, "1.jsonl"), "{}\n")
		utimesSync(join(dir, name), now - age, now - age)
	}
	return dir
}

describe("pruning the jsdom exit records: the newest runs stay, the rest go", () => {
	test("keeps the newest 5 run dirs and removes the older ones", () => {
		const dir = records({ "101": 70, "102": 60, "103": 50, "104": 40, "105": 30, "106": 20, "107": 10 })
		pruneExitRuns(dir, 5)
		expect(readdirSync(dir).sort()).toEqual(["103", "104", "105", "106", "107"])
	})

	test("leaves anything that is not a run dir alone, however old", () => {
		const dir = records({ "201": 90, notes: 100, "202": 10 })
		writeFileSync(join(dir, "README"), "")
		pruneExitRuns(dir, 1)
		expect(readdirSync(dir).sort()).toEqual(["202", "README", "notes"])
	})

	test("a missing records dir is nothing to prune", () => {
		expect(() => pruneExitRuns(join(tmpdir(), "jsdom-exits-missing-dir"), 5)).not.toThrow()
	})
})
