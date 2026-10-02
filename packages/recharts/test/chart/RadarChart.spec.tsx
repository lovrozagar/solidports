import { fireEvent, render } from "../helper/render"
import { trackSpy } from "../helper/trackSpy"
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, test, vi } from "vitest"
import { exampleRadarData } from "../_data"
import {
	Customized,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
} from "../../src"
import { assertNotNull } from "../helper/assertNotNull"
import { selectRealScaleType } from "../../src/state/selectors/axisSelectors"
import { ExpectedRadarPolygon, expectRadarPolygons } from "../helper/expectRadarPolygons"
import { useAppSelectorWithStableTest } from "../helper/selectorTestHelpers"
import {
	selectAngleAxis,
	selectMaxRadius,
	selectOuterRadius,
	selectPolarOptions,
	selectRadiusAxisRangeWithReversed,
} from "../../src/state/selectors/polarAxisSelectors"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { selectPolarAxisScale } from "../../src/state/selectors/polarScaleSelectors"
import { expectLastCalledWithScale } from "../helper/expectScale"
import { useChartHeight, useChartWidth, useViewBox } from "../../src/context/chartLayoutContext"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"

describe("<RadarChart />", () => {
	describe("with implicit axes", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<RadarChart
				cx={100}
				cy={150}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" />
				{props.children}
			</RadarChart>
		))

		it("should select angle settings", () => {
			const { spy } = renderTestCase((state) => selectAngleAxis(state, 0))
			expectLastCalledWith(spy, {
				allowDataOverflow: false,
				allowDecimals: false,
				allowDuplicatedCategory: false,
				dataKey: undefined,
				domain: undefined,
				id: 0,
				includeHidden: false,
				name: undefined,
				niceTicks: "auto",
				reversed: false,
				scale: "auto",
				tick: true,
				tickCount: undefined,
				ticks: undefined,
				type: "category",
				unit: undefined,
			})
		})

		it("should select angle axis scale", () => {
			const { spy } = renderTestCase((state) => selectPolarAxisScale(state, "angleAxis", 0))
			expectLastCalledWithScale(spy, { domain: [0, 1, 2, 3, 4, 5, 6, 7], range: [-270, 90] })
		})

		it("should select angle axis scale type", () => {
			const { spy } = renderTestCase((state) => selectRealScaleType(state, "angleAxis", 0))
			expectLastCalledWith(spy, "band")
		})

		it("should select radius axis settings", () => {
			const { spy } = renderTestCase((state) => selectAngleAxis(state, 0))
			expectLastCalledWith(spy, {
				allowDataOverflow: false,
				allowDecimals: false,
				allowDuplicatedCategory: false,
				dataKey: undefined,
				domain: undefined,
				id: 0,
				includeHidden: false,
				name: undefined,
				niceTicks: "auto",
				reversed: false,
				scale: "auto",
				tick: true,
				tickCount: undefined,
				ticks: undefined,
				type: "category",
				unit: undefined,
			})
		})

		it("should select max radius", () => {
			const { spy } = renderTestCase(selectMaxRadius)
			expectLastCalledWith(spy, 245)
		})

		it("should select polar options", () => {
			const { spy } = renderTestCase(selectPolarOptions)
			expectLastCalledWith(spy, {
				cx: 100,
				cy: 150,
				endAngle: -270,
				innerRadius: 0,
				outerRadius: 150,
				startAngle: 90,
			})
		})

		it("should select outer radius", () => {
			const { spy } = renderTestCase(selectOuterRadius)
			expectLastCalledWith(spy, 150) // TODO this returns 196, why?
		})

		it("should select radius axis range", () => {
			const { spy } = renderTestCase((state) => selectRadiusAxisRangeWithReversed(state, 0))
			expectLastCalledWith(spy, [0, 150])
		})

		it("should select radius axis scale", () => {
			const { spy } = renderTestCase((state) => selectPolarAxisScale(state, "radiusAxis", 0))
			expectLastCalledWithScale(spy, { domain: [0, 1000], range: [0, 150] }) // TODO this returns 0, 196, why?
		})

		it("should select radius axis scale type", () => {
			const { spy } = renderTestCase((state) => selectRealScaleType(state, "radiusAxis", 0))
			expectLastCalledWith(spy, "linear")
		})

		it("should render polygon", () => {
			const { container } = render(() => (
				<RadarChart
					cx={100}
					cy={150}
					outerRadius={150}
					width={600}
					height={500}
					data={exampleRadarData}
				>
					<Radar dataKey="value" />
				</RadarChart>
			))
			expectRadarPolygons(container, [
				{
					d: "M100,150L100,150L100,150L100,150L100,150L100,150L100,150L100,150L100,150Z",
					fill: null,
					fillOpacity: null,
				},
			])
		})
	})

	test("Renders polygon with implicit axes", () => {
		const angleAxisSettingsSpy = vi.fn()
		const angleAxisRealScaleTypeSpy = vi.fn()
		const radiusAxisRealScaleTypeSpy = vi.fn()
		const Comp = (): null => {
			trackSpy(angleAxisSettingsSpy, () => useAppSelectorWithStableTest((state) => selectAngleAxis(state, 0)))
			trackSpy(angleAxisRealScaleTypeSpy, () => useAppSelectorWithStableTest((state) => selectRealScaleType(state, "angleAxis", 0)))
			trackSpy(radiusAxisRealScaleTypeSpy, () => useAppSelectorWithStableTest((state) => selectRealScaleType(state, "radiusAxis", 0)))
			return null
		}
		const { container } = render(() => (
			<RadarChart
				cx={100}
				cy={150}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" />
				<Customized component={<Comp />} />
			</RadarChart>
		))

		expect(angleAxisSettingsSpy).toHaveBeenLastCalledWith({
			allowDataOverflow: false,
			allowDecimals: false,
			allowDuplicatedCategory: false,
			dataKey: undefined,
			domain: undefined,
			id: 0,
			includeHidden: false,
			name: undefined,
			niceTicks: "auto",
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			ticks: undefined,
			type: "category",
			unit: undefined,
		})

		expect(angleAxisRealScaleTypeSpy).toHaveBeenLastCalledWith("band")
		expect(radiusAxisRealScaleTypeSpy).toHaveBeenLastCalledWith("linear")

		expectRadarPolygons(container, [
			{
				d: "M100,150L100,150L100,150L100,150L100,150L100,150L100,150L100,150L100,150Z",
				fill: null,
				fillOpacity: null,
			},
		])
	})

	test("Renders polygon with default axes", () => {
		const angleAxisSettingsSpy = vi.fn()
		const angleAxisRealScaleTypeSpy = vi.fn()
		const radiusAxisRealScaleTypeSpy = vi.fn()
		const Comp = (): null => {
			trackSpy(angleAxisSettingsSpy, () => useAppSelectorWithStableTest((state) => selectAngleAxis(state, 0)))
			trackSpy(angleAxisRealScaleTypeSpy, () => useAppSelectorWithStableTest((state) => selectRealScaleType(state, "angleAxis", 0)))
			trackSpy(radiusAxisRealScaleTypeSpy, () => useAppSelectorWithStableTest((state) => selectRealScaleType(state, "radiusAxis", 0)))
			return null
		}
		const { container } = render(() => (
			<RadarChart
				cx={100}
				cy={150}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<PolarAngleAxis />
				<PolarRadiusAxis />
				<Radar dataKey="value" />
				<Comp />
			</RadarChart>
		))

		expect(angleAxisSettingsSpy).toHaveBeenLastCalledWith({
			allowDataOverflow: false,
			allowDecimals: false,
			allowDuplicatedCategory: false,
			dataKey: undefined,
			domain: undefined,
			id: 0,
			includeHidden: false,
			name: undefined,
			niceTicks: "auto",
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			ticks: undefined,
			type: "category",
			unit: undefined,
		})

		expect(angleAxisRealScaleTypeSpy).toHaveBeenLastCalledWith("band")
		expect(radiusAxisRealScaleTypeSpy).toHaveBeenLastCalledWith("linear")

		expectRadarPolygons(container, [
			{
				d: "M100,150L100,150L100,150L100,150L100,150L100,150L100,150L100,150L100,150Z",
				fill: null,
				fillOpacity: null,
			},
		])
	})

	test("innerRadius prop does not do anything", () => {
		const commonProps = {
			data: exampleRadarData,
			height: 500,
			width: 600,
		}
		const expectedPolygons: ReadonlyArray<ExpectedRadarPolygon> = [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: null,
				fillOpacity: null,
			},
		]
		const [innerRadius, setInnerRadius] = createSignal(10)
		const { container } = render(() => (
			<RadarChart innerRadius={innerRadius()} {...commonProps}>
				<Radar dataKey="value" />
			</RadarChart>
		))
		expectRadarPolygons(container, expectedPolygons)

		setInnerRadius(20)
		flush()
		expectRadarPolygons(container, expectedPolygons)
	})

	test("outerRadius prop does not do anything", () => {
		const commonProps = {
			data: exampleRadarData,
			height: 500,
			width: 600,
		}
		const expectedPolygons: ReadonlyArray<ExpectedRadarPolygon> = [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: null,
				fillOpacity: null,
			},
		]
		const [outerRadius, setOuterRadius] = createSignal(10)
		const { container } = render(() => (
			<RadarChart outerRadius={outerRadius()} {...commonProps}>
				<Radar dataKey="value" />
			</RadarChart>
		))
		expectRadarPolygons(container, expectedPolygons)

		setOuterRadius(20)
		flush()
		expectRadarPolygons(container, expectedPolygons)
	})

	test("clockWise prop does not do anything", () => {
		const commonProps = {
			data: exampleRadarData,
			height: 500,
			width: 600,
		}
		const expectedPolygons: ReadonlyArray<ExpectedRadarPolygon> = [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: null,
				fillOpacity: null,
			},
		]
		const [clockWise, setClockWise] = createSignal(true)
		const { container } = render(() => (
			/* @ts-expect-error typescript says the clockWise prop does not exist, but it's documented on the website, why? */
			<RadarChart clockWise={clockWise()} {...commonProps}>
				<Radar dataKey="value" />
			</RadarChart>
		))
		expectRadarPolygons(container, expectedPolygons)

		setClockWise(false)
		flush()
		expectRadarPolygons(container, expectedPolygons)
	})

	test("startAngle and endAngle props do not do anything", () => {
		const commonProps = {
			data: exampleRadarData,
			height: 500,
			width: 600,
		}

		const [startAngle, setStartAngle] = createSignal(20)
		const [endAngle, setEndAngle] = createSignal(70)
		const { container } = render(() => (
			<RadarChart startAngle={startAngle()} endAngle={endAngle()} {...commonProps}>
				<Radar dataKey="value" />
			</RadarChart>
		))

		expectRadarPolygons(container, [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: null,
				fillOpacity: null,
			},
		])

		setStartAngle(90)
		flush()
		setEndAngle(270)
		flush()
		expectRadarPolygons(container, [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: null,
				fillOpacity: null,
			},
		])
	})

	test("renders multiple polygons with different dataKeys", () => {
		const { container } = render(() => (
			<RadarChart
				cx={300}
				cy={250}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" fill="green" fillOpacity={0.3} />
				<Radar dataKey="half" fill="blue" fillOpacity={0.6} />
			</RadarChart>
		))

		expectRadarPolygons(container, [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: "green",
				fillOpacity: "0.3",
			},
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: "blue",
				fillOpacity: "0.6",
			},
		])
	})

	it("should move the polygons when cx and cy are percent string", () => {
		const { container } = render(() => (
			<RadarChart
				cx="10%"
				cy="90%"
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" fill="green" fillOpacity={0.3} />
				<Radar dataKey="half" fill="blue" fillOpacity={0.6} />
			</RadarChart>
		))

		expectRadarPolygons(container, [
			{
				d: "M60,450L60,450L60,450L60,450L60,450L60,450L60,450L60,450L60,450Z",
				fill: "green",
				fillOpacity: "0.3",
			},
			{
				d: "M60,450L60,450L60,450L60,450L60,450L60,450L60,450L60,450L60,450Z",
				fill: "blue",
				fillOpacity: "0.6",
			},
		])
	})

	it("should place the polygons in the middle by default when cx and cy are undefined", () => {
		const { container } = render(() => (
			<RadarChart outerRadius={150} width={600} height={500} data={exampleRadarData}>
				<Radar dataKey="value" fill="green" fillOpacity={0.3} />
				<Radar dataKey="half" fill="blue" fillOpacity={0.6} />
			</RadarChart>
		))

		expectRadarPolygons(container, [
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: "green",
				fillOpacity: "0.3",
			},
			{
				d: "M300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250L300,250Z",
				fill: "blue",
				fillOpacity: "0.6",
			},
		])
	})

	it("should move polygons when cx and cy and outerRadius are updated", () => {
		const [cx, setCx] = createSignal(100)
		const [cy, setCy] = createSignal(120)
		const [outerRadius, setOuterRadius] = createSignal(150)
		const { container } = render(() => (
			<RadarChart
				cx={cx()}
				cy={cy()}
				outerRadius={outerRadius()}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" fill="green" fillOpacity={0.3} />
				<Radar dataKey="half" fill="blue" fillOpacity={0.6} />
			</RadarChart>
		))

		expectRadarPolygons(container, [
			{
				d: "M100,120L100,120L100,120L100,120L100,120L100,120L100,120L100,120L100,120Z",
				fill: "green",
				fillOpacity: "0.3",
			},
			{
				d: "M100,120L100,120L100,120L100,120L100,120L100,120L100,120L100,120L100,120Z",
				fill: "blue",
				fillOpacity: "0.6",
			},
		])

		setCx(200)
		flush()
		setCy(230)
		flush()
		setOuterRadius(100)
		flush()

		expectRadarPolygons(container, [
			{
				d: "M200,230L200,230L200,230L200,230L200,230L200,230L200,230L200,230L200,230Z",
				fill: "green",
				fillOpacity: "0.3",
			},
			{
				d: "M200,230L200,230L200,230L200,230L200,230L200,230L200,230L200,230L200,230Z",
				fill: "blue",
				fillOpacity: "0.6",
			},
		])
	})

	test("Render 8 dots when dot=true", () => {
		const { container } = render(() => (
			<RadarChart
				cx={300}
				cy={250}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar isAnimationActive={false} dot dataKey="value" />
			</RadarChart>
		))
		expect(container.querySelectorAll(".recharts-radar-dot")).toHaveLength(8)
	})

	test("Render 8 labels when label=true", () => {
		const { container } = render(() => (
			<RadarChart
				cx={300}
				cy={250}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar isAnimationActive={false} label dataKey="value" />
			</RadarChart>
		))
		expect(container.querySelectorAll(".recharts-label")).toHaveLength(8)
	})

	test("Render 1 PolarGrid 1 PolarAngleAxis and 1 PolarRadiusAxis in simple Radar", () => {
		const { container } = render(() => (
			<RadarChart
				cx={300}
				cy={250}
				startAngle={45}
				innerRadius={20}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" fill="#9597E4" fillOpacity={0.6} stroke="#8889DD" strokeWidth={3} />
				<PolarGrid />
				<PolarAngleAxis />
				<PolarRadiusAxis orient="middle" angle={67.5} />
			</RadarChart>
		))
		expect(container.querySelectorAll(".recharts-polar-grid")).toHaveLength(1)
		expect(container.querySelectorAll(".recharts-polar-angle-axis")).toHaveLength(1)
		expect(container.querySelectorAll(".recharts-polar-radius-axis")).toHaveLength(1)
	})

	test("Render 8 angle grid angle line, 8 angle axis ticks, and 5 radius axis ticks", () => {
		const { container } = render(() => (
			<RadarChart
				cx={300}
				cy={250}
				startAngle={45}
				innerRadius={20}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" fill="#9597E4" fillOpacity={0.6} stroke="#8889DD" strokeWidth={3} />
				<PolarGrid />
				<PolarAngleAxis />
				<PolarRadiusAxis orient="middle" angle={67.5} />
			</RadarChart>
		))
		expect(
			container.querySelectorAll(".recharts-polar-grid .recharts-polar-grid-angle line"),
		).toHaveLength(8)
		expect(
			container.querySelectorAll(".recharts-polar-angle-axis .recharts-polar-angle-axis-tick"),
		).toHaveLength(8)
		expect(
			container.querySelectorAll(".recharts-polar-radius-axis .recharts-polar-radius-axis-tick"),
		).toHaveLength(5)
	})

	test("click on Sector should invoke onClick callback", () => {
		const onClick = vi.fn()
		const { container } = render(() => (
			<RadarChart
				cx={300}
				cy={250}
				outerRadius={150}
				width={600}
				height={500}
				data={exampleRadarData}
			>
				<Radar dataKey="value" onClick={onClick} />
			</RadarChart>
		))
		const radar = container.querySelector(".recharts-polygon")
		assertNotNull(radar)
		fireEvent.click(radar)
		expect(onClick).toBeCalled()
	})

	describe("RadarChart layout context", () => {
		it("should provide viewBox", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useViewBox())
				return null
			}

			render(() => (
				<RadarChart width={100} height={50} barSize={20}>
					<Comp />
				</RadarChart>
			))

			expectLastCalledWith(spy, { height: 40, width: 90, x: 5, y: 5 })
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should provide clipPathId", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useViewBox())
				return null
			}

			render(() => (
				<RadarChart width={100} height={50} barSize={20}>
					<Comp />
				</RadarChart>
			))

			expectLastCalledWith(spy, { height: 40, width: 90, x: 5, y: 5 })
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should provide chart width", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useChartWidth())
				return null
			}

			render(() => (
				<RadarChart width={100} height={50} barSize={20}>
					<Comp />
				</RadarChart>
			))

			expectLastCalledWith(spy, 100)
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should provide chart height", () => {
			const spy = vi.fn()
			const Comp = (): null => {
				trackSpy(spy, () => useChartHeight())
				return null
			}

			render(() => (
				<RadarChart width={100} height={50} barSize={20}>
					<Comp />
				</RadarChart>
			))

			expectLastCalledWith(spy, 50)
			expect(spy).toHaveBeenCalledTimes(1)
		})
	})
})
