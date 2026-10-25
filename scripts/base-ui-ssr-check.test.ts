import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { type Browser, chromium } from "playwright"
import {
	checkInteraction,
	checkMode,
	checkSummary,
	summaryMismatches,
	TTI_TIMEOUT_MS,
} from "../packages/base-ui/test/perf-solid/ssr/interact.mjs"

const hasChromium = existsSync(chromium.executablePath())

/** The SSR check's interaction for a checkbox: click it, see it checked, click it back. */
const INTERACTION = {
	trigger: '[role="checkbox"]',
	effect: { attribute: "aria-checked", value: "true" },
	undo: "toggle",
}

/**
 * A checkbox page: an empty `<span role="checkbox">` that toggles on click. Unstyled, it is a 0x0
 * box no click can hit, as an unchecked Checkbox.Root was in the SSR bench's checkbox/1000.
 */
function page({ box, error }: { box: boolean; error?: boolean }) {
	const style = box ? "<style>[role='checkbox'] { display: inline-block; width: 16px; height: 16px; }</style>" : ""
	const toggle = `const el = document.querySelector('[role="checkbox"]');
		el.addEventListener('click', () => el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true')));`
	return `<!doctype html><html><head>${style}</head><body>
		<span role="checkbox" aria-checked="false"></span>
		<script>${toggle}${error ? "throw new Error('fixture failure');" : ""}</script>
	</body></html>`
}

const PAGES: Record<string, string> = {
	"/dead": page({ box: false }),
	"/live": page({ box: true }),
	"/error": page({ box: true, error: true }),
}

describe.skipIf(!hasChromium)("the SSR interaction check (Chromium)", () => {
	let browser: Browser
	let server: Server
	let origin: string
	beforeAll(async () => {
		server = createServer((req, res) => {
			const body = PAGES[req.url ?? ""]
			res.writeHead(body ? 200 : 404, { "content-type": "text/html" }).end(body ?? "")
		})
		await new Promise<void>((resolve) => server.listen(0, resolve))
		origin = `http://localhost:${(server.address() as AddressInfo).port}`
		browser = await chromium.launch()
	}, 30_000)
	afterAll(async () => {
		await browser?.close()
		server?.close()
	}, 30_000)

	test("a dead 0x0 trigger fails the check within about 10 seconds", async () => {
		const started = Date.now()
		const problems = await checkInteraction(browser, `${origin}/dead`, INTERACTION)
		const elapsed = Date.now() - started
		expect(problems).toHaveLength(1)
		expect(problems[0]).toContain("trigger never became interactive")
		expect(elapsed).toBeGreaterThanOrEqual(TTI_TIMEOUT_MS)
		expect(elapsed).toBeLessThan(TTI_TIMEOUT_MS + 10_000)
	}, 30_000)

	test("a trigger that responds passes, with nothing timed against anything", async () => {
		expect(await checkInteraction(browser, `${origin}/live`, INTERACTION)).toEqual([])
	}, 30_000)

	test("a page error fails the check even when the click lands", async () => {
		const problems = await checkInteraction(browser, `${origin}/error`, INTERACTION)
		expect(problems).toHaveLength(1)
		expect(problems[0]).toContain("pageerror: Error: fixture failure")
	}, 30_000)
})

describe("the SSR interaction check's verdict", () => {
	test("a measured run without a TTI fails the check", async () => {
		const page = { close: async () => {}, on: () => {} }
		const measure = async () => ({ ttiMs: Number.NaN, page })
		const problems = await checkInteraction({} as Browser, "http://localhost/", INTERACTION, { measure })
		expect(problems).toEqual(["no TTI measured"])
	})

	test("SSR_CHECK selects Chromium or WebKit; unset is a measured run; anything else is refused", () => {
		expect(checkMode({})).toBeNull()
		expect(checkMode({ SSR_CHECK: "chromium" })).toBe("chromium")
		expect(checkMode({ SSR_CHECK: "webkit" })).toBe("webkit")
		expect(() => checkMode({ SSR_CHECK: "firefox" })).toThrow("SSR_CHECK")
	})
})

describe("the SSR interaction check's summary", () => {
	const checked = [
		{ key: "checkbox/1000", name: "react" },
		{ key: "checkbox/1000", name: "solid" },
		{ key: "menu/page", name: "react" },
		{ key: "menu/page", name: "solid" },
	]

	test("one line per case and library checked, then the counts; problems fail it", () => {
		const problems = ["checkbox/1000 [solid, chromium] trigger never became interactive: no click took effect"]
		expect(checkSummary(checked, "chromium", problems)).toEqual({
			lines: [
				"checkbox/1000 [react, chromium] ok",
				"checkbox/1000 [solid, chromium] FAIL",
				"menu/page [react, chromium] ok",
				"menu/page [solid, chromium] ok",
				"SSR check: 2 cases × 2 libraries, 1 problem",
			],
			code: 1,
		})
		expect(checkSummary(checked, "chromium", [])).toMatchObject({ code: 0 })
		expect(checkSummary(checked, "chromium", []).lines.at(-1)).toBe("SSR check: 2 cases × 2 libraries, 0 problems")
	})

	test("a check that checked nothing fails, so an empty run cannot read as a pass", () => {
		expect(checkSummary([], "chromium", [])).toEqual({
			lines: ["SSR check: 0 cases checked (no case matched); nothing was checked"],
			code: 1,
		})
	})
})

describe("the SSR check's hydrated DOM summary", () => {
	// tabs/200 on 3f844320: the server-native Tabs.Panel left the panel unclaimed, so no tab ended up
	// labelled. The check ran only interactive cases then, and passed (CI run 40162124626 went red).
	const react = { nodes: 205, expanded: 0, checkboxes: 0, dialog: 0, tabsSelected: 1, labelled: 1 }
	const variants = (solid: object) => [
		{ name: "react", lib: "react", summary: react },
		{ name: "solid", lib: "solid", summary: solid },
	]

	test("a summary that differs from React's is a mismatch, named for its variant", () => {
		expect(summaryMismatches(undefined, variants({ ...react, labelled: 0 }))).toEqual([
			{
				name: "solid",
				message: `hydrated DOM differs: react ${JSON.stringify(react)} ≠ solid ${JSON.stringify({ ...react, labelled: 0 })}`,
			},
		])
	})

	test("the same summary is none", () => {
		expect(summaryMismatches(undefined, variants({ ...react }))).toEqual([])
	})
})
