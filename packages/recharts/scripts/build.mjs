/*
 * Builds the published bundles with Solid 2's JSX compiler (@solidjs/babel-plugin).
 *
 *   dist/index.jsx  JSX preserved, for the `solid` export condition: the consumer's Solid
 *                   plugin compiles it for its own target (dom / ssr / hydratable).
 *   dist/index.js   generate "dom" for browsers and bundlers without the `solid` condition.
 *   dist/server.js  generate "ssr" (hydratable) for node / worker / deno.
 *   dist/index.d.ts bundled declarations.
 *
 * Third-party runtime code is inlined, so the package has no `dependencies`. Solid stays
 * external (peers): a second copy of its reactive runtime would break reactivity.
 */
import { rmSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { transformAsync } from "@babel/core"
import solidBabel from "@solidjs/babel-plugin"
import { build } from "esbuild"
import { build as tsupBuild } from "tsup"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outdir = path.join(root, "dist")
const external = ["solid-js", "@solidjs/web", "@solidjs/signals"]

const shared = {
	absWorkingDir: root,
	bundle: true,
	entryPoints: ["src/index.ts"],
	external: external.flatMap((name) => [name, `${name}/*`]),
	format: "esm",
	legalComments: "inline",
	logLevel: "warning",
	mainFields: ["module", "main"],
	platform: "neutral",
	target: "es2022",
	treeShaking: true,
}

/* Compiles .tsx with the Solid 2 JSX transform, then strips types. */
const solidCompile = (options) => ({
	name: "solid-2",
	setup(builder) {
		builder.onLoad({ filter: /\.tsx$/ }, async (args) => {
			const source = await readFile(args.path, "utf8")
			const result = await transformAsync(source, {
				babelrc: false,
				configFile: false,
				filename: args.path,
				plugins: [[solidBabel, options]],
				presets: [["@babel/preset-typescript", { allExtensions: true, isTSX: true }]],
				sourceMaps: false,
			})
			return { contents: result?.code ?? "", loader: "js" }
		})
	},
})

rmSync(outdir, { force: true, recursive: true })

await Promise.all([
	build({ ...shared, jsx: "preserve", outfile: "dist/index.jsx", outExtension: { ".js": ".jsx" } }),
	build({ ...shared, outfile: "dist/index.js", plugins: [solidCompile({ generate: "dom", hydratable: false })] }),
	build({ ...shared, outfile: "dist/server.js", plugins: [solidCompile({ generate: "ssr", hydratable: true })] }),
])

await tsupBuild({
	clean: false,
	dts: { only: true, resolve: true },
	entry: { index: "src/index.ts" },
	external,
	format: ["esm"],
	outDir: outdir,
	silent: true,
	tsconfig: path.join(root, "tsconfig.json"),
})

console.log("built dist/index.jsx, dist/index.js, dist/server.js, dist/index.d.ts")
