import { describe, expect, test } from "bun:test"
import { classifyWorkers } from "../packages/base-ui/scripts/jsdom-exits.mjs"

const file = (pid: number, path: string, t: number) => ({ event: "file", pid, t, file: path })
const done = (pid: number, path: string, t: number) => ({ event: "done", pid, t, file: path })
const exit = (pid: number, code: number, t: number) => ({ event: "exit", pid, t, code, rss: 512, heapUsed: 256 })

describe("jsdom worker exits: which worker died, how, and in which test file", () => {
	test("a worker that logged its exit with code 0 is clean", () => {
		expect(classifyWorkers([file(1, "a.test.tsx", 1), done(1, "a.test.tsx", 2), exit(1, 0, 3)])).toEqual([
			{ pid: 1, status: "clean", code: 0, lastFile: "a.test.tsx", files: 1, rss: 512, heapUsed: 256 },
		])
	})

	test("a nonzero exit code names the file the worker ran last", () => {
		const [worker] = classifyWorkers([file(2, "a.test.tsx", 1), file(2, "b.test.tsx", 2), exit(2, 1, 3)])
		expect(worker).toMatchObject({ status: "exit-code", code: 1, lastFile: "b.test.tsx", files: 2 })
	})

	test("a worker the pool ended after its last file finished is clean: vitest signals idle workers", () => {
		const [worker] = classifyWorkers([file(5, "d.test.tsx", 1), done(5, "d.test.tsx", 2)])
		expect(worker).toMatchObject({ status: "ended", code: null, lastFile: "d.test.tsx", files: 1 })
	})

	test("a worker that died inside a test file, with no finish and no exit, was killed there", () => {
		const records = [file(3, "b.test.tsx", 1), done(3, "b.test.tsx", 2), file(3, "c.test.tsx", 3)]
		expect(classifyWorkers(records)).toEqual([
			{ pid: 3, status: "killed", code: null, lastFile: "c.test.tsx", files: 2, rss: null, heapUsed: null },
		])
	})

	test("workers come back in pid order, the unclean ones flagged", () => {
		const records = [
			file(9, "z.test.tsx", 1),
			file(4, "y.test.tsx", 1),
			exit(4, 0, 2),
			file(7, "x.test.tsx", 1),
			done(7, "x.test.tsx", 2),
		]
		expect(classifyWorkers(records).map((w) => [w.pid, w.status])).toEqual([
			[4, "clean"],
			[7, "ended"],
			[9, "killed"],
		])
	})
})
