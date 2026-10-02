import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "@solidjs/vite-plugin"

export default defineConfig({
	plugins: [solid(), tailwindcss()],
	server: {
		port: 5185,
		strictPort: true,
	},
	preview: {
		port: 5185,
		strictPort: true,
	},
})
