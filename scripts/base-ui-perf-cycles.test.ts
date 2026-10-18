import { describe, expect, test } from "bun:test"
import { heapCycle, timingCycle } from "../packages/base-ui/test/perf-solid/shared/cycles.mjs"

// The benchmark's per-run sequence (D17). A forced full collection right before the timed mount
// measured the engine's post-collection state, which no app mounts in. Timing cycles start warmed
// (an untimed mount and unmount after the collection), and every later step starts after a
// collection of its own, so no step pays for the garbage another left (perf/method.md); the heap
// is read in cycles of its own.

/** A recording page: each operation appends to `log`. */
function recorder() {
	const log: string[] = []
	let heap = 1000
	return {
		log,
		ops: {
			collect: async () => {
				log.push("collect")
			},
			readHeap: async () => {
				log.push("readHeap")
				heap += 512
				return heap
			},
			runStep: async (index: number) => {
				log.push(`step ${index}`)
				return { index }
			},
		},
	}
}

describe("bench cycles", () => {
	test("a timing cycle warms up after the collection, then collects before every step after the mount", async () => {
		const { log, ops } = recorder()
		const results = await timingCycle({ ...ops, stepCount: 4 })
		expect(log).toEqual([
			"collect",
			"step 0",
			"step 3",
			"step 0",
			"collect",
			"step 1",
			"collect",
			"step 2",
			"collect",
			"step 3",
		])
		// Only the timed steps come back.
		expect(results.map((r: { index: number }) => r.index)).toEqual([0, 1, 2, 3])
		expect(log).not.toContain("readHeap")
	})

	test("a heap cycle reads the heap around a collected mount, then unmounts, and times nothing", async () => {
		const { log, ops } = recorder()
		const kb = await heapCycle({ ...ops, stepCount: 4 })
		expect(log).toEqual(["collect", "readHeap", "step 0", "collect", "readHeap", "step 3"])
		expect(kb).toBe(0.5)
	})
})
