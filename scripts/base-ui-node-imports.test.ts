import path from "node:path"
import { describe, expect, test } from "bun:test"
import { browserNodeImports, nodeBuiltinImports } from "../packages/base-ui/scripts/node-imports.mjs"

const solid = path.resolve(import.meta.dir, "../packages/base-ui/packages/solid")

describe("browser-run test files import no Node builtin statically", () => {
	test("flags the mount-work guard that failed every browser run (244b3d6d)", () => {
		// The guard's imports as they stood at 244b3d6d (`utils/native/mountWork.cost.test.tsx`), held
		// here: CI checks out one commit, so the test cannot read that one from git.
		const source = [
			"import { Session } from 'node:inspector/promises';",
			"import { flush } from 'solid-js';",
			"import { render } from '@solidjs/web';",
			"import { afterEach, describe, expect, it } from 'vitest';",
			"import { Button } from '@solidports/base-ui/button';",
		].join("\n")
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
