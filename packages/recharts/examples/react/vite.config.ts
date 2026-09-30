import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5184,
		strictPort: true,
	},
	preview: {
		port: 5184,
		strictPort: true,
	},
})
