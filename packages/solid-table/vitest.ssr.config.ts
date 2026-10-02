import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vitest/config";

/* Server rendering: node environment, Solid's server build, SSR JSX transform. */
export default defineConfig({
	plugins: [solid({ hot: false, ssr: true })],
	resolve: {
		conditions: ["solid", "node"],
	},
	test: {
		environment: "node",
		include: ["tests/ssr/**/*.test.ts?(x)"],
	},
});
