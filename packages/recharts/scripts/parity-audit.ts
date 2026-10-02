#!/usr/bin/env bun
/**
 * API parity audit — compares upstream `recharts/src/index.ts` at the pinned tag
 * (`.upstream/pinned.json`) against the
 * Solid port's `src/index.ts`. Emits a machine-readable diff (.parity/report.json)
 * plus a human-readable summary (.kb/parity/report.md).
 *
 * Why: drift between upstream named-exports and the port silently breaks
 * consumer migration (`import { Foo } from "@solidports/recharts"`). The audit
 * runs in CI to catch missing/extra exports before they ship.
 *
 * Approach: ts-morph parses each `index.ts`, walks every ExportDeclaration +
 * ExportSpecifier, builds a {symbol -> kind} map per side. Diff is symbol-name
 * presence + kind (value vs type). Signature drift is intentionally NOT compared
 * here — too noisy across React/Solid framework boundaries (see
 * .kb/parity/divergences.md for the documented framework-equivalent allowlist).
 *
 * Exit non-zero if missing-exports > 0 OR unexpected-extras > 0 (extras allowed
 * via SOLID_INTENTIONAL_ADDITIONS allowlist).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Project, SyntaxKind } from "ts-morph"

const PKG_ROOT = join(import.meta.dir, "..")
const PINNED_TAG: string = JSON.parse(
	readFileSync(join(PKG_ROOT, ".upstream/pinned.json"), "utf8"),
).tag
const UPSTREAM_INDEX = join(PKG_ROOT, `.upstream/cache/recharts-${PINNED_TAG}/src/index.ts`)
const SOLID_INDEX = join(PKG_ROOT, "src/index.ts")
const PARITY_DIR = join(PKG_ROOT, ".parity")
const REPORT_JSON = join(PARITY_DIR, "report.json")
const KB_PARITY_DIR = join(PKG_ROOT, ".kb/parity")
const REPORT_MD = join(KB_PARITY_DIR, "report.md")
const TODO_MD = join(KB_PARITY_DIR, "todo.md")

type ExportKind = "value" | "type"

interface ExportEntry {
	name: string
	alias: string | null
	source: string | null
	kind: ExportKind
}

/* Solid-only additions that are not regressions — framework-specific or
   port-internal helpers that consumers may legitimately need. Justify each
   addition with a one-line note so review can tell intent from leak. */
const SOLID_INTENTIONAL_ADDITIONS: Record<string, string> = {
	_SolidJSXCamelAugmentMarker:
		"Module-augmentation marker; forces JSX camelCase augmentation when the package is imported (no upstream equivalent — Solid-only mechanism).",
}

/* Upstream-only exports that are explicitly NOT yet ported. Documented in
   .upstream/map.json::unported_upstream and surfaced here so the audit
   distinguishes 'deferred' from 'accidentally missing'. Each entry tracked in
   .kb/parity/todo.md with a Phase target. */
const UPSTREAM_DEFERRED: Record<string, string> = {}

function collectExports(filePath: string): ReadonlyArray<ExportEntry> {
	const project = new Project({
		skipAddingFilesFromTsConfig: true,
		skipFileDependencyResolution: true,
		skipLoadingLibFiles: true,
	})
	const src = project.addSourceFileAtPath(filePath)
	const out: ExportEntry[] = []

	for (const decl of src.getExportDeclarations()) {
		const moduleSpec = decl.getModuleSpecifierValue() ?? null
		const declIsTypeOnly = decl.isTypeOnly()
		for (const spec of decl.getNamedExports()) {
			const name = spec.getNameNode().getText()
			const alias = spec.getAliasNode()?.getText() ?? null
			const specIsTypeOnly = spec.isTypeOnly()
			const kind: ExportKind = declIsTypeOnly || specIsTypeOnly ? "type" : "value"
			out.push({
				alias,
				kind,
				name: alias ?? name,
				source: moduleSpec,
			})
		}
	}

	/* Direct exports like `export const Foo = ...` or `export function Foo() {}` —
	   shouldn't appear in either index.ts (both are pure re-export barrels) but
	   capture them for completeness. */
	const exportedDeclarations = src.getExportedDeclarations()
	for (const [name, declarations] of exportedDeclarations) {
		const already = out.some((e) => (e.alias ?? e.name) === name)
		if (already) continue
		const first = declarations[0]
		if (!first) continue
		const isType =
			first.getKind() === SyntaxKind.InterfaceDeclaration ||
			first.getKind() === SyntaxKind.TypeAliasDeclaration
		out.push({
			alias: null,
			kind: isType ? "type" : "value",
			name,
			source: null,
		})
	}

	return out
}

interface DiffResult {
	missing: ReadonlyArray<ExportEntry>
	extras: ReadonlyArray<ExportEntry>
	deferred: ReadonlyArray<ExportEntry>
	common: ReadonlyArray<{ name: string; upstream: ExportKind; solid: ExportKind }>
	kindDrift: ReadonlyArray<{ name: string; upstream: ExportKind; solid: ExportKind }>
}

function diffExports(
	upstream: ReadonlyArray<ExportEntry>,
	solid: ReadonlyArray<ExportEntry>,
): DiffResult {
	const upstreamMap = new Map(upstream.map((e) => [e.name, e]))
	const solidMap = new Map(solid.map((e) => [e.name, e]))

	const missing: ExportEntry[] = []
	const deferred: ExportEntry[] = []
	for (const [name, entry] of upstreamMap) {
		if (solidMap.has(name)) continue
		if (UPSTREAM_DEFERRED[name]) {
			deferred.push(entry)
			continue
		}
		missing.push(entry)
	}

	const extras: ExportEntry[] = []
	for (const [name, entry] of solidMap) {
		if (upstreamMap.has(name)) continue
		if (SOLID_INTENTIONAL_ADDITIONS[name]) continue
		extras.push(entry)
	}

	const common: { name: string; upstream: ExportKind; solid: ExportKind }[] = []
	const kindDrift: { name: string; upstream: ExportKind; solid: ExportKind }[] = []
	for (const [name, up] of upstreamMap) {
		const sd = solidMap.get(name)
		if (!sd) continue
		common.push({ name, solid: sd.kind, upstream: up.kind })
		if (up.kind !== sd.kind) {
			kindDrift.push({ name, solid: sd.kind, upstream: up.kind })
		}
	}

	return { common, deferred, extras, kindDrift, missing }
}

function fmtList(items: ReadonlyArray<ExportEntry>): string {
	if (items.length === 0) return "_(none)_"
	return items.map((e) => `- \`${e.name}\` (${e.kind})${e.source ? ` from \`${e.source}\`` : ""}`).join("\n")
}

function fmtKindDrift(
	items: ReadonlyArray<{ name: string; upstream: ExportKind; solid: ExportKind }>,
): string {
	if (items.length === 0) return "_(none)_"
	return items
		.map((d) => `- \`${d.name}\` — upstream: ${d.upstream}, solid: ${d.solid}`)
		.join("\n")
}

function fmtDeferred(items: ReadonlyArray<ExportEntry>): string {
	if (items.length === 0) return "_(none)_"
	return items
		.map((e) => {
			const note = UPSTREAM_DEFERRED[e.name] ?? ""
			return `- \`${e.name}\` (${e.kind}) — ${note}`
		})
		.join("\n")
}

function buildMarkdown(diff: DiffResult, upstream: number, solid: number): string {
	const status =
		diff.missing.length === 0 && diff.extras.length === 0 && diff.kindDrift.length === 0
			? "PASS"
			: "FAIL"
	const lines = [
		"# @solidports/recharts — API parity report",
		"",
		`Generated: ${new Date().toISOString()}`,
		"",
		`Status: **${status}**`,
		"",
		"## Summary",
		"",
		`- Upstream exports: ${upstream}`,
		`- Solid exports: ${solid}`,
		`- Common: ${diff.common.length}`,
		`- Missing exports: ${diff.missing.length}`,
		`- Unexplained drift: ${diff.kindDrift.length}`,
		`- Deferred (documented unported): ${diff.deferred.length}`,
		`- Extras (Solid-only, allowlisted): ${Object.keys(SOLID_INTENTIONAL_ADDITIONS).length}`,
		`- Extras (Solid-only, unexplained): ${diff.extras.length}`,
		"",
		"## Missing exports",
		"",
		"Symbols upstream exports that the Solid port does not. **Block ship.**",
		"",
		fmtList(diff.missing),
		"",
		"## Kind drift (value vs type)",
		"",
		"Symbols where upstream and Solid disagree on whether the export is a value or a type-only export. Indicates structural drift.",
		"",
		fmtKindDrift(diff.kindDrift),
		"",
		"## Unexplained extras",
		"",
		"Solid exports that have no upstream counterpart and no entry in `SOLID_INTENTIONAL_ADDITIONS`. Investigate before shipping — accidental leak or missing allowlist entry.",
		"",
		fmtList(diff.extras),
		"",
		"## Deferred (documented unported)",
		"",
		"Upstream exports that the port has explicitly chosen not to implement yet. Tracked in `.kb/parity/todo.md` with a target phase.",
		"",
		fmtDeferred(diff.deferred),
		"",
		"## See also",
		"",
		"- `.kb/parity/divergences.md` — documented React→Solid type-equivalents (children, ref, events).",
		"- `.kb/parity/todo.md` — backlog of deferred upstream symbols to port.",
		"- `.parity/report.json` — machine-readable diff for CI.",
		"",
	]
	return lines.join("\n")
}

function buildTodo(deferred: ReadonlyArray<ExportEntry>): string {
	const lines = [
		"# Parity TODO — upstream symbols not yet ported",
		"",
		`Generated: ${new Date().toISOString()}`,
		"",
		"Each entry is intentionally deferred — surface to the audit allowlist (`scripts/parity-audit.ts::UPSTREAM_DEFERRED`) so it doesn't fail CI, and tracked here with rationale and target phase.",
		"",
		"## Deferred exports",
		"",
	]
	if (deferred.length === 0) {
		lines.push("_(none — port has full upstream parity)_")
	} else {
		for (const e of deferred) {
			lines.push(`### \`${e.name}\` (${e.kind})`)
			lines.push("")
			lines.push(`- **Rationale**: ${UPSTREAM_DEFERRED[e.name] ?? "(no rationale recorded)"}`)
			lines.push(
				`- **Upstream source**: \`${e.source ?? "(in-file declaration)"}\``,
			)
			lines.push("- **Target phase**: post-Phase-6 (consumer-app validation first).")
			lines.push("")
		}
	}
	lines.push("")
	return lines.join("\n")
}

function main(): number {
	if (!existsSync(UPSTREAM_INDEX)) {
		console.error(`@solidports/recharts: upstream cache missing at ${UPSTREAM_INDEX}`)
		console.error("Run `bun scripts/sync-upstream.ts fetch` first.")
		return 2
	}
	if (!existsSync(SOLID_INDEX)) {
		console.error(`@solidports/recharts: Solid index missing at ${SOLID_INDEX}`)
		return 2
	}

	const upstream = collectExports(UPSTREAM_INDEX)
	const solid = collectExports(SOLID_INDEX)
	const diff = diffExports(upstream, solid)

	if (!existsSync(PARITY_DIR)) mkdirSync(PARITY_DIR, { recursive: true })
	if (!existsSync(KB_PARITY_DIR)) mkdirSync(KB_PARITY_DIR, { recursive: true })

	const json = {
		generated_at: new Date().toISOString(),
		solid_count: solid.length,
		upstream_count: upstream.length,
		summary: {
			common: diff.common.length,
			deferred: diff.deferred.length,
			extras_unexplained: diff.extras.length,
			kind_drift: diff.kindDrift.length,
			missing: diff.missing.length,
		},
		missing: diff.missing,
		kind_drift: diff.kindDrift,
		extras_unexplained: diff.extras,
		deferred: diff.deferred,
		intentional_additions: SOLID_INTENTIONAL_ADDITIONS,
	}
	writeFileSync(REPORT_JSON, `${JSON.stringify(json, null, 2)}\n`)
	writeFileSync(REPORT_MD, buildMarkdown(diff, upstream.length, solid.length))
	writeFileSync(TODO_MD, buildTodo(diff.deferred))

	const fail =
		diff.missing.length > 0 || diff.extras.length > 0 || diff.kindDrift.length > 0

	console.log(`@solidports/recharts parity audit: ${fail ? "FAIL" : "PASS"}`)
	console.log(`  upstream: ${upstream.length}   solid: ${solid.length}`)
	console.log(`  common: ${diff.common.length}`)
	console.log(`  missing: ${diff.missing.length}`)
	console.log(`  kind drift: ${diff.kindDrift.length}`)
	console.log(`  unexplained extras: ${diff.extras.length}`)
	console.log(`  deferred: ${diff.deferred.length}`)
	console.log(`  reports: ${REPORT_JSON} + ${REPORT_MD}`)

	return fail ? 1 : 0
}

process.exit(main())
