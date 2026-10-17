import { describe, expect, test } from "bun:test"
import {
	attributeAllocations,
	attributeCpu,
	bucketOf,
	CANDIDATES,
	distributeGc,
	setLibraryRoot,
} from "../packages/base-ui/test/perf-solid/shared/attribution.mjs"

// Synthetic CDP profiles. Frames carry their original source in `url` and the identity resolver
// leaves them as they are; the real tool maps bundle positions through the sourcemaps first.
const resolve = (frame: { url: string; functionName: string }) => ({ source: frame.url, name: frame.functionName })

const SRC = "packages/base-ui/packages/solid/src"
const frame = (url: string, functionName = "f") => ({
	url,
	functionName,
	lineNumber: 0,
	columnNumber: 0,
	scriptId: "1",
})

/** A CPU profile from a list of stacks (outermost first), each with its sample time in ms. */
function cpuProfile(stacks: { stack: ReturnType<typeof frame>[]; ms: number }[]) {
	const nodes: { id: number; callFrame: ReturnType<typeof frame>; children: number[] }[] = [
		{ id: 1, callFrame: frame("", "(root)"), children: [] },
	]
	const samples: number[] = []
	const timeDeltas: number[] = []
	for (const { stack, ms } of stacks) {
		let parent = nodes[0]
		for (const callFrame of stack) {
			let child = parent.children
				.map((id) => nodes.find((n) => n.id === id)!)
				.find((n) => n.callFrame.url === callFrame.url && n.callFrame.functionName === callFrame.functionName)
			if (!child) {
				child = { id: nodes.length + 1, callFrame, children: [] }
				nodes.push(child)
				parent.children.push(child.id)
			}
			parent = child
		}
		samples.push(parent.id)
		timeDeltas.push(ms * 1000)
	}
	return { nodes, startTime: 0, endTime: 0, samples, timeDeltas }
}

/** A sampling heap profile from stacks (outermost first) with their allocated bytes. */
function heapProfile(stacks: { stack: ReturnType<typeof frame>[]; bytes: number }[]) {
	type Node = { callFrame: ReturnType<typeof frame>; selfSize: number; children: Node[]; id: number }
	let id = 1
	const head: Node = { callFrame: frame("", "(root)"), selfSize: 0, children: [], id: id++ }
	for (const { stack, bytes } of stacks) {
		let node = head
		for (const callFrame of stack) {
			let child = node.children.find(
				(c) => c.callFrame.url === callFrame.url && c.callFrame.functionName === callFrame.functionName,
			)
			if (!child) {
				child = { callFrame, selfSize: 0, children: [], id: id++ }
				node.children.push(child)
			}
			node = child
		}
		node.selfSize += bytes
	}
	return { head, samples: [] }
}

const runtime = frame("node_modules/@solidjs/signals/dist/prod.js", "runEffect")
const store = frame(`${SRC}/utils/store/SolidStoreV2.ts`, "set")
const kit = frame(`${SRC}/utils/native/element.ts`, "renderClientElement")
const part = frame(`${SRC}/menu/root/MenuRoot.tsx`, "MenuRoot")
const helper = frame(`${SRC}/solid-helpers.tsx`, "provideContext")
const fixture = frame("packages/base-ui/test/perf-solid/solid/fixtures/collapsible.tsx", "fixture")

describe("perf attribution", () => {
	test("a frame's bucket: a candidate's rule, else its project file, else runtime or other", () => {
		expect(bucketOf(resolve(store))).toBe("store")
		expect(bucketOf(resolve(kit))).toBe("native-kit")
		expect(bucketOf(resolve(helper))).toBe("providers")
		expect(bucketOf(resolve(part))).toBe(`file:menu/root/MenuRoot.tsx`)
		expect(bucketOf(resolve(runtime))).toBe(null)
		expect(bucketOf(resolve(frame("packages/base-ui/test/perf-solid/solid/fixtures/collapsible.tsx")))).toBe(
			"bench-harness",
		)
		expect(bucketOf(resolve(frame("packages/base-ui/packages/solid/test/floor/collapsible.tsx")))).toBe("bench-harness")
		expect(CANDIDATES.map((c) => c.id)).toContain("composite-list")
		// The shims and helpers outside provideContext, and flushSync, are candidates of their own.
		expect(bucketOf({ source: `${SRC}/solid-1-compat.ts`, name: "mergeProps" })).toBe("compat-shims")
		expect(bucketOf({ source: `${SRC}/solid-helpers.tsx`, name: "splitComponentProps" })).toBe("compat-shims")
		expect(bucketOf({ source: `${SRC}/utils/flushSync.ts`, name: "flushSync" })).toBe("flush")
	})

	test("a library copy outside the working tree is library code once its root is declared", () => {
		const copy = { source: "/tmp/control/src/utils/native/element.ts", name: "renderClientElement" }
		expect(bucketOf(copy)).toBe(null)
		setLibraryRoot("/tmp/control/src")
		try {
			expect(bucketOf(copy)).toBe("native-kit")
			expect(bucketOf({ source: "/tmp/control/src/menu/root/MenuRoot.tsx", name: "f" })).toBe(
				"file:menu/root/MenuRoot.tsx",
			)
			// The working tree's sources stay library code.
			expect(bucketOf(resolve(kit))).toBe("native-kit")
		} finally {
			setLibraryRoot(null)
		}
	})

	test("each sample goes to its deepest candidate frame, so the runtime it triggers is the caller's", () => {
		const profile = cpuProfile([
			{ stack: [part, kit, runtime], ms: 3 },
			{ stack: [part, store, runtime], ms: 2 },
			{ stack: [part], ms: 1 },
			{ stack: [runtime], ms: 4 },
			// The bench's fixture atop the stack keeps only its own time.
			{ stack: [fixture, runtime], ms: 6 },
			{ stack: [fixture], ms: 0.5 },
			// The profiler serializing its own profile (Node's inspector), with the harness below it.
			{ stack: [fixture, frame("node:inspector", "post")], ms: 2 },
			{ stack: [frame("", "(garbage collector)")], ms: 5 },
			{ stack: [frame("", "(idle)")], ms: 7 },
		])
		const result = attributeCpu(profile, resolve)
		expect(result.ms).toEqual({
			"native-kit": 3,
			store: 2,
			"file:menu/root/MenuRoot.tsx": 1,
			runtime: 10,
			"bench-harness": 0.5,
		})
		// Runtime time with no library frame, by package.
		expect(result.runtime).toEqual({ "@solidjs/signals": 10 })
		// Each candidate's time by the function its samples were credited to.
		expect(result.fns).toEqual({ "native-kit": { renderClientElement: 3 }, store: { set: 2 } })
		expect(result.gcMs).toBe(5)
		expect(result.idleMs).toBe(7)
		// Every sample is accounted for.
		expect(result.profilerMs).toBe(2)
		expect(result.totalMs).toBe(30.5)
	})

	test("flushSync is a funnel: the work it flushes goes to the code that called it", () => {
		const flush = frame(`${SRC}/utils/flushSync.ts`, "flushSync")
		const caller = frame(`${SRC}/utils/popups/popupStoreUtils.ts`, "changeState")
		const result = attributeCpu(
			cpuProfile([
				{ stack: [caller, flush, runtime], ms: 3 },
				{ stack: [caller, flush], ms: 0.5 },
			]),
			resolve,
		)
		expect(result.ms).toEqual({ "file:utils/popups/popupStoreUtils.ts": 3, flush: 0.5 })
	})

	test("allocations go to the same buckets by the same rule", () => {
		const bytes = attributeAllocations(
			heapProfile([
				{ stack: [part, kit, runtime], bytes: 800 },
				{ stack: [part, store], bytes: 150 },
				{ stack: [runtime], bytes: 50 },
			]),
			resolve,
		)
		expect(bytes).toEqual({ "native-kit": 800, store: 150, runtime: 50 })
	})

	test("GC time is shared out by allocated bytes: a bucket with 80% of the bytes gets 80% of the GC", () => {
		const share = distributeGc(10, { "native-kit": 800, store: 150, runtime: 50 })
		expect(share["native-kit"]).toBeCloseTo(8)
		expect(share.store).toBeCloseTo(1.5)
		expect(share.runtime).toBeCloseTo(0.5)
		expect(distributeGc(10, {})).toEqual({})
	})
})
