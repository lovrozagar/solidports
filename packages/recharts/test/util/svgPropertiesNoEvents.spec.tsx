import type { JSX } from "solid-js"
import { describe, expect, it } from "vitest"
import {
	SVGElementPropKeysType,
	svgPropertiesNoEvents,
	svgPropertiesNoEventsFromUnknown,
} from "../../src/util/svgPropertiesNoEvents"
import { assertNotNull } from "../helper/assertNotNull"

describe("svgPropertiesNoEvents", () => {
	it("should return an empty object when called with an empty object", () => {
		expect(svgPropertiesNoEvents({})).toEqual({})
	})
	it("should allow only SVG properties and exclude event handlers", () => {
		const input = {
			"aria-label": "test",
			className: "svg-class",
			color: "red",
			custom: "not-a-svg-prop",
			height: "100px",
			id: "svg-id",
			lang: "en",
			max: 10,
			media: "all",
			method: "get",
			min: 0,
			name: "svg-name",
			onClick: () => {},
			onMouseOver: () => {},
			style: { fill: "blue" },
		}

		const output = svgPropertiesNoEvents(input)

		expect(output).toEqual({
			"aria-label": "test",
			className: "svg-class",
			color: "red",
			height: "100px",
			id: "svg-id",
			lang: "en",
			max: 10,
			media: "all",
			method: "get",
			min: 0,
			name: "svg-name",
			style: { fill: "blue" },
		})
	})
	it("should return an empty object when no SVG properties are present", () => {
		const input = {
			custom: "not-a-svg-prop",
			onClick: () => {},
			onMouseOver: () => {},
		}

		const output = svgPropertiesNoEvents(input)

		expect(output).toEqual({})
	})
	it("should handle an empty object", () => {
		const input = {}
		const output = svgPropertiesNoEvents(input)
		expect(output).toEqual({})
	})
	it("should refine the type to only allow SVG properties", () => {
		type InputType = {
			"aria-label"?: string
			className?: string
			color?: string
			custom?: string
			height?: string
			id?: string
			lang?: string
			max: number
			media?: string
			method?: string
			min?: number
			name?: string
			onClick?: () => void
			onMouseOver?: () => void
			style?: JSX.CSSProperties
		}
		const input: InputType = {
			"aria-label": "test",
			className: "svg-class",
			color: "red",
			custom: "not-a-svg-prop",
			height: "100px",
			id: "svg-id",
			lang: "en",
			max: 10,
			media: "all",
			method: "get",
			min: 0,
			name: "svg-name",
			onClick: () => {},
			onMouseOver: () => {},
			style: { fill: "blue" },
		}
		const output = svgPropertiesNoEvents(input)
		assertNotNull(output)

		expect(output).toEqual({
			"aria-label": "test",
			className: "svg-class",
			color: "red",
			height: "100px",
			id: "svg-id",
			lang: "en",
			max: 10,
			media: "all",
			method: "get",
			min: 0,
			name: "svg-name",
			style: { fill: "blue" },
		})
	})
	it("should include data-* attributes", () => {
		const input = {
			"data-id": "123",
			"data-test": "test-value",
			nonDataProp: "value",
		}
		const result = svgPropertiesNoEvents(input)
		expect(result).toEqual({
			"data-id": "123",
			"data-test": "test-value",
		})
	})
	it("should exclude symbols and numbers as keys", () => {
		const sym = Symbol("test")
		const input: { [key: PropertyKey]: unknown } = {
			[sym]: "symbol-value",
			6: "number-value",
			cx: 10,
		}
		const result = svgPropertiesNoEvents(input)
		expect(result).toEqual({ cx: 10 })
	})
})

describe("svgPropertiesNoEventsFromUnknown", () => {
	/* In Solid, JSX elements are opaque (not ReactElements with .props).
	   svgPropertiesNoEventsFromUnknown returns null for non-plain-object inputs. */
	it.each([null, undefined, true, false, [], "string", 1, Symbol.for("key")] as const)(
		"should return null when passed %s",
		(input) => {
			const result: Partial<Record<SVGElementPropKeysType, unknown>> | null =
				svgPropertiesNoEventsFromUnknown(input)
			expect(result).toBeNull()
		},
	)
})

describe("type matching ActiveDotType", () => {
	it("should return null type when passed a boolean", () => {
		const input = true
		const result: Partial<Record<SVGElementPropKeysType, unknown>> | null =
			svgPropertiesNoEventsFromUnknown(input)
		expect(result).toBeNull()
	})
	it("should return null type when passed a function", () => {
		const input = () => {}
		const result: Partial<Record<SVGElementPropKeysType, unknown>> | null =
			svgPropertiesNoEventsFromUnknown(input)
		expect(result).toBeNull()
	})
	it("should return SVGProps type when passed an object", () => {
		type InputType = {
			custom?: string
			cx: number
			cy: number
			onClick?: () => void
			r?: number
		}
		const input: InputType = { cx: 10, cy: 10, r: 5 }
		const result: Partial<Record<SVGElementPropKeysType, unknown>> | null =
			svgPropertiesNoEventsFromUnknown(input)
		expect(result).toEqual({ cx: 10, cy: 10, r: 5 })
	})
	it("should accept union types and return only SVG properties", () => {
		type InputType =
			| {
					custom?: string
					cx: number
					cy: number
					onClick?: () => void
					r?: number
			  }
			| boolean
		function noInfer(i: InputType) {
			return svgPropertiesNoEventsFromUnknown(i)
		}
		const input1: InputType = { cx: 10, cy: 10, r: 5 }
		const result1: Partial<Record<SVGElementPropKeysType, unknown>> | null = noInfer(input1)
		expect(result1).toEqual({ cx: 10, cy: 10, r: 5 })

		const input2: InputType = true
		const result2: Partial<Record<SVGElementPropKeysType, unknown>> | null = noInfer(input2)
		expect(result2).toBeNull()
	})
})
