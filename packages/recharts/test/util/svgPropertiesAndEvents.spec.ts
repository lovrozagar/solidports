import { describe, it, expect, vi } from "vitest"
import { svgPropertiesAndEvents } from "../../src/util/svgPropertiesAndEvents"

describe("svgPropertiesAndEvents", () => {
	it("should return an empty object when called with an empty object", () => {
		expect(svgPropertiesAndEvents({})).toEqual({})
	})
	it("should include SVG attributes", () => {
		const input = {
			cx: "50%",
			cy: "50%",
			fill: "#808080",
			nonSvgProp: "value",
			stroke: "#fff",
		}
		const result = svgPropertiesAndEvents(input)
		expect(result).toEqual({
			cx: "50%",
			cy: "50%",
			fill: "#808080",
			stroke: "#fff",
		})
	})
	it("should include data-* attributes", () => {
		const input = {
			"data-id": "123",
			"data-test": "test-value",
			nonDataProp: "value",
		}
		const result = svgPropertiesAndEvents(input)
		expect(result).toEqual({
			"data-id": "123",
			"data-test": "test-value",
		})
	})
	it("should include event handlers", () => {
		const onClick = vi.fn()
		const onMouseEnter = vi.fn()
		const input = {
			nonEventProp: "value",
			onClick,
			onMouseEnter,
		}
		const result = svgPropertiesAndEvents(input)
		expect(result).toEqual({
			onClick,
			onMouseEnter,
		})
	})
	it("should include a mix of SVG attributes, data-* attributes, and event handlers", () => {
		const onClick = vi.fn()
		const input = {
			cx: "50%",
			"data-test": "test-value",
			nonRelevantProp: "value",
			onClick,
			width: 100,
		}
		const result = svgPropertiesAndEvents(input)
		expect(result).toEqual({
			cx: "50%",
			"data-test": "test-value",
			onClick,
			width: 100,
		})
	})
	it("should refine the type of the returned object", () => {
		const onClick = vi.fn()
		type InputType = {
			cx: string
			"data-test": string
			onClick: () => void
			nonRelevantProp: string
			width: number
		}
		const input: InputType = {
			cx: "50%",
			"data-test": "test-value",
			nonRelevantProp: "value",
			onClick,
			width: 100,
		}
		type ExpectedOutputType = {
			cx: string
			"data-test": string
			onClick: () => void
			width: number
		}
		const result: ExpectedOutputType = svgPropertiesAndEvents(input)
		const myCx: string = result.cx
		expect(myCx).toBe("50%")
		const dataTest: string = result["data-test"]
		const clickHandler: () => void = result.onClick
		const myWidth: number = result.width
		/* nonRelevantProp is not in the output type so accessing it should be a type error */
		expect(myCx).toBe("50%")
		expect(dataTest).toBe("test-value")
		expect(clickHandler).toBe(onClick)
		expect(myWidth).toBe(100)
	})
	it("should filter out function properties that are not event handlers", () => {
		const onClick = vi.fn()
		const customFunction = () => "hello"
		const input = {
			customFunction,
			cx: "50%",
			onClick,
			width: 100,
		}
		const result = svgPropertiesAndEvents(input)
		expect(result).toEqual({
			cx: "50%",
			onClick,
			width: 100,
		})
	})
	it("should exclude symbols and numbers as keys", () => {
		const sym = Symbol("test")
		const input: { [key: PropertyKey]: unknown } = {
			[sym]: "symbol-value",
			6: "number-value",
			cx: 10,
			onClick: vi.fn(),
		}
		const result = svgPropertiesAndEvents(input)
		expect(result).toEqual({
			cx: 10,
			onClick: input.onClick,
		})
	})
})
