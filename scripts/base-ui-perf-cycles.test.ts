import { describe, expect, test } from "bun:test"
import { heapCycle, retainedKB, timingCycle } from "../packages/base-ui/test/perf-solid/shared/cycles.mjs"

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

	test("a timing cycle given a final heap reader collects once more after the last step and reads it", async () => {
		const { log, ops } = recorder()
		const results = await timingCycle({
			collect: ops.collect,
			runStep: ops.runStep,
			readFinalHeap: ops.readHeap,
			stepCount: 3,
		})
		expect(log.slice(-3)).toEqual(["step 2", "collect", "readHeap"])
		expect(results.finalHeap).toBe(1512)
	})

	test("a step retains the collected heap after it minus the collected heap before it", () => {
		// Pre-step heaps in bytes, each read after the step's own collection; the mount (step 0)
		// follows the untimed warm-up instead, so it has none (the heap cycle judges it).
		const kb = 1024
		const retained = retainedKB([100 * kb, 300 * kb, 350 * kb, 360 * kb], 200 * kb)
		expect(retained).toEqual([null, 50, 10, -160])
	})

	test("a heap cycle reads the heap around a collected mount, then unmounts, and times nothing", async () => {
		const { log, ops } = recorder()
		const kb = await heapCycle({ ...ops, stepCount: 4 })
		expect(log).toEqual(["collect", "readHeap", "step 0", "collect", "readHeap", "step 3"])
		expect(kb).toBe(0.5)
	})
})
