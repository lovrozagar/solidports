import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"

const SRC_BASE =
	"/home/ecomet/Development/monorepo/public/recharts-solid/recharts-main/test/component"
const DST_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/test/component"

const componentFiles = [
	"Text.spec.tsx",
	"Label.spec.tsx",
	"LabelList.spec.tsx",
	"Legend.spec.tsx",
	"Legend.itemSorter.spec.tsx",
	"ResponsiveContainer.spec.tsx",
	"Tooltip/ActiveDot.spec.tsx",
	"Tooltip/defaultIndex.spec.tsx",
	"Tooltip/itemSorter.spec.tsx",
	"Tooltip/tooltipEventType.spec.tsx",
	"Tooltip/Tooltip.payload.spec.tsx",
	"Tooltip/Tooltip.sync.spec.tsx",
	"Tooltip/Tooltip.visibility.spec.tsx",
]

const CONTAINER_SRC =
	"/home/ecomet/Development/monorepo/public/recharts-solid/recharts-main/test/container"
const CONTAINER_DST = "/home/ecomet/Development/monorepo/public/recharts-solid/test/container"
const containerFiles = ["chartDimensions.spec.tsx", "ClipPath.spec.tsx"]

/**
 * Wraps render(<JSX />) calls with render(() => <JSX />) by tracking paren depth.
 * Handles both single-line and multi-line render calls.
 */
function wrapRenderCalls(code: string, funcName: string): string {
	const pattern = new RegExp(`\\b${funcName}\\(\\s*\\n?(\\s*<)`, "g")
	let result = ""
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(code)) !== null) {
		const callStart = match.index
		/* Find the opening paren of funcName( */
		const parenStart = code.indexOf("(", callStart + funcName.length)

		/* Check if already wrapped: funcName(() => */
		const afterParen = code.slice(parenStart + 1, parenStart + 10).trim()
		if (
			afterParen.startsWith("() =>") ||
			(afterParen.startsWith("(") && code.slice(parenStart + 1, parenStart + 20).includes("=>"))
		) {
			continue
		}

		/* Find matching close paren by tracking depth */
		let depth = 1
		let i = parenStart + 1
		let inString: string | null = null
		let escaped = false

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

			if (ch === '"' || ch === "'" || ch === "`") {
				inString = ch
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

function convertFile(content: string, filename: string): string {
	let result = content

	/* Step 1: Single quotes to double quotes FIRST */
	result = result.replace(/'/g, '"')

	/* Step 2: Remove @ts-expect-error and @ts-ignore comments */
	result = result.replace(/\s*\/\/\s*@ts-expect-error[^\n]*/g, "")
	result = result.replace(/\s*\/\/\s*@ts-ignore[^\n]*/g, "")

	/* Step 3: Remove semicolons at end of statements */
	result = result.replace(/;(\s*\n)/g, "$1")
	result = result.replace(/;(\s*$)/gm, "$1")

	/* Step 4: Handle React imports */
	result = result.replace(/^import React from "react"\n/gm, "")
	result = result.replace(/^import \* as React from "react"\n/gm, "")
	result = result.replace(
		/^import React,\s*\{([^}]*)\}\s*from\s*"react"\n/gm,
		(_match, imports) => {
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s !== "")
			const solidItems: string[] = []
			const removedItems = new Set(["ReactNode", "ReactElement", "ComponentType"])
			for (const item of items) {
				if (item === "useState") solidItems.push("createSignal")
				else if (item === "useRef") solidItems.push("/* useRef removed */")
				else if (!removedItems.has(item)) solidItems.push(item)
			}
			if (solidItems.length === 0) return ""
			return `import { ${solidItems.join(", ")} } from "solid-js"\n`
		},
	)
	result = result.replace(/^import \{([^}]*)\}\s*from\s*"react"\n/gm, (_match, imports) => {
		const items = imports
			.split(",")
			.map((s: string) => s.trim())
			.filter((s: string) => s !== "")
		const solidItems: string[] = []
		const removedItems = new Set(["ReactNode", "ReactElement", "ComponentType"])
		for (const item of items) {
			if (item === "useState") solidItems.push("createSignal")
			else if (!removedItems.has(item)) solidItems.push(item)
		}
		if (solidItems.length === 0) return ""
		return `import { ${solidItems.join(", ")} } from "solid-js"\n`
	})

	/* Step 5: Replace ReactNode/ReactElement type references */
	result = result.replace(/\bReactNode\b/g, "JSX.Element")
	result = result.replace(/\bReactElement\b/g, "JSX.Element")
	result = result.replace(/\bComponentType\b/g, "Component")

	/* Step 6: Handle @testing-library/react -> @solidjs/testing-library */
	result = result.replace(
		/^import \{([^}]*)\}\s*from\s*"@testing-library\/react"\n/gm,
		(_match, imports) => {
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s !== "" && s !== "act")
			if (items.length === 0) return ""
			return `import { ${items.join(", ")} } from "@solidjs/testing-library"\n`
		},
	)
	result = result.replace(/^import \{\s*act\s*\}\s*from\s*"@testing-library\/react"\n/gm, "")

	/* Step 7: Remove act() wrappers - keep the inner content */
	result = result.replace(/\bact\(\(\) => \{([^}]*)\}\)/gs, (_match, inner) => inner.trim())
	/* Handle await act(() => {...}) */
	result = result.replace(/await act\(\(\) => \{([^}]*)\}\)/gs, (_match, inner) => inner.trim())
	/* Handle act(() => { single statement }) */
	result = result.replace(/\bact\(\(\) =>\s*\{([^}]+)\}\s*\)/gs, (_match, inner) => inner.trim())

	/* Step 8: Handle React.useState -> createSignal */
	if (result.includes("React.useState")) {
		result = result.replace(/React\.useState/g, "createSignal")
	}

	/* Step 9: Handle react-redux imports */
	result = result.replace(/^import \{([^}]*)\}\s*from\s*"react-redux"\n/gm, (_match, imports) => {
		const items = imports
			.split(",")
			.map((s: string) => s.trim())
			.filter((s: string) => s !== "" && s !== "Provider" && s !== "useSelector")
		if (items.length === 0) return ""
		return `import { ${items.join(", ")} } from "react-redux"\n`
	})

	/* Step 10: Handle @reduxjs/toolkit imports - remove entirely */
	result = result.replace(/^import \{([^}]*)\}\s*from\s*"@reduxjs\/toolkit"\n/gm, "")

	/* Step 11: Replace <Provider store={store} context={RechartsReduxContext}> */
	result = result.replace(
		/<Provider\s+store=\{(\w+)\}\s+context=\{RechartsReduxContext\}>/g,
		"<RechartsStoreContext.Provider value={{ store: $1.getState(), setStore: $1.setState }}>",
	)
	result = result.replace(/<\/Provider>/g, "</RechartsStoreContext.Provider>")

	/* Step 12: Handle storybook paths -> _data imports */
	/* Depth varies: ../../storybook or ../../../storybook */
	result = result.replace(
		/from\s*"\.\.\/\.\.\/\.\.\/storybook\/stories\/data(?:\/\w+)?"/g,
		`from "../../_data"`,
	)
	result = result.replace(
		/from\s*"\.\.\/\.\.\/storybook\/stories\/data(?:\/\w+)?"/g,
		`from "../_data"`,
	)
	result = result.replace(/from\s*"\.\.\/storybook\/stories\/data(?:\/\w+)?"/g, `from "../_data"`)

	/* Step 13: Wrap render(<JSX>) calls with render(() => <JSX>) for Solid */
	result = wrapRenderCalls(result, "render")

	/* Step 14: Wrap rechartsTestRender(<JSX>) calls similarly */
	result = wrapRenderCalls(result, "rechartsTestRender")

	/* Add JSX pragma if file has JSX */
	if (result.includes("<") && !result.includes("@jsxImportSource")) {
		result = `/* @jsxImportSource solid-js */\n${result}`
	}

	return result
}

/* Convert component files */
for (const file of componentFiles) {
	const srcPath = join(SRC_BASE, file)
	const dstPath = join(DST_BASE, file)

	const dir = dirname(dstPath)
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true })
	}

	const content = readFileSync(srcPath, "utf-8")
	const converted = convertFile(content, file)
	writeFileSync(dstPath, converted)
	console.log(`Converted: ${file}`)
}

console.log("Done!")
