import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vitest/config";

/* Hydration: server HTML (rendered in Node by each test) hydrated in jsdom. The client code is
   compiled hydratable, as an SSR app's client bundle is; the plugin's test posture is
   non-hydratable, so `solid.hydratable` overrides it. */
export default defineConfig({
	plugins: [solid({ hot: false, solid: { hydratable: true }, ssr: true })],
	resolve: {
		conditions: ["solid", "development", "browser"],
	},
	test: {
		environment: "jsdom",
		include: ["tests/hydration/**/*.test.ts?(x)"],
		setupFiles: ["tests/setup.ts"],
	},
});
