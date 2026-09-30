import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"

const SRC_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/recharts-main/test/state"
const DST_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/test/state"

const selectorFiles = [
	"selectors/areaSelectors.spec.tsx",
	"selectors/axisSelectors.spec.tsx",
	"selectors/barStackSelectors.spec.tsx",
	"selectors/brushSelectors.spec.tsx",
	"selectors/containerSelectors.spec.tsx",
	"selectors/dataSelectors.spec.tsx",
	"selectors/legendSelectors.spec.tsx",
	"selectors/lineSelectors.spec.tsx",
	"selectors/pieSelectors.spec.tsx",
	"selectors/radarSelectors.spec.tsx",
	"selectors/radialBarSelectors.spec.tsx",
	"selectors/rootPropsSelectors.spec.tsx",
	"selectors/scatterSelectors.spec.tsx",
	"selectors/selectActiveTooltipIndex.spec.tsx",
	"selectors/selectAllAxes.spec.tsx",
	"selectors/selectAxisDomainIncludingNiceTicks.spec.tsx",
	"selectors/selectAxisDomain.spec.tsx",
	"selectors/selectAxisRangeWithReverse.spec.tsx",
	"selectors/selectAxisScale.spec.tsx",
	"selectors/selectBarRectangles.stackOffset.spec.tsx",
	"selectors/selectBaseAxis.spec.tsx",
	"selectors/selectCartesianItemsSettings.spec.tsx",
	"selectors/selectChartOffset.spec.tsx",
	"selectors/selectDisplayedData.spec.tsx",
	"selectors/selectIsTooltipActive.spec.tsx",
	"selectors/selectNumericalDomain.spec.tsx",
	"selectors/selectors.spec.tsx",
	"selectors/selectRealScaleType.spec.tsx",
	"selectors/selectStackGroups.spec.tsx",
	"selectors/selectXAxisPosition.spec.tsx",
	"selectors/selectYAxisPosition.spec.tsx",
	"hooks.spec.tsx",
	"redux-nesting.spec.tsx",
]

function convertFile(content: string, filename: string): string {
	let result = content

	/* Step 1: Single quotes to double quotes FIRST (before any other transforms) */
	result = result.replace(/'/g, '"')

	/* Step 2: Remove @ts-expect-error and @ts-ignore comments */
	result = result.replace(/\s*\/\/\s*@ts-expect-error[^\n]*/g, "")
	result = result.replace(/\s*\/\/\s*@ts-ignore[^\n]*/g, "")

	/* Step 3: Remove semicolons at end of statements (but not inside for loops, etc) */
	result = result.replace(/;(\s*\n)/g, "$1")
	result = result.replace(/;(\s*$)/gm, "$1")

	/* Step 4: Handle React imports */
	/* Remove: import React from "react" */
	result = result.replace(/^import React from "react"\n/gm, "")
	/* Remove: import * as React from "react" */
	result = result.replace(/^import \* as React from "react"\n/gm, "")
	/* Handle: import React, { useState, ReactNode } from "react" */
	result = result.replace(
		/^import React,\s*\{([^}]*)\}\s*from\s*"react"\n/gm,
		(_match, imports) => {
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s !== "")
			const solidItems: string[] = []
			const removedItems = new Set(["ReactNode", "ReactElement"])
			for (const item of items) {
				if (item === "useState") {
					solidItems.push("createSignal")
				} else if (!removedItems.has(item)) {
					solidItems.push(item)
				}
			}
			if (solidItems.length === 0) return ""
			return `import { ${solidItems.join(", ")} } from "solid-js"\n`
		},
	)
	/* Handle: import { useState, ReactNode } from "react" */
	result = result.replace(/^import \{([^}]*)\}\s*from\s*"react"\n/gm, (_match, imports) => {
		const items = imports
			.split(",")
			.map((s: string) => s.trim())
			.filter((s: string) => s !== "")
		const solidItems: string[] = []
		const removedItems = new Set(["ReactNode", "ReactElement"])
		for (const item of items) {
			if (item === "useState") {
				solidItems.push("createSignal")
			} else if (!removedItems.has(item)) {
				solidItems.push(item)
			}
		}
		if (solidItems.length === 0) return ""
		return `import { ${solidItems.join(", ")} } from "solid-js"\n`
	})

	/* Step 5: Replace ReactNode/ReactElement type references */
	result = result.replace(/\bReactNode\b/g, "JSX.Element")
	result = result.replace(/\bReactElement\b/g, "JSX.Element")

	/* Step 6: Handle @testing-library/react -> @solidjs/testing-library */
	/* First, handle imports that include act */
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
	/* Handle case where only act was imported */
	result = result.replace(/^import \{\s*act\s*\}\s*from\s*"@testing-library\/react"\n/gm, "")

	/* Step 7: Remove act() wrappers - keep the inner content */
	result = result.replace(/\bact\(\(\) => \{([^}]*)\}\)/gs, (_match, inner) => {
		return inner.trim()
	})

	/* Step 8: Handle React.useState -> createSignal */
	if (result.includes("React.useState")) {
		result = result.replace(/React\.useState/g, "createSignal")
		/* Add createSignal import if not already there */
		if (
			!result.includes("createSignal") ||
			!result.match(/import.*createSignal.*from "solid-js"/)
		) {
			if (result.match(/from "solid-js"/)) {
				result = result.replace(/import \{([^}]*)\} from "solid-js"/, (_match, imports) => {
					if (!imports.includes("createSignal")) {
						return `import { ${imports.trim()}, createSignal } from "solid-js"`
					}
					return _match
				})
			} else {
				result = `import { createSignal } from "solid-js"\n${result}`
			}
		}
	}

	/* Also handle bare useState -> createSignal (from import conversion) */
	if (result.includes("createSignal") && !result.match(/import.*createSignal.*from "solid-js"/)) {
		result = `import { createSignal } from "solid-js"\n${result}`
	}

	/* Step 9: Handle react-redux imports */
	/* Remove Provider import from react-redux */
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

	/* Step 12: Handle Selector type from @reduxjs/toolkit */
	/* Only replace the type import, not all occurrences of "Selector" */
	result = result.replace(/^import \{\s*Selector\s*\}\s*from\s*"@reduxjs\/toolkit"\n/gm, "")

	/* Step 13: Handle storybook path - there is no storybook in our port */
	/* Keep the import path as is, assuming the data file will be ported */

	return result
}

for (const file of selectorFiles) {
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
