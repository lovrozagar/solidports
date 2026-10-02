import { defineConfig } from "vite"
import solid from "@solidjs/vite-plugin"

export default defineConfig({
	plugins: [solid()],
	server: {
		port: 5183,
		strictPort: true,
	},
	preview: {
		port: 5183,
		strictPort: true,
	},
})
