import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

/** Renders a server entry (`export function render(): string`) with Solid's SSR transform. */
export async function serverRender(entry: string): Promise<string> {
	const server = await createServer({
		appType: "custom",
		cacheDir: join(tmpdir(), "solid-table-ssr-fixtures"),
		configFile: false,
		logLevel: "silent",
		optimizeDeps: { noDiscovery: true },
		plugins: [solid({ ssr: true, hot: false }) as never],
		root: resolve(here, "../.."),
		server: { hmr: false, middlewareMode: true, watch: null },
	});
	try {
		const mod = (await server.ssrLoadModule(resolve(here, entry))) as { render: () => string };
		return mod.render();
	} finally {
		await server.close();
	}
}
