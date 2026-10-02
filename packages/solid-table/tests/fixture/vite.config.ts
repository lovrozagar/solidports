import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [solid()],
	server: { port: 4110, strictPort: true },
	preview: { port: 4111, strictPort: true },
});
