import { For } from "solid-js"
import { render } from "@solidjs/testing-library"
import { Cell, Funnel, FunnelChart, FunnelProps, FunnelTrapezoidItem, LabelList } from "../../src"
import { showTooltip } from "../component/Tooltip/tooltipTestHelpers"
import { funnelChartMouseHoverTooltipSelector } from "../component/Tooltip/tooltipMouseHoverSelectors"
import { renderWithSignals } from "../helper/renderWithSignals"

const data = [
	{ name: "展现", value: 100 },
	{ name: "点击", value: 80 },
	{ name: "访问", value: 50 },
	{ name: "咨询", value: 40 },
	{ name: "订单", value: 26 },
]

describe("<Funnel />", () => {
	it("Render 5 Trapezoid in a simple funnel", () => {
		const { container } = render(() => (
			<FunnelChart width={500} height={500}>
				<Funnel dataKey="value" data={data} />
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
	})
	it("Render 5 Trapezoid with animation in a simple funnel", () => {
		const { container } = render(() => (
			<FunnelChart width={500} height={500}>
				<Funnel dataKey="value" data={data} isAnimationActive />
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
	})
	it("Can render in a custom component", () => {
		const CustomFunnel = (props: FunnelProps) => {
			return <Funnel {...props} />
		}

		const { container } = render(() => (
			<FunnelChart width={500} height={500}>
				<CustomFunnel dataKey="value" data={data} isAnimationActive />
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
	})
	it("Don't render any Trapezoid when data is empty", () => {
		const { container } = render(() => (
			<FunnelChart width={500} height={500}>
				<Funnel dataKey="value" data={[]} />
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(0)
	})
	it("Don't render any Trapezoid when set hide", () => {
		const { container } = render(() => (
			<FunnelChart width={500} height={500}>
				<Funnel dataKey="value" data={data} hide />
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(0)
	})
	it("active shape in simple funnel", () => {
		const { container, debug } = render(() => (
			<FunnelChart width={500} height={500}>
				<Funnel
					dataKey="value"
					data={data}
					isAnimationActive={false}
					activeShape={(payload: FunnelTrapezoidItem) => (
						<rect
							class="custom-active-shape"
							x={payload.x}
							y={payload.y}
							height={payload.height}
							width={payload.upperWidth}
							fill="red"
							strokeWidth="4"
							stroke="#fff"
						/>
					)}
				>
					<For each={data}>{(entry) => <Cell />}</For>
				</Funnel>
			</FunnelChart>
		))

		expect(container.querySelectorAll(".custom-active-shape")).toHaveLength(0)

		showTooltip(container, funnelChartMouseHoverTooltipSelector, debug)

		expect(container.querySelectorAll(".custom-active-shape")).toHaveLength(1)

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
	})
	it("Renders funnel custom cell in simple FunnelChart", () => {
		const { container } = render(() => (
			<FunnelChart width={500} height={300}>
				<Funnel dataKey="value" data={data} isAnimationActive={false}>
					<For each={data}>{(entry) => <Cell class="custom-cell" />}</For>
				</Funnel>
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
	})
	it.skip("Renders funnel custom label in simple FunnelChart", () => {
		const { container } = render(() => (
			<FunnelChart width={500} height={300}>
				<Funnel dataKey="value" data={data} isAnimationActive={false}>
					<LabelList
						position="right"
						fill="#000"
						stroke="#000"
						dataKey="name"
						className="custom-label"
					/>
				</Funnel>
			</FunnelChart>
		))

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
		expect(container.querySelectorAll(".custom-label")).toHaveLength(data.length)
	})
	it.skip("should assert the differences between a normal and reversed Funnel", () => {
		const { container, update } = renderWithSignals(
			(p: { reversed: boolean }) => (
				<FunnelChart width={500} height={300}>
					<Funnel dataKey="value" data={data} isAnimationActive={false} reversed={p.reversed} />
				</FunnelChart>
			),
			{ reversed: false },
		)

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
		const firstTrapezoid = container.getElementsByClassName("recharts-trapezoid")[0]
		expect(firstTrapezoid.getAttribute("x")).toEqual("5")
		expect(firstTrapezoid.getAttribute("y")).toEqual("5")

		update({ reversed: true })

		expect(container.getElementsByClassName("recharts-funnel-trapezoid")).toHaveLength(data.length)
		const firstTrapezoidReversed = container.getElementsByClassName("recharts-trapezoid")[0]
		expect(firstTrapezoidReversed.getAttribute("x")).toEqual("54")
		expect(firstTrapezoidReversed.getAttribute("y")).toEqual("237")
	})
})
