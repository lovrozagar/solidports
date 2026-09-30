import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

const TEST_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/test"

/**
 * Wraps render(<JSX />) calls with render(() => <JSX />) by tracking paren depth.
 * Skips calls already wrapped with () =>.
 * Also handles rerender() calls.
 */
function wrapRenderCalls(code: string, funcName: string): string {
	/* Find all occurrences of funcName( followed by < (JSX) */
	const pattern = new RegExp(`(?<![\\w.])${funcName}\\(`, "g")
	let result = ""
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(code)) !== null) {
		const callStart = match.index
		const parenStart = callStart + funcName.length

		/* Check if already wrapped: funcName(() => */
		const afterParen = code.slice(parenStart + 1, parenStart + 20).trimStart()
		if (afterParen.startsWith("() =>") || afterParen.startsWith("() =")) {
			continue
		}

		/* Check if the content starts with JSX (< followed by uppercase letter) */
		const contentStart = code.slice(parenStart + 1).trimStart()
		if (!contentStart.startsWith("<") || !/^<[A-Z]/.test(contentStart)) {
			continue
		}

		/* Find matching close paren by tracking depth */
		let depth = 1
		let i = parenStart + 1
		let inString: string | null = null
		let escaped = false
		let inTemplate = false

		while (i < code.length && depth > 0) {
			const ch = code[i]

			if (escaped) {
				escaped = false
				i++
				continue
			}

			if (ch === "\\") {
				escaped = true
				i++
				continue
			}

			if (inString) {
				if (ch === inString) inString = null
				i++
				continue
			}

			if (inTemplate) {
				if (ch === "`") inTemplate = false
				if (ch === "$" && i + 1 < code.length && code[i + 1] === "{") {
					/* Template literal expression — skip to matching } */
					i += 2
					let templateDepth = 1
					while (i < code.length && templateDepth > 0) {
						if (code[i] === "{") templateDepth++
						else if (code[i] === "}") templateDepth--
						i++
					}
					continue
				}
				i++
				continue
			}

			if (ch === '"' || ch === "'") {
				inString = ch
				i++
				continue
			}

			if (ch === "`") {
				inTemplate = true
				i++
				continue
			}

			if (ch === "(") depth++
			else if (ch === ")") depth--

			i++
		}

		const closeParenIdx = i - 1

		/* Extract the JSX content between parens */
		const inner = code.slice(parenStart + 1, closeParenIdx)

		/* Remove trailing comma if present */
		const trimmedInner = inner.replace(/,\s*$/, "")

		/* Build the replacement */
		result += code.slice(lastIndex, parenStart + 1)
		result += `() => (${trimmedInner})`
		result += ")"
		lastIndex = closeParenIdx + 1
	}

	result += code.slice(lastIndex)
	return result
}

/* Find all test files with unwrapped render calls */
const files = execSync(
	`grep -rl 'render(\\s*$' ${TEST_BASE} --include='*.tsx' --include='*.ts' 2>/dev/null || true`,
	{ encoding: "utf-8" },
)
	.trim()
	.split("\n")
	.filter(Boolean)

/* Also find files with render(<Component pattern */
const files2 = execSync(
	`grep -rPl 'render\\(\\n\\s*<[A-Z]' ${TEST_BASE} --include='*.tsx' --include='*.ts' 2>/dev/null || true`,
	{ encoding: "utf-8" },
)
	.trim()
	.split("\n")
	.filter(Boolean)

/* And single-line render(<Component) */
const files3 = execSync(
	`grep -rl 'render(<[A-Z]' ${TEST_BASE} --include='*.tsx' --include='*.ts' 2>/dev/null || true`,
	{ encoding: "utf-8" },
)
	.trim()
	.split("\n")
	.filter(Boolean)

const allFiles = [...new Set([...files, ...files2, ...files3])].sort()

let totalFixed = 0

for (const filePath of allFiles) {
	const original = readFileSync(filePath, "utf-8")
	let result = original

	/* Wrap render() calls */
	result = wrapRenderCalls(result, "render")
	/* Wrap rerender() calls */
	result = wrapRenderCalls(result, "rerender")

	if (result !== original) {
		writeFileSync(filePath, result)
		totalFixed++
		const relative = filePath.replace(TEST_BASE + "/", "")
		console.log(`Fixed: ${relative}`)
	}
}

console.log(`\nDone! Fixed ${totalFixed} files.`)
