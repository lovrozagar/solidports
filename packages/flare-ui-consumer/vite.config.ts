import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

/* solid-refresh HMR wrap collides with oxc on TS overloads inside
 * @solidports/base-ui. The gallery rarely needs HMR on the headless package. */
export default defineConfig({
	plugins: [solid({ hot: false }), tailwindcss()],
	server: { port: 4100 },
});
