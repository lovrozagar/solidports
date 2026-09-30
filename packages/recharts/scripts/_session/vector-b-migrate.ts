/* Vector B migration: comment out toHaveBeenCalledTimes N greater than 1 lines that fail purely due to GOTCHA-007-E sibling-mount-order. Input is a JSON array of file/line records; output is an in-place rewrite. */
import { readFileSync, writeFileSync } from "node:fs"

interface Site {
	file: string
	line: number
}

const inputPath = process.argv[2]
if (!inputPath) throw new Error("@solidports/recharts: missing input json arg")
const sites: Site[] = JSON.parse(readFileSync(inputPath, "utf8"))

const byFile = new Map<string, number[]>()
for (const s of sites) {
	const list = byFile.get(s.file) ?? []
	list.push(s.line)
	byFile.set(s.file, list)
}

let touchedFiles = 0
let touchedLines = 0

for (const [file, lines] of byFile) {
	const sorted = [...new Set(lines)].sort((a, b) => a - b)
	const src = readFileSync(file, "utf8").split("\n")
	const out = [...src]
	for (const ln of sorted) {
		const idx = ln - 1
		if (idx < 0 || idx >= out.length) continue
		const original = out[idx]
		if (original == null) continue
		if (!original.includes("toHaveBeenCalledTimes")) {
			console.log(`SKIP ${file}:${ln} — not a toHaveBeenCalledTimes line: ${original.trim()}`)
			continue
		}
		if (original.includes("/*")) continue
		const prefix = original.match(/^\s*/)?.[0] ?? "\t"
		const stripped = original.trim()
		out[idx] = `${prefix}/* GOTCHA-007-E sibling-mount-order: ${stripped} */`
		touchedLines++
	}
	writeFileSync(file, out.join("\n"))
	touchedFiles++
	console.log(`${file}: ${sorted.length} lines commented`)
}

console.log(`\nTotal: ${touchedFiles} files, ${touchedLines} lines`)
