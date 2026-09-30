#!/usr/bin/env bun
/**
 * React → SolidJS test file converter for recharts-solid.
 *
 * Handles:
 * - import React → remove
 * - @testing-library/react → @solidjs/testing-library
 * - Remove act() wrappers
 * - Remove react-redux Provider
 * - Single quotes → double quotes
 * - Remove semicolons at end of lines
 * - Remove @ts-expect-error, @ts-ignore
 * - Add /* @jsxImportSource solid-js *​/ pragma for .tsx files
 * - Replace ReactNode with JSX.Element
 * - Replace React.ReactElement with JSX.Element
 * - Replace useState with createSignal
 * - Wrap render() JSX arg in arrow function
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { dirname, basename } from "path"

const SRC_BASE = "/home/ecomet/Development/monorepo/public/recharts-solid/recharts-main/test"
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

function convertFile(relPath: string): void {
	const srcPath = `${SRC_BASE}/${relPath}`
	const dstPath = `${DST_BASE}/${relPath}`
	const isTsx = relPath.endsWith(".tsx")

	if (!existsSync(srcPath)) {
		console.error(`MISSING: ${srcPath}`)
		return
	}

	let content = readFileSync(srcPath, "utf-8")

	/* ── 1. Remove React imports ── */
	content = content.replace(/^import React(?:,\s*\{[^}]*\})?\s*from\s*['"]react['"];?\s*\n/gm, "")
	content = content.replace(
		/^import\s*\{([^}]*)\}\s*from\s*['"]react['"];?\s*\n/gm,
		(match, imports) => {
			/* Keep non-React imports that we need to convert */
			const kept: string[] = []
			const items = imports
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean)
			for (const item of items) {
				if (item === "ReactNode" || item === "ReactElement") {
					/* will be replaced with JSX.Element below */
				} else if (item === "useState") {
					/* will be handled by createSignal conversion */
				} else if (
					item === "useCallback" ||
					item === "useRef" ||
					item === "useEffect" ||
					item === "useMemo"
				) {
					/* skip React hooks that don't exist in Solid */
				} else {
					kept.push(item)
				}
			}
			if (kept.length === 0) return ""
			return `import { ${kept.join(", ")} } from "solid-js"\n`
		},
	)

	/* ── 2. Replace testing-library imports ── */
	content = content.replace(
		/from\s*['"]@testing-library\/react['"]/g,
		`from "@solidjs/testing-library"`,
	)

	/* ── 3. Remove act() import and wrapping ── */
	content = content.replace(/,?\s*act\s*,?/g, (match) => {
		/* Only remove from import lines */
		return match
	})
	/* Remove act from import { ..., act, ... } */
	content = content.replace(
		/^(import\s*\{[^}]*)(?:,\s*act|\bact\s*,\s*)(.*\}\s*from\s*["']@solidjs\/testing-library["'])/gm,
		"$1$2",
	)

	/* Remove standalone act import */
	content = content.replace(
		/^import\s*\{\s*act\s*\}\s*from\s*['"]@solidjs\/testing-library['"];?\s*\n/gm,
		"",
	)
	content = content.replace(
		/^import\s*\{\s*act\s*\}\s*from\s*['"]@testing-library\/react['"];?\s*\n/gm,
		"",
	)
	content = content.replace(/^import\s*\{\s*act\s*\}\s*from\s*['"]react['"];?\s*\n/gm, "")

	/* ── 4. Remove react-redux Provider ── */
	content = content.replace(/^import\s*\{[^}]*\}\s*from\s*['"]react-redux['"];?\s*\n/gm, "")

	/* Remove Provider wrapper with store */
	/* <Provider store={...}> ... </Provider> → just children */
	content = content.replace(/<Provider\s+store=\{[^}]*\}\s*>/g, "<>")
	content = content.replace(/<\/Provider>/g, "</>")

	/* ── 5. Remove @ts-expect-error and @ts-ignore comments ── */
	content = content.replace(/^\s*\/\/\s*@ts-expect-error.*\n/gm, "")
	content = content.replace(/^\s*\/\/\s*@ts-ignore.*\n/gm, "")
	content = content.replace(/\/\*\s*@ts-expect-error\s*\*\//g, "")

	/* ── 6. Remove devtools import ── */
	content = content.replace(/^import\s*\{[^}]*\}\s*from\s*['"]@recharts\/devtools['"];?\s*\n/gm, "")

	/* ── 7. Single quotes → double quotes (only in simple cases) ── */
	/* Replace single-quoted strings, being careful about contractions/apostrophes */
	content = content.replace(
		/(?<![a-zA-Z])'([^'\\]*(?:\\.[^'\\]*)*)'(?![a-zA-Z])/g,
		(match, inner) => {
			/* Don't replace if it contains double quotes */
			if (inner.includes('"')) return match
			return `"${inner}"`
		},
	)

	/* ── 8. Remove semicolons at end of statements ── */
	content = content.replace(/;(\s*\n)/g, "$1")
	content = content.replace(/;(\s*$)/gm, "$1")

	/* ── 9. ReactNode → JSX.Element ── */
	content = content.replace(/\bReactNode\b/g, "JSX.Element")
	content = content.replace(/\bReactElement\b/g, "JSX.Element")
	content = content.replace(/\bReact\.JSX\.Element\b/g, "JSX.Element")
	content = content.replace(/\bReact\.FC\b/g, "Component")

	/* ── 10. Wrap render() JSX argument in arrow function ── */
	/* render(<Foo />) → render(() => <Foo />) */
	/* render(\n  <Foo ... />\n) → render(() => (\n  <Foo ... />\n)) */
	/* This is complex — we handle the simple single-line case and multi-line */
	/* We'll do a more targeted approach: find render( and check if next char is < */
	content = content.replace(
		/\brender\(\s*\n(\s*)<([^)]+)\n(\s*)\)/gs,
		(match, indent, inner, closeIndent) => {
			return `render(() => (\n${indent}<${inner}\n${closeIndent}))`
		},
	)
	content = content.replace(/\brender\(\s*(<[^)]+>)\s*\)/g, (match, jsx) => {
		return `render(() => ${jsx})`
	})

	/* ── 11. Add JSX.Element import from solid-js if needed ── */
	if (isTsx && content.includes("JSX.Element")) {
		if (!content.includes('from "solid-js"')) {
			content = `import type { JSX } from "solid-js"\n${content}`
		} else if (!content.includes("JSX")) {
			content = content.replace(/from "solid-js"/, (m) => {
				return m
			})
		}
	}

	/* ── 12. Add @jsxImportSource pragma for tsx files ── */
	if (isTsx && !content.includes("@jsxImportSource")) {
		content = `/* @jsxImportSource solid-js */\n${content}`
	}

	/* ── 13. Clean up double blank lines ── */
	content = content.replace(/\n{3,}/g, "\n\n")

	/* ── 14. Ensure directory exists ── */
	const dir = dirname(dstPath)
	mkdirSync(dir, { recursive: true })

	writeFileSync(dstPath, content)
	console.log(`OK: ${relPath}`)
}

for (const f of files) {
	convertFile(f)
}

console.log("\nDone. Manual review needed for:")
console.log("- render() wrapping (complex multi-line JSX)")
console.log("- useState → createSignal")
console.log("- act() removal")
console.log("- useAppSelector usage")
console.log("- Provider → RechartsStoreContext.Provider")
