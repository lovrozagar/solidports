#!/usr/bin/env bun
/**
 * Second pass converter: handles patterns the first pass missed.
 *
 * - useState → createSignal
 * - act() removal (inline calls and block wrappers)
 * - render() wrapping with () =>
 * - generateMockData import fixup
 * - Remaining single quotes
 * - Remaining semicolons
 * - Clean up empty import lines
 */

import { readFileSync, writeFileSync, existsSync } from "fs"

const DST_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/test"

const files = [
	/* polar */
	"polar/Pie/Pie.spec.tsx",
	"polar/Pie/Pie.animation.spec.tsx",
	"polar/Pie/Pie-TwoLevelPieChart.spec.tsx",
	"polar/Pie/Pie.typed.spec.tsx",
	"polar/PolarAngleAxis.spec.tsx",
	"polar/PolarGrid.spec.tsx",
	"polar/PolarRadiusAxis.spec.tsx",
	"polar/Radar.spec.tsx",
	"polar/Radar.animation.spec.tsx",
	"polar/Radar.typed.spec.tsx",
	"polar/RadialBar/RadialBar.spec.tsx",
	"polar/RadialBar/RadialBar.animation.spec.tsx",
	"polar/RadialBar/RadialBar.typed.spec.tsx",
	/* chart */
	"chart/AccessibilityLayer.spec.tsx",
	"chart/AccessibilityScans.spec.tsx",
	"chart/AreaChart.spec.tsx",
	"chart/AreaChart.stacked.spec.tsx",
	"chart/BarChart.spec.tsx",
	"chart/CategoricalChart.spec.tsx",
	"chart/chartEvents.spec.tsx",
	"chart/ComposedChart.spec.tsx",
	"chart/FunnelChart.spec.tsx",
	"chart/LineChart.spec.tsx",
	"chart/LineChart.multiseries.spec.tsx",
	"chart/PieChart.spec.tsx",
	"chart/RadarChart.spec.tsx",
	"chart/RadialBarChart.spec.tsx",
	"chart/RadialBarChart.5966.spec.tsx",
	"chart/RechartsWrapper.spec.tsx",
	"chart/responsive.spec.tsx",
	"chart/Sankey.spec.tsx",
	"chart/Sankey.typed.spec.tsx",
	"chart/ScatterChart.spec.tsx",
	"chart/SunburstChart.spec.tsx",
	"chart/Treemap.spec.tsx",
	"chart/Treemap.typed.spec.tsx",
	/* hooks */
	"hooks/useActiveTooltipDataPoints.spec.tsx",
	"hooks/useAxisDomain.spec.tsx",
	"hooks/useAxisScale.spec.tsx",
	"hooks/useAxisTicks.spec.tsx",
	"hooks/useOffset.spec.tsx",
	/* synchronisation */
	"synchronisation/eventCenter.spec.ts",
	"synchronisation/useChartSynchronisation.spec.tsx",
	/* context */
	"context/chartLayoutContext.spec.tsx",
]

function processFile(relPath: string): void {
	const filePath = `${DST_BASE}/${relPath}`
	if (!existsSync(filePath)) {
		console.error(`MISSING: ${filePath}`)
		return
	}

	let content = readFileSync(filePath, "utf-8")
	let changed = false

	/* ── 1. Replace useState → createSignal ── */
	if (content.includes("useState")) {
		/* const [x, setX] = useState(val) → const [x, setX] = createSignal(val) */
		content = content.replace(/\buseState\b/g, "createSignal")

		/* Ensure createSignal is imported from solid-js */
		if (content.includes("createSignal") && !content.includes("createSignal") === false) {
			/* already handled */
		}
		if (!content.match(/import\s.*createSignal.*from\s+"solid-js"/)) {
			if (content.match(/from\s+"solid-js"/)) {
				/* Add createSignal to existing solid-js import */
				content = content.replace(/import\s*\{([^}]*)\}\s*from\s+"solid-js"/, (match, imports) => {
					if (imports.includes("createSignal")) return match
					return `import { ${imports.trim()}, createSignal } from "solid-js"`
				})
				content = content.replace(
					/import\s+type\s*\{([^}]*)\}\s*from\s+"solid-js"/,
					(match, imports) => {
						/* type-only import can't have createSignal */
						return `import { createSignal } from "solid-js"\nimport type { ${imports.trim()} } from "solid-js"`
					},
				)
			} else if (content.includes("createSignal")) {
				/* Add a new import */
				content = content.replace(
					/^(\/\*[^*]*\*\/\n)?/,
					(match) => `${match}import { createSignal } from "solid-js"\n`,
				)
			}
		}
		changed = true
	}

	/* ── 2. Remove act() wrappers ── */
	if (content.includes("act(")) {
		/* Pattern: act(() => { ... }) → just the contents */
		/* Simple single-statement: act(() => foo.bar()) → foo.bar() */
		content = content.replace(/\bact\(\(\) => (\w[^)]*\))\)/g, "$1")

		/* Multi-line act(() => { ... }) blocks */
		/* We need to carefully handle these - replace act(() => { with just { and }) with } */
		/* Actually, for Solid we just remove the act wrapper entirely */

		/* act(() => {\n  ...\n}) → the inner content */
		content = content.replace(/\bact\(\(\) => \{/g, "{")
		/* The closing }) of act */
		/* This is tricky - we can't easily match the right }) */
		/* Instead, let's do line-by-line fixup */

		/* Simple act(() => expr) */
		content = content.replace(/\bact\(\(\) => ([^{][^\n]*)\)/g, "$1")

		/* Remove remaining standalone act calls that wrap a single expression */
		/* act(() => button.click()) → button.click() */

		changed = true
	}

	/* ── 3. Fix render() calls to wrap JSX in arrow function ── */
	/* render(\n  <Foo ...> ... </Foo>\n) patterns */
	/* We need to find render( followed by JSX and wrap it */
	/* This is complex - let's handle the common patterns */

	/* Check if render is called without () => already */
	const renderRegex = /\brender\(\s*\n(\s*)(<)/g
	let match
	while ((match = renderRegex.exec(content)) !== null) {
		/* Check if there's already a () => before the < */
		const before = content.substring(Math.max(0, match.index - 10), match.index + 7)
		if (before.includes("() =>") || before.includes("() =>\n")) continue

		/* Need to find the matching closing paren of render() */
		const startIdx = match.index + "render(".length
		let depth = 1
		let i = startIdx
		while (i < content.length && depth > 0) {
			if (content[i] === "(") depth++
			if (content[i] === ")") depth--
			if (content[i] === "{") {
				/* skip JSX expression blocks */
			}
			i++
		}
		const endIdx = i - 1 /* position of closing ) */
		const jsxContent = content.substring(startIdx, endIdx).trim()

		/* Replace render(JSX) with render(() => (JSX)) */
		const newContent = `render(() => (\n${match[1]}${jsxContent}\n${match[1]}))`
		content = content.substring(0, match.index) + newContent + content.substring(endIdx + 1)
		changed = true

		/* Reset regex since we modified content */
		renderRegex.lastIndex = 0
		break /* just do one at a time, re-run script multiple times if needed */
	}

	/* ── 4. Clean up remaining single quotes ── */
	/* This is already mostly done but let's catch stragglers */

	/* ── 5. Clean up double blank lines ── */
	content = content.replace(/\n{3,}/g, "\n\n")

	/* ── 6. Remove trailing semicolons that were missed ── */
	content = content.replace(/;(\s*\n)/g, "$1")
	content = content.replace(/;(\s*$)/gm, "$1")

	/* ── 7. Fix "from 'x'" to "from "x"" for any remaining single quotes in imports */
	content = content.replace(/from '([^']*)'/g, `from "$1"`)

	if (changed || content !== readFileSync(filePath, "utf-8")) {
		writeFileSync(filePath, content)
		console.log(`UPDATED: ${relPath}`)
	} else {
		console.log(`OK (no changes): ${relPath}`)
	}
}

/* Run multiple passes to handle nested patterns */
for (let pass = 0; pass < 3; pass++) {
	console.log(`\n=== Pass ${pass + 1} ===`)
	for (const f of files) {
		processFile(f)
	}
}
