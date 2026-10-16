import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { Subprocess } from "bun"

const BASE_UI = resolve(import.meta.dir, "../packages/base-ui")
const cleanup: (() => void)[] = []
afterEach(() => {
	for (const fn of cleanup.splice(0)) fn()
})

function site() {
	const dir = mkdtempSync(join(tmpdir(), "serve-strict-"))
	cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
	mkdirSync(join(dir, "build", "assets"), { recursive: true })
	writeFileSync(join(dir, "build", "index.html"), "<p>app</p>")
	writeFileSync(join(dir, "build", "assets", "a.js"), "export {}")
	writeFileSync(join(dir, "secret.txt"), "secret")
	return dir
}

const freePort = () =>
	new Promise<number>((done) => {
		const probe = createServer().listen(0, "127.0.0.1", () => {
			const { port } = probe.address() as { port: number }
			probe.close(() => done(port))
		})
	})

const hold = (host: string, port: number) =>
	new Promise<Server>((done) => {
		const server = createServer().listen(port, host, () => done(server))
		cleanup.push(() => server.close())
	})

function start(dir: string, port: number): Subprocess<"ignore", "pipe", "pipe"> {
	const child = Bun.spawn(["node", "scripts/serve-strict.mjs", dir, String(port)], {
		cwd: BASE_UI,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	})
	cleanup.push(() => child.kill())
	return child
}

async function ready(port: number) {
	for (let i = 0; i < 50; i += 1) {
		const ok = await fetch(`http://127.0.0.1:${port}/`).then(
			() => true,
			() => false,
		)
		if (ok) return
		await Bun.sleep(100)
	}
	throw new Error("server did not start")
}

describe("serve-strict", () => {
	test("serves the build folder, with the SPA fallback to index.html, on both address families", async () => {
		const port = await freePort()
		start(site(), port)
		await ready(port)
		const asset = await fetch(`http://127.0.0.1:${port}/assets/a.js`)
		expect([asset.status, asset.headers.get("content-type"), await asset.text()]).toEqual([
			200,
			"text/javascript; charset=utf-8",
			"export {}",
		])
		expect(await (await fetch(`http://127.0.0.1:${port}/some/route`)).text()).toBe("<p>app</p>")
		expect(await (await fetch(`http://[::1]:${port}/`)).text()).toBe("<p>app</p>")
		expect(await (await fetch(`http://127.0.0.1:${port}/%2e%2e/secret.txt`)).text()).not.toContain("secret")
	})

	for (const host of ["127.0.0.1", "::1"]) {
		test(`exits 1 naming the port when ${host} already holds it`, async () => {
			const port = await freePort()
			await hold(host, port)
			const child = start(site(), port)
			expect(await child.exited).toBe(1)
			expect((await new Response(child.stderr).text()).trim()).toBe(
				`serve-strict: port ${port} is taken on ${host}; stop that server or wait for it, then rerun`,
			)
		})
	}

	test("the fixed-port test servers use it instead of serve", () => {
		const scripts: Record<string, string> = JSON.parse(readFileSync(join(BASE_UI, "package.json"), "utf8")).scripts
		expect(
			Object.entries(scripts)
				.filter(([, c]) => /\bserve\b.* -p \d+/.test(c))
				.map(([n]) => n),
		).toEqual([])
		expect(
			["test:e2e:server", "test:e2e:solid:server", "test:regressions:server", "test:regressions:solid:server"].map(
				(name) => scripts[name],
			),
		).toEqual([
			"node scripts/serve-strict.mjs test/e2e 5173",
			"node scripts/serve-strict.mjs test/e2e-solid 5173",
			"node scripts/serve-strict.mjs test/regressions 5173",
			"node scripts/serve-strict.mjs test/regressions-solid/solid 5173",
		])
	})
})
