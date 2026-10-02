import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vitest/config";

/* `test:prod` resolves Solid's production builds, which skip dev-only checks and diagnostics. */
const production = process.env.NODE_ENV === "production";

export default defineConfig({
	plugins: [solid({ hot: false, dev: !production })],
	resolve: {
		conditions: ["solid", production ? "production" : "development", "browser"],
	},
	test: {
		environment: "jsdom",
		include: ["tests/**/*.test.ts?(x)"],
		exclude: ["tests/ssr/**"],
		setupFiles: ["tests/setup.ts"],
	},
});
