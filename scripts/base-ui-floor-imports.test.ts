import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// D31: the raw-Solid floors are hand-written plain Solid and belong to the bench harness, which
// takes them from the working tree for every variant. An import of the library (its source by a
// relative path, or a package of this repo) would make a floor depend on the code it is the floor
// for, and a baseline older than that code could not build against it.
const floor = join(import.meta.dir, "../packages/base-ui/packages/solid/test/floor")
const specifiers = (source: string) =>
	[...source.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1] as string)

describe("raw-Solid floors", () => {
	test("import nothing from the library, only each other and plain packages", () => {
		const offending: string[] = []
		for (const file of readdirSync(floor)) {
			if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue
			for (const specifier of specifiers(readFileSync(join(floor, file), "utf8"))) {
				const relativeOut = specifier.startsWith(".") && !specifier.startsWith("./")
				const ownPackage = /^@(?:solidports|base-ui)\//.test(specifier)
				if (relativeOut || ownPackage) offending.push(`${file}: ${specifier}`)
			}
		}
		expect(offending).toEqual([])
	})
})
