import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const dirname =
	typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url))

const ASSETS_DIR = path.resolve(
	dirname,
	"../../examples/basic/dist/assets",
)

const MAX_BYTES = 450 * 1024

describe("bundle size — T5", () => {
	test("examples/basic index bundle <= 450KB", () => {
		if (!existsSync(ASSETS_DIR)) {
			console.log(
				"examples/basic/dist/assets not found — run `cd examples/basic && bun run build` first, skipping",
			)
			return
		}

		const filename = readdirSync(ASSETS_DIR).find(
			(f) => f.startsWith("index-") && f.endsWith(".js"),
		)

		if (filename == null) {
			console.log("No index-*.js found in dist/assets, skipping bundle size check")
			return
		}

		const bundlePath = path.join(ASSETS_DIR, filename)
		const { size } = statSync(bundlePath)

		console.log(
			`T5 bundle: ${filename} = ${(size / 1024).toFixed(1)}KB (limit: ${MAX_BYTES / 1024}KB)`,
		)

		expect(size).toBeLessThanOrEqual(MAX_BYTES)
	})
})
