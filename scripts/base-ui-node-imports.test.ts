import { execFileSync } from "node:child_process"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { browserNodeImports, nodeBuiltinImports } from "../packages/base-ui/scripts/node-imports.mjs"

const root = path.resolve(import.meta.dir, "..")
const solid = path.join(root, "packages/base-ui/packages/solid")

describe("browser-run test files import no Node builtin statically", () => {
	test("flags the mount-work guard that failed every browser run (244b3d6d)", () => {
		const source = execFileSync(
			"git",
			["show", "244b3d6d:packages/base-ui/packages/solid/src/utils/native/mountWork.cost.test.tsx"],
			{ cwd: root, encoding: "utf8" },
		)
		expect(nodeBuiltinImports(source)).toEqual(["node:inspector/promises"])
	})

	test("reads static imports, re-exports and side-effect imports, not type-only or dynamic ones", () => {
		const source = [
			"import { readFileSync } from 'node:fs';",
			"import path from 'path';",
			"import 'node:v8';",
			"export { x } from 'node:os';",
			"import type { Session } from 'node:inspector';",
			"const m = await import('node:vm');",
			"import { flush } from 'solid-js';",
			"import {",
			"  a,",
			"  b,",
			"} from 'node:util';",
		].join("\n")
		expect(nodeBuiltinImports(source)).toEqual(["node:fs", "path", "node:v8", "node:os", "node:util"])
	})

	test("no test file a browser run loads imports one", () => {
		expect(browserNodeImports(solid)).toEqual([])
	})
})
