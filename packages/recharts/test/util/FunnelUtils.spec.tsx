import { render } from "../helper/render"
import { FunnelTrapezoid, FunnelTrapezoidProps } from "../../src/util/FunnelUtils"
import { Coordinate, TrapezoidViewBox } from "../../src/util/types"

describe("funnelUtils", () => {
	const mockTooltipPosition: Coordinate = { x: 10, y: 10 }

	const viewBox: TrapezoidViewBox = {
		height: 0,
		lowerWidth: 0,
		upperWidth: 0,
		width: 0,
		x: 0,
		y: 0,
	}
	const mockProps: FunnelTrapezoidProps = {
		height: 0,
		isActive: false,
		labelViewBox: viewBox,
		lowerWidth: 60,
		name: "",
		option: undefined,
		parentViewBox: viewBox,
		tooltipPayload: [],
		tooltipPosition: mockTooltipPosition,
		upperWidth: 80,
		val: 1,
		width: 100,
		x: 11,
		y: 11,
	}

	it("<FunnelTrapezoid /> returns a trapezoid shape with no options", () => {
		const { container } = render(() => (
			<svg width={100} height={100}>
				<FunnelTrapezoid {...mockProps} isActive={Boolean(true)} />
			</svg>
		))
		expect(container.querySelector("g")).toHaveClass("recharts-active-shape")
	})
	it("<FunnelTrapezoid /> returns a trapezoid shape with x & y from options", () => {
		const { container } = render(() => (
			<svg width={100} height={100}>
				<FunnelTrapezoid
					{...mockProps}
					height={100}
					isActive
					lowerWidth={0}
					name="my name"
					option={{ x: 10, y: 10 }}
					tooltipPosition={mockTooltipPosition}
					upperWidth={0}
					width={100}
					x={0}
					y={0}
				/>
			</svg>
		))
		expect(container.querySelector("g")).toHaveClass("recharts-active-shape")
	})
})
