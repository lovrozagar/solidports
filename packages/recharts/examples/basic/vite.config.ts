import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import solid from "@solidjs/vite-plugin"

export default defineConfig({
	plugins: [solid()],
	/* Develop against the library source; the published `solid` condition points at the built dist. */
	resolve: {
		alias: {
			"@solidports/recharts": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
		},
	},
	server: {
		port: 5183,
		strictPort: true,
	},
	preview: {
		port: 5183,
		strictPort: true,
	},
})
