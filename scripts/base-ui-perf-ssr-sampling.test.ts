import { describe, expect, test } from "bun:test"
import { GATED, judge } from "../packages/base-ui/test/perf-solid/shared/regression.mjs"
import { SERVER_SAMPLING, sampleServer } from "../packages/base-ui/test/perf-solid/ssr/sample.mjs"
import { machine, SEEDS } from "./perf-noise-model"

/** The rule's verdict on base vs cur per seed, sampled as `ssr/run.mjs` samples. */
function verdicts(baseMs: number, curMs: number) {
	return SEEDS.map((seed) => {
		const m = machine(seed)
		const { samples } = sampleServer(
			{ react: m.render(30), base: m.render(baseMs), cur: m.render(curMs) },
			{ ...SERVER_SAMPLING, now: m.now, gc: m.gc },
		)
		return judge(samples.base, samples.cur, GATED.serverMs).verdict
	})
}

describe("SSR server sampling", () => {
	test("a 2x server slowdown is a regression under the 1.6 rule, for every noise seed", () => {
		expect(verdicts(50, 100)).toEqual(SEEDS.map(() => "regressed"))
	})

	test("a 2x server speed-up is an improvement, for every noise seed", () => {
		expect(verdicts(100, 50)).toEqual(SEEDS.map(() => "improved"))
	})

	test("the same work is the same, for every noise seed", () => {
		expect(verdicts(50, 50)).toEqual(SEEDS.map(() => "same"))
	})

	test("an A/A comparison is the same, for every noise seed", () => {
		expect(verdicts(80, 80)).toEqual(SEEDS.map(() => "same"))
	})

	test("without gc it refuses to sample, since its numbers would carry the collector's noise", () => {
		const m = machine(1)
		expect(() => sampleServer({ a: m.render(5) }, { runs: 20, warmup: 5, batchMs: 250 } as never)).toThrow(
			"--expose-gc",
		)
	})

	test("it takes enough samples for p90 to be other than the maximum", () => {
		const m = machine(1)
		const { samples } = sampleServer({ a: m.render(5) }, { ...SERVER_SAMPLING, now: m.now, gc: m.gc })
		expect(samples.a.length).toBeGreaterThanOrEqual(20)
	})
})
