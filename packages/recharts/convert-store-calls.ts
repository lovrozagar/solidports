import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const DST_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/test/state"

const files = [
	"selectors/containerSelectors.spec.tsx",
	"selectors/selectDisplayedData.spec.tsx",
	"selectors/selectAxisRangeWithReverse.spec.tsx",
	"selectors/selectors.spec.tsx",
	"selectors/rootPropsSelectors.spec.tsx",
	"selectors/selectAxisScale.spec.tsx",
	"selectors/axisSelectors.spec.tsx",
]

function replaceStoreDispatch(content: string): string {
	let result = ""
	let i = 0
	while (i < content.length) {
		const marker = "store.dispatch("
		const idx = content.indexOf(marker, i)
		if (idx === -1) {
			result += content.slice(i)
			break
		}
		result += content.slice(i, idx)

		let depth = 1
		let j = idx + marker.length
		while (j < content.length && depth > 0) {
			if (content[j] === "(") depth++
			if (content[j] === ")") depth--
			j++
		}
		let innerContent = content.slice(idx + marker.length, j - 1).trim()
		/* Remove trailing comma if present */
		if (innerContent.endsWith(",")) {
			innerContent = innerContent.slice(0, -1).trimEnd()
		}
		result += `${innerContent}(setStore, store)`
		i = j
	}
	return result
}

for (const file of files) {
	const path = join(DST_BASE, file)
	let content = readFileSync(path, "utf-8")

	/* We need to re-read from original source, reconvert, and apply store fixes fresh */
	/* Actually, the first pass was already applied. Let's just re-read the original, apply first pass + store fixes */
	const srcBase = "/home/ecomet/Development/monorepo/public/recharts-solid/recharts-main/test/state"
	const srcPath = join(srcBase, file)
	let src = readFileSync(srcPath, "utf-8")

	/* Apply the first-pass conversions */
	src = src.replace(/'/g, '"')
	src = src.replace(/\s*\/\/\s*@ts-expect-error[^\n]*/g, "")
	src = src.replace(/\s*\/\/\s*@ts-ignore[^\n]*/g, "")
	src = src.replace(/;(\s*\n)/g, "$1")
	src = src.replace(/;(\s*$)/gm, "$1")
	src = src.replace(/^import React from "react"\n/gm, "")
	src = src.replace(/^import \* as React from "react"\n/gm, "")
	src = src.replace(
		/^import React,\s*\{([^}]*)\}\s*from\s*"react"\n/gm,
		(_m: string, imports: string) => {
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s !== "")
			const solidItems: string[] = []
			for (const item of items) {
				if (item === "useState") solidItems.push("createSignal")
				else if (item !== "ReactNode" && item !== "ReactElement") solidItems.push(item)
			}
			return solidItems.length ? `import { ${solidItems.join(", ")} } from "solid-js"\n` : ""
		},
	)
	src = src.replace(/^import \{([^}]*)\}\s*from\s*"react"\n/gm, (_m: string, imports: string) => {
		const items = imports
			.split(",")
			.map((s: string) => s.trim())
			.filter((s: string) => s !== "")
		const solidItems: string[] = []
		for (const item of items) {
			if (item === "useState") solidItems.push("createSignal")
			else if (item !== "ReactNode" && item !== "ReactElement") solidItems.push(item)
		}
		return solidItems.length ? `import { ${solidItems.join(", ")} } from "solid-js"\n` : ""
	})
	src = src.replace(/\bReactNode\b/g, "JSX.Element")
	src = src.replace(/\bReactElement\b/g, "JSX.Element")
	src = src.replace(
		/^import \{([^}]*)\}\s*from\s*"@testing-library\/react"\n/gm,
		(_m: string, imports: string) => {
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s !== "" && s !== "act")
			return items.length ? `import { ${items.join(", ")} } from "@solidjs/testing-library"\n` : ""
		},
	)
	src = src.replace(/\bact\(\(\) => \{([^}]*)\}\)/gs, (_m: string, inner: string) => inner.trim())
	if (src.includes("React.useState")) {
		src = src.replace(/React\.useState/g, "createSignal")
	}
	src = src.replace(
		/^import \{([^}]*)\}\s*from\s*"react-redux"\n/gm,
		(_m: string, imports: string) => {
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s !== "" && s !== "Provider" && s !== "useSelector")
			return items.length ? `import { ${items.join(", ")} } from "react-redux"\n` : ""
		},
	)
	src = src.replace(/^import \{([^}]*)\}\s*from\s*"@reduxjs\/toolkit"\n/gm, "")
	src = src.replace(/<\/Provider>/g, "</RechartsStoreContext.Provider>")

	/* Now apply store-specific conversions */
	src = src.replace(
		/const store = createRechartsStore\(\)/g,
		"const [store, setStore] = createRechartsStore()",
	)
	src = src.replace(
		/const store = createRechartsStore\((\w+)\)/g,
		"const [store, setStore] = createRechartsStore($1)",
	)
	src = src.replace(/store\.getState\(\)/g, "store")
	src = replaceStoreDispatch(src)

	/* Add createSignal import if needed */
	if (src.includes("createSignal") && !src.match(/import.*createSignal.*from "solid-js"/)) {
		src = `import { createSignal } from "solid-js"\n${src}`
	}

	writeFileSync(path, src)
	console.log(`Re-converted: ${file}`)
}

console.log("Done!")
