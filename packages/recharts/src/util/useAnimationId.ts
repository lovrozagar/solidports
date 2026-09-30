/* eslint-disable import/no-cycle */
import { createMemo } from "solid-js"
import { uniqueId } from "./DataUtils"

/* React `useAnimationId(input, prefix)` regenerates id when `input !== prev` by
   reference. React renders hand fresh `props` objects per render, so refs flip
   on parent updates. Solid props proxies stay stable across data updates — we
   must compare CONTENT, not reference. structuredClone-free shallow compare
   is sufficient for the inputs callers actually pass (arrays of points,
   primitive prop values, light objects). */
function shallowEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (a == null || b == null) return false
	if (typeof a !== "object" || typeof b !== "object") return false
	if (Array.isArray(a) !== Array.isArray(b)) return false
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!shallowEqualEntry((a as unknown[])[i], (b as unknown[])[i])) return false
		}
		return true
	}
	const aKeys = Object.keys(a as Record<string, unknown>)
	const bKeys = Object.keys(b as Record<string, unknown>)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (
			!shallowEqualEntry(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
			)
		) {
			return false
		}
	}
	return true
}

function shallowEqualEntry(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (a == null || b == null) return false
	if (typeof a !== "object" || typeof b !== "object") return false
	const aKeys = Object.keys(a as Record<string, unknown>)
	const bKeys = Object.keys(b as Record<string, unknown>)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (
			!Object.is(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
			)
		) {
			return false
		}
	}
	return true
}

/* Solid port (was: setAnimationId inside a memo that also read animationId()
   formed a write-after-read cycle, OOM under fresh-each-call refs). Drop the
   signal — keep previous input + current id in plain mutable state, recompute
   synchronously when tracked input CONTENT changes. Reference equality alone
   misfires under Solid because selectors return fresh arrays even when content
   is unchanged. */
export function useAnimationId(input: () => unknown, prefix: string = "animation-"): () => string {
	let prevInput = input()
	let currentId = uniqueId(prefix)

	const animationId = createMemo(() => {
		const currentInput = input()
		if (!shallowEqual(prevInput, currentInput)) {
			prevInput = currentInput
			currentId = uniqueId(prefix)
		}
		return currentId
	})
	return animationId
}
