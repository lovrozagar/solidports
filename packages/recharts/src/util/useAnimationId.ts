/* eslint-disable import/no-cycle */
import { createMemo } from 'solid-js';
import { uniqueId } from "./DataUtils"
import { structurallyEqual } from "./structurallyEqual"

/* React `useAnimationId(input, prefix)` regenerates id when `input !== prev` by
   reference. React renders hand fresh `props` objects per render, so refs flip
   on parent updates. Solid props proxies stay stable across data updates — we
   must compare CONTENT, not reference (see structurallyEqual below). */
/* Solid port (was: setAnimationId inside a memo that also read animationId()
   formed a write-after-read cycle, OOM under fresh-each-call refs). Drop the
   signal — keep previous input + current id in plain mutable state, recompute
   synchronously when tracked input CONTENT changes. Reference equality alone
   misfires under Solid because selectors return fresh arrays even when content
   is unchanged. */
const UNINITIALIZED = Symbol("useAnimationId.uninitialized")

export function useAnimationId(input: () => unknown, prefix: string = "animation-"): () => string {
	let prevInput: unknown = UNINITIALIZED
	let currentId = uniqueId(prefix)

	const animationId = createMemo(() => {
		const currentInput = input()
		if (prevInput !== UNINITIALIZED && !structurallyEqual(prevInput, currentInput)) {
			currentId = uniqueId(prefix)
		}
		prevInput = currentInput
		return currentId
	})
	return animationId
}
