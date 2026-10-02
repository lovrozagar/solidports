/**
 * Structural equality for spy deduplication. Selectors here return fresh objects on
 * every evaluation where upstream's memoized selectors return the same reference, so
 * value-equal results count as unchanged. Scales are closures; they compare by what
 * they map (domain and range). Other functions compare by identity.
 */
function isScaleLike(
	value: object,
): value is { domain: () => ReadonlyArray<unknown>; range: () => ReadonlyArray<unknown> } {
	const candidate = value as { domain?: unknown; range?: unknown }
	return typeof candidate.domain === "function" && typeof candidate.range === "function"
}

export function structurallyEqual(prev: unknown, next: unknown): boolean {
	if (Object.is(prev, next)) return true
	if (typeof prev === "function" && typeof next === "function") return false
	if (prev == null || next == null) return false
	if (typeof prev !== "object" || typeof next !== "object") return false
	if (isScaleLike(prev) && isScaleLike(next)) {
		return structurallyEqual(prev.domain(), next.domain()) && structurallyEqual(prev.range(), next.range())
	}
	if (Array.isArray(prev) !== Array.isArray(next)) return false
	if (Array.isArray(prev) && Array.isArray(next)) {
		if (prev.length !== next.length) return false
		for (let i = 0; i < prev.length; i++) {
			if (!structurallyEqual(prev[i], next[i])) return false
		}
		return true
	}
	const aKeys = Object.keys(prev as Record<string, unknown>)
	const bKeys = Object.keys(next as Record<string, unknown>)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (!Object.hasOwn(next as Record<string, unknown>, key)) return false
		if (!structurallyEqual((prev as Record<string, unknown>)[key], (next as Record<string, unknown>)[key])) {
			return false
		}
	}
	return true
}
