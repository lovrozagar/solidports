import { readdirSync } from "node:fs";
import path from "node:path";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

/* The examples import `@tanstack/solid-table` exactly as upstream writes them. By default that
   resolves to this repo's Solid 2 adapter; `TABLE=upstream` uses the real npm package instead. */
const upstream = process.env.TABLE === "upstream";
const examples = readdirSync(path.join(__dirname, "examples"));

export default defineConfig({
	plugins: [solid()],
	resolve: {
		alias: upstream ? [] : [{ find: /^@tanstack\/solid-table$/, replacement: "@solidports/solid-table" }],
	},
	define: { __TABLE_SOURCE__: JSON.stringify(upstream ? "@tanstack/solid-table (npm)" : "@solidports/solid-table") },
	server: { port: 4120, strictPort: true },
	build: {
		target: "esnext",
		rollupOptions: {
			input: Object.fromEntries([
				["index", path.join(__dirname, "index.html")],
				...examples.map((name) => [name, path.join(__dirname, "examples", name, "index.html")]),
			]),
		},
	},
});
