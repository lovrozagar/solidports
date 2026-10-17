// A simulated benchmark process for the perf rule's tests: a seeded clock whose noise is the
// noise the Mac's bench samples showed (2026-10-17, progress/1000 server ms). Most renders land
// within a few percent of the median. About one sample in ten is 50–60 ms slower, on either side
// (cur 101.8 against a median of 47.4, base 115.0 against 96.8), and the first measured run is
// often the slowest. The sources are garbage-driven collection pauses (`gc()` collects outside the
// timed span, as `--expose-gc`'s does), a rare stall (JIT, the OS), and a first-run outlier.

/** A seeded uniform [0, 1) source (mulberry32), so every run of a test sees the same noise. */
export function random(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export interface Machine {
	now: () => number
	gc: () => void
	/** A render that costs `ms` of work, once per call. */
	render: (ms: number) => () => void
}

export function machine(seed: number, { firstOutlierMs = 55 } = {}): Machine {
	const next = random(seed)
	let time = 0
	let garbage = 0
	let threshold = 800 + next() * 800
	return {
		now: () => time,
		gc: () => {
			garbage = 0
			threshold = 800 + next() * 800
		},
		render: (ms: number) => {
			let first = true
			return () => {
				time += ms * (0.97 + next() * 0.06)
				if (first) {
					first = false
					time += firstOutlierMs
				}
				garbage += ms
				if (garbage >= threshold) {
					time += 50 + next() * 10
					garbage = 0
					threshold = 800 + next() * 800
				}
				if (next() < 0.03) time += 55
			}
		},
	}
}

/**
 * Browser-step samples as `run.mjs` takes them: one timed render per sample, base and cur
 * interleaved run by run, no collection between them.
 */
export function singleRenderSamples(m: Machine, baseMs: number, curMs: number, count = 16) {
	const base = m.render(baseMs)
	const cur = m.render(curMs)
	const samples = { base: [] as number[], cur: [] as number[] }
	for (let run = 0; run < count; run += 1) {
		for (const [name, render] of [
			["base", base],
			["cur", cur],
		] as const) {
			const start = m.now()
			render()
			samples[name].push(m.now() - start)
		}
	}
	return samples
}

export const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1)
