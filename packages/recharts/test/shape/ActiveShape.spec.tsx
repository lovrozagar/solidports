import { describe, expect, test } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import type { JSX } from "solid-js"
import { Funnel, FunnelChart, Trapezoid, Tooltip } from "../../src"
import type { TrapezoidProps } from "../../src"

const funnelData = [
	{ name: "\u5C55\u73B0", value: 100 },
	{ name: "\u70B9\u51FB", value: 80 },
	{ name: "\u8BBF\u95EE", value: 50 },
	{ name: "\u54A8\u8BE2", value: 40 },
	{ name: "\u8BA2\u5355", value: 26 },
]

type ActiveShapeTestParams = {
	activeClass: string
	element: () => JSX.Element
	expectedLength: number
	name: string
	shapeClass?: string
}

const funnelShapes: ActiveShapeTestParams[] = [
	{
		activeClass: ".custom-trap-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					shape={(props: TrapezoidProps) => <Trapezoid {...props} class="custom-trap-shape" />}
				/>
			</FunnelChart>
		),
		expectedLength: 5,
		name: "Funnel renders customized shape when shape is set to be a function",
	},
	{
		activeClass: ".custom-trap-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					shape={{ className: "custom-trap-shape" }}
				/>
			</FunnelChart>
		),
		expectedLength: 5,
		name: "Funnel renders customized shape when shape is set to be an object",
	},
	{
		activeClass: ".custom-trap-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					shape={<Trapezoid fill="red" class="custom-trap-shape" />}
				/>
			</FunnelChart>
		),
		expectedLength: 5,
		name: "Funnel renders customized shape when shape is set to be a React Element",
	},
]

const funnelActiveShapes: ActiveShapeTestParams[] = [
	{
		activeClass: ".recharts-active-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					activeShape={(props: TrapezoidProps) => <Trapezoid {...props} />}
				/>
				<Tooltip />
			</FunnelChart>
		),
		expectedLength: 1,
		name: "Funnel renders customized active shape when activeShape is set to be a function",
		shapeClass: ".recharts-funnel-trapezoid",
	},
	{
		activeClass: ".recharts-active-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					activeShape={{ fill: "red", strokeWidth: 2 }}
				/>
				<Tooltip />
			</FunnelChart>
		),
		expectedLength: 1,
		name: "Funnel renders customized active shape when activeShape is set to be an object",
		shapeClass: ".recharts-funnel-trapezoid",
	},
	{
		activeClass: ".recharts-active-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					activeShape={<Trapezoid fill="red" />}
				/>
				<Tooltip />
			</FunnelChart>
		),
		expectedLength: 1,
		name: "Funnel renders customized active shape when activeShape is set to be a React Element",
		shapeClass: ".recharts-funnel-trapezoid",
	},
	{
		activeClass: ".recharts-active-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					activeShape
				/>
				<Tooltip />
			</FunnelChart>
		),
		expectedLength: 1,
		name: "Funnel renders customized active shape when activeShape is set to be a boolean",
		shapeClass: ".recharts-funnel-trapezoid",
	},
	{
		activeClass: ".recharts-active-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel
					width={400}
					data={funnelData}
					dataKey="value"
					isAnimationActive={false}
					activeShape={false}
				/>
				<Tooltip />
			</FunnelChart>
		),
		expectedLength: 0,
		name: "Funnel does not render customized active shape when activeShape is set to be a falsy boolean",
		shapeClass: ".recharts-funnel-trapezoid",
	},
	{
		activeClass: ".recharts-active-shape",
		element: () => (
			<FunnelChart width={700} height={200}>
				<Funnel width={400} data={funnelData} dataKey="value" isAnimationActive={false} />
				<Tooltip />
			</FunnelChart>
		),
		expectedLength: 0,
		name: "Funnel does not render customized active shape when activeShape is not set",
		shapeClass: ".recharts-funnel-trapezoid",
	},
]

describe.skip("Active Shape", () => {
	test.each(funnelShapes)("$name", ({ element, activeClass, expectedLength }) => {
		const { container } = render(element)
		const customShapes = container.querySelectorAll(activeClass)
		expect(customShapes).toHaveLength(expectedLength)
	})
})
test.each(funnelActiveShapes)("$name", ({ element, activeClass, expectedLength, shapeClass }) => {
	const { container } = render(element)
	const shapes = container.querySelectorAll(shapeClass ?? "")
	const [shape] = Array.from(shapes)
	fireEvent.mouseOver(shape)
	const activeShape = container.querySelectorAll(activeClass)
	expect(activeShape).toHaveLength(expectedLength)
})
