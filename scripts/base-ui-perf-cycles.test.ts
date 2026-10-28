import { describe, expect, test } from "bun:test"
import { heapSample, retainedKB, timingCycle } from "../packages/base-ui/test/perf-solid/shared/cycles.mjs"
import { size } from "../packages/base-ui/test/perf-solid/shared/sizes.ts"

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

	test("a heap sample warms up at one item, then reads the mounted and the held heap against its own baseline", async () => {
		const { log, ops } = recorder()
		const scales: Array<boolean> = []
		const sample = await heapSample({ ...ops, stepCount: 4, setWarmup: async (on: boolean) => void scales.push(on) })
		expect(log).toEqual([
			"step 0",
			"step 3",
			"collect",
			"readHeap",
			"step 0",
			"collect",
			"readHeap",
			"step 3",
			"collect",
			"readHeap",
		])
		// The warm-up mount and unmount render one item; the measured mount the scenario's size.
		expect(scales).toEqual([true, false])
		expect(sample).toEqual({ mountedKB: 0.5, heldKB: 1 })
	})

	test("a library that keeps its last unmounted tree reads a held heap; one that frees it reads none", async () => {
		// A page whose heap holds the mounted tree (5,000 KB) and, for the holder, keeps it after the
		// unmount until the next mount releases it, as v0 did at d9ebafcc.
		const page = (holds: boolean) => {
			const kb = 1024
			let live = 0
			let held = 0
			let warm = false
			return {
				collect: async () => {},
				readHeap: async () => (100_000 + live + held) * kb,
				setWarmup: async (on: boolean) => {
					warm = on
				},
				runStep: async (index: number) => {
					if (index === 0) {
						held = 0
						live = warm ? 5 : 5000
					} else {
						if (holds) held = live
						live = 0
					}
					return { index }
				},
			}
		}
		const holder = await heapSample({ ...page(true), stepCount: 2 })
		const freer = await heapSample({ ...page(false), stepCount: 2 })
		// The holder's mount reads its true size less only the one-item tree the warm-up left held
		// (5 KB here), not less a whole earlier tree; and its held row reads the tree it keeps.
		expect(holder).toEqual({ mountedKB: 4995, heldKB: 4995 })
		expect(freer).toEqual({ mountedKB: 5000, heldKB: 0 })
	})

	test("fixtures render one item while the heap sample's warm-up flag is on", () => {
		const page = globalThis as { __benchWarmup?: boolean }
		expect(size(1000)).toBe(1000)
		page.__benchWarmup = true
		expect(size(1000)).toBe(1)
		expect(size(500)).toBe(1)
		page.__benchWarmup = false
		expect(size(1000)).toBe(1000)
	})
})
