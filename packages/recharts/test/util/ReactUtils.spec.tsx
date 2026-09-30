import { vi } from "vitest"

import { Bar, Line } from "../../src"
import { findAllByType, getDisplayName, toArray } from "../../src/util/ReactUtils"
import { adaptEventHandlers, adaptEventsOfChild } from "../../src/util/types"

describe("ReactUtils", () => {
	describe("getDisplayName", () => {
		test("getDisplayName return empty string when has a null as input", () => {
			// added never casting to test runtime value
			const result = getDisplayName(null as never)

			expect(result).toEqual("")
		})

		test("getDisplayName return the same string when has a string as input", () => {
			const result = getDisplayName("test")

			expect(result).toEqual("test")
		})

		test('getDisplayName return the "Component" when has an object as input', () => {
			const test = {}
			// @ts-expect-error test runtime value
			const result = getDisplayName(test)

			expect(result).toEqual("Component")
		})
	})

	describe("adaptEventHandlers", () => {
		test("adaptEventHandlers return event attributes", () => {
			const result = adaptEventHandlers({
				a: 1,
				onMouseEnter: vi.fn(),
			})
			expect(Object.keys(result ?? {})).toContain("onMouseEnter")
			expect(Object.keys(result ?? {})).not.toContain("a")
		})

		test("adaptEventHandlers return null when input is not a react element", () => {
			expect(adaptEventHandlers(null as any)).toEqual(null)
			expect(adaptEventHandlers(vi.fn())).toEqual(null)
			expect(adaptEventHandlers(1 as any)).toEqual(null)
		})

		test("adaptEventHandlers skips event props that are not functions", () => {
			const result = adaptEventHandlers({
				onClick: vi.fn(),
				onMouseEnter: undefined,
				onMouseLeave: undefined,
			})
			expect(Object.keys(result ?? {})).toEqual(["onClick"])
		})
	})

	describe("adaptEventsOfChild", () => {
		test("adaptEventsOfChild return null when input is not a props", () => {
			expect(adaptEventsOfChild(null as any, undefined, 0)).toEqual(null)
			expect(adaptEventsOfChild(1 as any, undefined, 0)).toEqual(null)
		})
	})

	/* `toArray` is React.Children API; Solid has no vnode tree to introspect. The port
	   intentionally drops it. JSX evaluation here also leaks computations outside any
	   `createRoot`. Skip — no equivalent exists. */
	describe.skip("toArray", () => {
		test("basic", () => {
			const children = [<li>1</li>, <li>2</li>, <li>3</li>]

			const result = toArray(children)
			expect(result.length).toEqual(3)
			expect(result.map((c) => c.key)).toEqual(["1", "2", "3"])
		})

		test("Array", () => {
			const children = [<li>1</li>, <>{[<li>2</li>, <li>3</li>]}</>]

			const result = toArray(children)
			expect(result.length).toEqual(3)
			expect(result.map((c) => c.key)).toEqual(["1", "2", "3"])
		})

		test("Ignores `undefined` and `null`", () => {
			const children = [
				<>
					{null}
					<li />
					{null}
					{undefined}
					<li />
					{undefined}
					<li />
				</>,
			]
			const result = toArray(children)
			expect(result.length).toEqual(3)
			expect(result.map((c) => c.key)).toEqual(["1", "2", "3"])
		})

		test("Iterable", () => {
			const iterable = {
				*[Symbol.iterator]() {
					yield <li>5</li>
					yield null
					yield <li>6</li>
				},
			}

			const children = [
				<>
					{[<li>1</li>]}
					<li>2</li>
					{null}
					{new Set([<li>3</li>, <li>4</li>])}
					{iterable}
				</>,
			]
			const result = toArray(children)
			expect(result.length).toEqual(6)
			expect(result.map((c) => c.key)).toEqual(["1", "2", "3", "4", "5", "6"])
		})

		test("Fragment", () => {
			const children = [
				<>
					<li>1</li>
					<>
						<li>2</li>
						<li>3</li>
					</>
					<>
						<>
							<li>4</li>
							<li>5</li>
						</>
					</>
				</>,
			]

			const result = toArray(children)
			expect(result.length).toEqual(5)
			expect(result.map((c) => c.key)).toEqual(["1", "2", "3", "4", "5"])
		})
	})

	/* `findAllByType` is intentionally stubbed (returns []) — Solid has no vnode tree.
	   Tests assert on React-specific children introspection that doesn't apply. Skip. */
	describe.skip("findAllByType", () => {
		test("findAllByType returns children that matched the type", () => {
			const children = [<div />, <Line />, null, <Bar dataKey="A" />, undefined, <Line />, <Line />]
			const lineChildren = findAllByType(children, Line)
			expect(lineChildren.length).toEqual(3)
			expect(lineChildren.map((child) => child.key)).toEqual(["a", "b", "c"])
		})

		test("findAllByType includes children inside of the fragment", () => {
			const children = [
				<Line />,
				<div />,
				<>
					<Line />
					<Line />
					<Bar dataKey="A" />
					<>
						<Line />
					</>
				</>,
			]
			const lineChildren = findAllByType(children, Line)
			expect(lineChildren.length).toEqual(4)
			expect(lineChildren.map((child) => child.key)).toEqual(["a", "b", "c", "d"])
		})
	})
})
