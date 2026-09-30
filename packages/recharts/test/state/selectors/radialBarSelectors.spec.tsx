import { describe, it } from "vitest"
import { RadialBarChart, RadialBar } from "../../../src"
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { selectRadialBarSectors } from "../../../src/state/selectors/radialBarSelectors"
import { RadialBarSettings } from "../../../src/state/types/RadialBarSettings"
import { assertStableBetweenRenders } from "../../helper/selectorTestHelpers"

describe("selectRadialBarSectors", () => {
	const radialBarSettings: RadialBarSettings = {
		angleAxisId: 0,
		barSize: undefined,
		data: undefined,
		dataKey: "pv",
		hide: false,
		id: "radial-bar-uv",
		maxBarSize: undefined,
		minPointSize: 0,
		radiusAxisId: 0,
		stackId: undefined,
		type: "radialBar",
	}

	const data = [
		{ name: "A", pv: 100 },
		{ name: "B", pv: 200 },
	]

	const renderTestCase = createSelectorTestCase((props) => (
		<RadialBarChart width={500} height={500} data={data}>
			<RadialBar dataKey="pv" isAnimationActive={false} />
			{props.children}
		</RadialBarChart>
	))

	it("should return the same instance on re-render if inputs are stable", () => {
		assertStableBetweenRenders(renderTestCase, (state) =>
			selectRadialBarSectors(state, 0, 0, radialBarSettings, undefined),
		)
	})
})
