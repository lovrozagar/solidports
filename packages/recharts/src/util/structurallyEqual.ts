function isPlainContainer(value: unknown): value is Record<string, unknown> | unknown[] {
	if (Array.isArray(value)) return true
	if (value == null || typeof value !== "object") return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

/* Structural equality over plain objects and arrays; anything else (functions, DOM nodes,
   class instances, Dates) compares by identity. Selectors rebuild nested objects such as
   `payload` / `tooltipPayload` on every recompute, where upstream's memoized selectors keep
   the references stable, so identity alone would restart animations needlessly. */
export function structurallyEqual(a: unknown, b: unknown, depth: number = 0): boolean {
	if (Object.is(a, b)) return true
	if (depth > 6 || !isPlainContainer(a) || !isPlainContainer(b)) return false
	if (Array.isArray(a) !== Array.isArray(b)) return false
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!structurallyEqual(a[i], b[i], depth + 1)) return false
		}
		return true
	}
	const aRecord = a as Record<string, unknown>
	const bRecord = b as Record<string, unknown>
	const aKeys = Object.keys(aRecord)
	if (aKeys.length !== Object.keys(bRecord).length) return false
	for (const key of aKeys) {
		if (!structurallyEqual(aRecord[key], bRecord[key], depth + 1)) return false
	}
	return true
}
