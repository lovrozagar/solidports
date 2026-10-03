/*
 * Builds the published package with Solid 2's JSX compiler (@solidjs/babel-plugin).
 *
 *   dist/solid/*.jsx   JSX preserved, for the `solid` export condition: the consumer's Solid
 *                      plugin compiles it for its own target (dom / ssr / hydratable).
 *   dist/browser/*.js  generate "dom" for browsers and bundlers without the `solid` condition.
 *   dist/server/*.js   generate "ssr" (hydratable) for node / worker / deno.
 *   dist/types/*.d.ts  declarations.
 *
 * Solid and TanStack stay external: Solid is a peer (a second reactive runtime breaks
 * reactivity) and @tanstack/table-core is a peer the app owns.
 */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import solidBabel from "@solidjs/babel-plugin";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, "dist");
const entries = ["index", "flex-render", "static-functions", "experimental-worker-plugin"];
const external = ["solid-js", "@solidjs/web", "@solidjs/signals", "@tanstack/table-core"];

const shared = {
	absWorkingDir: root,
	bundle: true,
	entryPoints: Object.fromEntries(entries.map((name) => [name, `src/${name}.ts`])),
	external: external.flatMap((name) => [name, `${name}/*`]),
	format: "esm",
	legalComments: "inline",
	logLevel: "warning",
	platform: "neutral",
	splitting: true,
	target: "es2022",
	treeShaking: true,
};

/* Compiles .tsx with the Solid 2 JSX transform, then strips types. */
const solidCompile = (options) => ({
	name: "solid-2",
	setup(builder) {
		builder.onLoad({ filter: /\.tsx$/ }, async (args) => {
			const source = await readFile(args.path, "utf8");
			const result = await transformAsync(source, {
				babelrc: false,
				configFile: false,
				filename: args.path,
				plugins: [[solidBabel, options]],
				presets: [["@babel/preset-typescript", { allExtensions: true, isTSX: true }]],
				sourceMaps: false,
			});
			return { contents: result?.code ?? "", loader: "js" };
		});
	},
});

rmSync(outdir, { force: true, recursive: true });

await Promise.all([
	build({ ...shared, jsx: "preserve", outdir: "dist/solid", outExtension: { ".js": ".jsx" } }),
	build({ ...shared, outdir: "dist/browser", plugins: [solidCompile({ generate: "dom", hydratable: false })] }),
	build({ ...shared, outdir: "dist/server", plugins: [solidCompile({ generate: "ssr", hydratable: true })] }),
]);

execFileSync("tsc", ["-p", "tsconfig.build.json"], { cwd: root, stdio: "inherit" });

console.log("built dist/solid, dist/browser, dist/server, dist/types");
