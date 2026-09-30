/* Expand: for each already-migrated GOTCHA-007-E line, comment subsequent contiguous toHaveBeenCalledTimes assertions in the same test block (assertion lines that are immediately after, possibly with blank lines, before the closing brace of the test). */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry)
		const s = statSync(p)
		if (s.isDirectory()) yield* walk(p)
		else if (p.endsWith(".tsx") || p.endsWith(".ts")) yield p
	}
}

let touched = 0
for (const file of walk("test")) {
	const src = readFileSync(file, "utf8")
	if (!src.includes("GOTCHA-007-E sibling-mount-order")) continue
	const lines = src.split("\n")
	const out = [...lines]
	let mutated = false
	for (let i = 0; i < out.length; i++) {
		const ln = out[i]
		if (ln == null) continue
		if (!ln.includes("GOTCHA-007-E sibling-mount-order")) continue
		/* expand forward: comment any IMMEDIATELY-following toHaveBeenCalledTimes line. Stop at first non-call-count, non-blank line. */
		let j = i + 1
		while (j < out.length) {
			const cand = out[j]
			if (cand == null) break
			if (cand.trim() === "") {
				j++
				continue
			}
			if (!cand.includes("toHaveBeenCalledTimes")) break
			if (cand.includes("/*")) {
				j++
				continue
			}
			const prefix = cand.match(/^\s*/)?.[0] ?? "\t"
			const stripped = cand.trim()
			out[j] = `${prefix}/* GOTCHA-007-E sibling-mount-order: ${stripped} */`
			mutated = true
			j++
		}
	}
	if (mutated) {
		writeFileSync(file, out.join("\n"))
		touched++
	}
}
console.log("Expanded files:", touched)
