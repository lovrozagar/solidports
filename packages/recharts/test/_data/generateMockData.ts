/* 1:1 port of @recharts/devtools generateMockData. LCG identical so test fixtures
 * line up byte-for-byte with upstream snapshots. */
export function* random(seed: number): Generator<number> {
	const m = 2 ** 16 + 1
	const a = 75
	const c = 74
	let x = seed
	if (x > 0 && x < 1) {
		x = Math.round(x * 1000)
	}
	while (x < 0) {
		x += m
	}
	while (true) {
		x = (a * x + c) % m
		yield Math.round(x)
	}
}

function between(rng: Generator<number, number, unknown>, min: number, max: number): number {
	const val = rng.next().value
	return (val % (max - min)) + min
}

export function generateMockData(
	length: number,
	seed: number,
): Array<{ label: string; x: number; y: number; z: number }> {
	const result: Array<{ label: string; x: number; y: number; z: number }> = []
	const gen = random(seed)
	for (let i = 0; i < length; i++) {
		result.push({
			label: `Iter: ${i}`,
			x: between(gen, 100, 300),
			y: between(gen, 400, 800),
			z: between(gen, 1000, 2000),
		})
	}
	return result
}
