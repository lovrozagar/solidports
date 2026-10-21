import { describe, expect, test } from "bun:test"
import { diagFromEnv, withDiag, writeDiag } from "../packages/base-ui/test/perf-solid/shared/diag.mjs"

/** A CDP session stand-in: records each command, and replays trace events when tracing ends. */
function fakeCdp(events: object[] = []) {
	const sent: string[] = []
	const handlers = new Map<string, ((payload: any) => void)[]>()
	const on = (name: string, handler: (payload: any) => void) => {
		handlers.set(name, [...(handlers.get(name) ?? []), handler])
	}
	const emit = (name: string, payload: unknown) => {
		for (const handler of handlers.get(name) ?? []) handler(payload)
	}
	return {
		sent,
		on,
		once: on,
		off: (name: string, handler: (payload: any) => void) => {
			handlers.set(
				name,
				(handlers.get(name) ?? []).filter((h) => h !== handler),
			)
		},
		async send(method: string) {
			sent.push(method)
			if (method === "Tracing.end") {
				emit("Tracing.dataCollected", { value: events })
				emit("Tracing.tracingComplete", {})
			}
			return {}
		},
	}
}

/** A step that resolves at once. */
const open = async () => "opened"

describe("bench step diagnostics", () => {
	test("are off unless TRACE_STEP or PROFILE_STEP names a step", () => {
		expect(diagFromEnv({})).toBeUndefined()
		expect(diagFromEnv({ TRACE_STEP: "menu/500 › open" })?.trace).toBe("menu/500 › open")
	})

	test("an unnamed step runs once, untouched, and writes nothing", async () => {
		const cdp = fakeCdp()
		const written: string[] = []
		const fs = { writeFileSync: (file: string) => written.push(file) }
		let calls = 0
		const step = async () => {
			calls += 1
			return "result"
		}
		expect(await withDiag(undefined, cdp, "cur", "menu/500 › open", step)).toBe("result")
		const diag = diagFromEnv({ TRACE_STEP: "menu/500 › close" })
		expect(await withDiag(diag, cdp, "cur", "menu/500 › open", step)).toBe("result")
		expect(calls).toBe(2)
		expect(cdp.sent).toEqual([])
		writeDiag(undefined, fs)
		expect(written).toEqual([])
	})

	test("the traced step's events are summed per variant and averaged per run", async () => {
		const cdp = fakeCdp([
			{ name: "Layout", ph: "X", dur: 2000, tid: 1 },
			{ name: "MinorGC", ph: "B", ts: 1000, tid: 1 },
			{ name: "MinorGC", ph: "E", ts: 4000, tid: 1 },
			{ name: "Unlisted", ph: "X", dur: 9000, tid: 1 },
		])
		const diag = diagFromEnv({ TRACE_STEP: "menu/500 › open", DIAG_FILE: "/tmp/x.json" })
		expect(await withDiag(diag, cdp, "cur", "menu/500 › open", open)).toBe("opened")
		expect(await withDiag(diag, cdp, "cur", "menu/500 › open", open)).toBe("opened")
		let file = ""
		let body = ""
		writeDiag(diag, {
			writeFileSync: (path: string, text: string) => {
				file = path
				body = text
			},
		})
		expect(file).toBe("/tmp/x.json")
		const out = JSON.parse(body)
		expect(out.variants.cur.runs).toBe(2)
		// Each run replays both events: 2 ms of Layout and 3 ms of MinorGC per run.
		expect(out.variants.cur.trace).toEqual({ MinorGC: 3, Layout: 2 })
		expect(out.variants.cur.trace.Unlisted).toBeUndefined()
	})
})
