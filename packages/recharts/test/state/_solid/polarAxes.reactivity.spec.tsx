/* @jsxImportSource solid-js */
import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import type { JSX } from "solid-js"
import { useChartState } from "../../../src/state/_solid/useChartState"
import { PieChart, RadarChart, PolarAngleAxis, PolarRadiusAxis, Pie, Radar } from "../../../src"

/* Reads angleAxis[id].settings.dataKey from new chartState. */
const AngleAxisReader = (props: { axisId: string }): JSX.Element => {
	const { state } = useChartState()
	return (
		<span data-testid={`angle-reader-${props.axisId}`}>
			{String(state.polarAxes.angleAxis[props.axisId]?.settings?.dataKey ?? "__missing__")}
		</span>
	)
}

/* Reads radiusAxis[id].settings.dataKey from new chartState. */
const RadiusAxisReader = (props: { axisId: string }): JSX.Element => {
	const { state } = useChartState()
	return (
		<span data-testid={`radius-reader-${props.axisId}`}>
			{String(state.polarAxes.radiusAxis[props.axisId]?.settings?.dataKey ?? "__missing__")}
		</span>
	)
}

const data = [{ subject: "Math", value: 80 }]

describe("Phase 4 — polarAxes dual-write reactivity", () => {
	it("PolarAngleAxis dual-writes to new chartState on mount", () => {
		const { getByTestId } = render(() => (
			<RadarChart width={400} height={400} data={data}>
				<PolarAngleAxis dataKey="subject" angleAxisId="0" />
				<Radar dataKey="value" />
				<AngleAxisReader axisId="0" />
			</RadarChart>
		))
		/* Fails RED: PolarAngleAxis does not yet write to new chartState — returns "__missing__". */
		expect(getByTestId("angle-reader-0").textContent).toBe("subject")
	})

	it("setState mutation propagates to PolarAngleAxis component synchronously", () => {
		let capturedSetState: ReturnType<typeof useChartState>["setState"] | undefined

		const CaptureSetState = (): null => {
			const ctx = useChartState()
			capturedSetState = ctx.setState
			return null
		}

		const { getByTestId } = render(() => (
			<RadarChart width={400} height={400} data={data}>
				<PolarAngleAxis dataKey="subject" angleAxisId="0" />
				<Radar dataKey="value" />
				<AngleAxisReader axisId="0" />
				<CaptureSetState />
			</RadarChart>
		))

		/* Fails RED: PolarAngleAxis never writes initial entry, reader returns "__missing__"
		   and manual setState reaches the reader but in an unexpected shape. */
		capturedSetState!("polarAxes", "angleAxis", "0", "settings" as never, { dataKey: "topic" } as never)
		expect(getByTestId("angle-reader-0").textContent).toBe("topic")
	})

	it("multiple PolarAngleAxis instances each write their own id", () => {
		const multiData = [{ subject: "Math", alt: "Eng", value: 80 }]
		const { getByTestId } = render(() => (
			<RadarChart width={400} height={400} data={multiData}>
				<PolarAngleAxis angleAxisId="0" dataKey="subject" />
				<PolarAngleAxis angleAxisId="secondary" dataKey="alt" />
				<Radar dataKey="value" angleAxisId="0" />
				<AngleAxisReader axisId="0" />
				<AngleAxisReader axisId="secondary" />
			</RadarChart>
		))
		/* Fails RED: PolarAngleAxis does not yet write to new chartState. */
		expect(getByTestId("angle-reader-0").textContent).toBe("subject")
		expect(getByTestId("angle-reader-secondary").textContent).toBe("alt")
	})

	it("polar axes share the outer RechartsStateProvider (no nested provider isolation)", () => {
		/* Mount two PolarAngleAxis instances inside a single RadarChart; both must
		   write into the same chartState — mutual visibility confirms shared context. */
		let capturedSetState: ReturnType<typeof useChartState>["setState"] | undefined

		const CaptureSetState = (): null => {
			capturedSetState = useChartState().setState
			return null
		}

		const { getByTestId } = render(() => (
			<RadarChart width={400} height={400} data={data}>
				<PolarAngleAxis angleAxisId="a" dataKey="subject" />
				<PolarAngleAxis angleAxisId="b" dataKey="value" />
				<Radar dataKey="value" angleAxisId="a" />
				<AngleAxisReader axisId="a" />
				<AngleAxisReader axisId="b" />
				<CaptureSetState />
			</RadarChart>
		))

		/* Both axes visible in the same state — shared provider, not isolated. */
		capturedSetState!("polarAxes", "angleAxis", "a", "settings" as never, { dataKey: "mutated" } as never)
		expect(getByTestId("angle-reader-a").textContent).toBe("mutated")
		/* b still has its original value in same store */
		expect(getByTestId("angle-reader-b").textContent).toBe("value")
	})

	it("PolarRadiusAxis dual-writes to new chartState on mount", () => {
		const { getByTestId } = render(() => (
			<PieChart width={400} height={300}>
				<PolarRadiusAxis radiusAxisId="0" dataKey="value" />
				<Pie data={[{ value: 10 }]} dataKey="value" />
				<RadiusAxisReader axisId="0" />
			</PieChart>
		))
		/* Fails RED: PolarRadiusAxis does not yet write to new chartState — returns "__missing__". */
		expect(getByTestId("radius-reader-0").textContent).toBe("value")
	})
})
