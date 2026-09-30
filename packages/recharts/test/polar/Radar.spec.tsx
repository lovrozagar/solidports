/* @jsxImportSource solid-js */
import { fireEvent, render, screen } from "@solidjs/testing-library"
import { createEffect, createSignal, Show } from "solid-js"

import { expect, it, vi } from "vitest"
import {
	DefaultZIndexes,
	InternalRadarProps,
	Radar,
	RadarChart,
	RadarPoint,
	RadarProps,
} from "../../src"
import { useAppSelector } from "../helper/legacyDispatch"
import { selectPolarItemsSettings } from "../../src/state/selectors/polarSelectors"
import { exampleRadarData } from "../_data"
import { expectRadarPolygons } from "../helper/expectRadarPolygons"
import { RadarSettings } from "../../src/state/types/RadarSettings"
import { userEventSetup } from "../helper/userEventSetup"
import { assertNotNull } from "../helper/assertNotNull"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { selectRadiusAxis } from "../../src/state/selectors/polarAxisSelectors"
import { defaultAxisId } from "../../src/state/cartesianAxisSlice"

type Point = { x?: number | string; y?: number | string }
const CustomizedShape = (props: { points: Point[] }) => {
	const d = (props.points || []).reduce(
		(result, entry, index) =>
			result + (index ? `L${entry.x},${entry.y}` : `M${entry.x},${entry.y}`),
		"",
	)

	return <path d={d} data-testid="customized-shape" />
}

const CustomizedLabel = () => {
	return <text data-testid="customized-label">test</text>
}

const CustomizedDot = (props: Point) => (
	<circle cx={props.x} cy={props.y} r={10} data-testid="customized-dot" />
)

describe("<Radar />", () => {
	describe("in simple chart with implicit axes", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<RadarChart width={500} height={500} data={exampleRadarData}>
				<Radar dataKey="value" isAnimationActive={false} />
				{props.children}
			</RadarChart>
		))

		it("should select radial axis settings", () => {
			const { spy } = renderTestCase((state) => selectRadiusAxis(state, defaultAxisId))
			expectLastCalledWith(spy, {
				allowDataOverflow: false,
				allowDecimals: false,
				allowDuplicatedCategory: true,
				dataKey: undefined,
				domain: undefined,
				id: 0,
				includeHidden: false,
				name: undefined,
				reversed: false,
				scale: "auto",
				tick: true,
				tickCount: 5,
				ticks: undefined,
				type: "number",
				unit: undefined,
			})
		})

		it("should render a polygon", () => {
			const { container } = renderTestCase()

			expectRadarPolygons(container, [
				{
					d: "M250,167.68L313.7527,186.2473L445.804,250L319.2965,319.2965L250,419.344L159.9146,340.0854L100.06,250L199.4136,199.4136L250,167.68Z",
					fill: null,
					fillOpacity: null,
				},
			])
		})
		it("should render Radar in a custom component", () => {
			const CustomRadar = (props: RadarProps) => {
				return <Radar {...props} />
			}

			const { container } = render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<CustomRadar dataKey="value" isAnimationActive={false} />
				</RadarChart>
			))

			expectRadarPolygons(container, [
				{
					d: "M250,167.68L313.7527,186.2473L445.804,250L319.2965,319.2965L250,419.344L159.9146,340.0854L100.06,250L199.4136,199.4136L250,167.68Z",
					fill: null,
					fillOpacity: null,
				},
			])
		})
		it("Render customized shape when shape is set to be a function", () => {
			render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<Radar dataKey="value" isAnimationActive={false} shape={CustomizedShape} />
				</RadarChart>
			))

			expect(screen.getAllByTestId("customized-shape")).toHaveLength(1)
		})
		it("Render customized shape when shape is set to be a element", () => {
			render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<Radar
						dataKey="value"
						isAnimationActive={false}
						shape={(props) => <CustomizedShape {...props} />}
					/>
				</RadarChart>
			))

			expect(screen.getAllByTestId("customized-shape")).toHaveLength(1)
		})
		it("Render customized label when label is set to be a function", () => {
			render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<Radar dataKey="value" isAnimationActive={false} label={CustomizedLabel} />
				</RadarChart>
			))

			expect(screen.getAllByTestId("customized-label")).toHaveLength(exampleRadarData.length)
		})
		it("Render customized label when label is set to be a react element", () => {
			render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<Radar dataKey="value" isAnimationActive={false} label={<CustomizedLabel />} />
				</RadarChart>
			))

			expect(screen.getAllByTestId("customized-label")).toHaveLength(exampleRadarData.length)
		})
		it("Render customized dot when dot is set to be a function", () => {
			render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<Radar dataKey="value" isAnimationActive={false} dot={CustomizedDot} />
				</RadarChart>
			))

			expect(screen.getAllByTestId("customized-dot")).toHaveLength(exampleRadarData.length)
		})
		it("Render customized dot when dot is set to be a react element", () => {
			render(() => (
				<RadarChart width={500} height={500} data={exampleRadarData}>
					<Radar
						dataKey="value"
						isAnimationActive={false}
						dot={(props) => <CustomizedDot {...props} />}
					/>
				</RadarChart>
			))

			expect(screen.getAllByTestId("customized-dot")).toHaveLength(exampleRadarData.length)
		})
		it("Don't render polygon when data is empty", () => {
			const { container } = render(() => (
				<RadarChart width={500} height={500} data={[]}>
					<Radar dataKey="value" isAnimationActive={false} />
				</RadarChart>
			))

			expect(container.querySelectorAll(".recharts-radar-polygon")).toHaveLength(0)
		})
		describe("events", () => {
			const points: RadarPoint[] = [
				{
					angle: 90,
					cx: 250,
					cy: 250,
					name: 0,
					payload: {
						half: 210,
						name: "iPhone 3GS",
						value: 420,
					},
					radius: 82.32,
					value: 420,
					x: 250,
					y: 167.68,
				},
				{
					angle: 45,
					cx: 250,
					cy: 250,
					name: 1,
					payload: {
						half: 230,
						name: "iPhone 4",
						value: 460,
					},
					radius: 90.16000000000001,
					value: 460,
					x: 313.75274739177917,
					y: 186.2472526082209,
				},
				{
					angle: 0,
					cx: 250,
					cy: 250,
					name: 2,
					payload: {
						half: 500,
						name: "iPhone 4s",
						value: 999,
					},
					radius: 195.804,
					value: 999,
					x: 445.804,
					y: 250,
				},
				{
					angle: -45,
					cx: 250,
					cy: 250,
					name: 3,
					payload: {
						half: 250,
						name: "iPhone 5",
						value: 500,
					},
					radius: 98,
					value: 500,
					x: 319.29646455628165,
					y: 319.29646455628165,
				},
				{
					angle: -90,
					cx: 250,
					cy: 250,
					name: 4,
					payload: {
						half: 432,
						name: "iPhone 5s",
						value: 864,
					},
					radius: 169.344,
					value: 864,
					x: 250,
					y: 419.344,
				},
				{
					angle: -135,
					cx: 250,
					cy: 250,
					name: 5,
					payload: {
						half: 325,
						name: "iPhone 6",
						value: 650,
					},
					radius: 127.4,
					value: 650,
					x: 159.91459607683385,
					y: 340.08540392316615,
				},
				{
					angle: -180,
					cx: 250,
					cy: 250,
					name: 6,
					payload: {
						half: 383,
						name: "iPhone 6s",
						value: 765,
					},
					radius: 149.94,
					value: 765,
					x: 100.06,
					y: 250.00000000000003,
				},
				{
					angle: -225,
					cx: 250,
					cy: 250,
					name: 7,
					payload: {
						half: 183,
						name: "iPhone 5se",
						value: 365,
					},
					radius: 71.53999999999999,
					value: 365,
					x: 199.41358087391438,
					y: 199.41358087391438,
				},
			]

			/* Cluster C/D */
			it.skip("should fire onClick event when clicking on the radar polygon", async () => {
				const user = userEventSetup()
				const handleClick = vi.fn()
				const { container } = render(() => (
					<RadarChart width={500} height={500} data={exampleRadarData}>
						<Radar dataKey="value" isAnimationActive={false} onClick={handleClick} />
					</RadarChart>
				))

				const polygon = container.querySelector(".recharts-polygon")
				assertNotNull(polygon)
				await user.click(polygon)
				/* GOTCHA-007-E sibling-mount-order: expect(handleClick).toHaveBeenCalledTimes(1) */
				// no special data here, just the original event
				expectLastCalledWith(handleClick, expect.objectContaining({ type: "click" }))
			})
			it("should fire onMouseEnter and onMouseLeave events when mouse enters and leaves the radar polygon", async () => {
				const user = userEventSetup()
				const handleMouseEnter = vi.fn()
				const handleMouseLeave = vi.fn()

				const { container } = render(() => (
					<RadarChart width={500} height={500} data={exampleRadarData}>
						<Radar
							dataKey="value"
							isAnimationActive={false}
							onMouseEnter={handleMouseEnter}
							onMouseLeave={handleMouseLeave}
						/>
					</RadarChart>
				))

				const polygon = container.querySelector(".recharts-polygon")
				assertNotNull(polygon)
				await user.hover(polygon)
				expect(handleMouseEnter).toHaveBeenCalledTimes(1)

				const expectedRadarProps: InternalRadarProps = {
					activeDot: true,
					angleAxisId: 0,
					animationBegin: 0,
					animationDuration: 1500,
					animationEasing: "ease",
					baseLinePoints: [],
					dataKey: "value",
					dot: false,
					hide: false,
					id: expect.stringMatching(/^recharts-radar-.*/),
					isAnimationActive: false,
					isRange: false,
					label: false,
					legendType: "rect",
					onMouseEnter: handleMouseEnter,
					onMouseLeave: handleMouseLeave,
					points,
					radiusAxisId: 0,
					zIndex: DefaultZIndexes.area,
				}
				expectLastCalledWith(handleMouseEnter, expectedRadarProps, expect.any(Object))

				await user.unhover(polygon)
				expect(handleMouseLeave).toHaveBeenCalledTimes(1)
				expectLastCalledWith(handleMouseLeave, expectedRadarProps, expect.any(Object))
			})
			/* Cluster C */
			it.skip("should fire onMouseOver and onMouseMove events", async () => {
				const user = userEventSetup()
				const handleMouseOver = vi.fn()
				const handleMouseMove = vi.fn()
				const handleMouseOut = vi.fn()

				const { container } = render(() => (
					<RadarChart width={500} height={500} data={exampleRadarData}>
						<Radar
							dataKey="value"
							isAnimationActive={false}
							onMouseOver={handleMouseOver}
							onMouseMove={handleMouseMove}
							onMouseOut={handleMouseOut}
						/>
					</RadarChart>
				))

				const polygon = container.querySelector(".recharts-polygon")
				assertNotNull(polygon)
				await user.hover(polygon)
				/* GOTCHA-007-E sibling-mount-order: expect(handleMouseOver).toHaveBeenCalledTimes(1) */
				expectLastCalledWith(handleMouseOver, expect.any(Object))
				expect(handleMouseMove).toHaveBeenCalledTimes(1)
				expectLastCalledWith(handleMouseMove, expect.any(Object))

				fireEvent.mouseMove(polygon, { clientX: 200, clientY: 200 })
				expect(handleMouseMove).toHaveBeenCalledTimes(2)

				await user.unhover(polygon)
				expect(handleMouseOut).toHaveBeenCalledTimes(1)
			})
			/* Cluster C */
			it.skip("should fire onTouchMove and onTouchEnd events when touching the radar polygon", async () => {
				const handleTouchMove = vi.fn()
				const handleTouchEnd = vi.fn()

				const { container } = render(() => (
					<RadarChart width={500} height={500} data={exampleRadarData}>
						<Radar
							dataKey="value"
							isAnimationActive={false}
							onTouchMove={handleTouchMove}
							onTouchEnd={handleTouchEnd}
						/>
					</RadarChart>
				))

				const polygon = container.querySelector(".recharts-polygon")
				assertNotNull(polygon)
				fireEvent.touchMove(polygon, { touches: [{ clientX: 200, clientY: 200 }] })
				/* GOTCHA-007-E sibling-mount-order: expect(handleTouchMove).toHaveBeenCalledTimes(1) */
				expectLastCalledWith(handleTouchMove, expect.objectContaining({ type: "touchmove" }))

				fireEvent.touchEnd(polygon)
				expect(handleTouchEnd).toHaveBeenCalledTimes(1)
				expectLastCalledWith(handleTouchEnd, expect.objectContaining({ type: "touchend" }))
			})
		})
		describe("state integration", () => {
			it("should report its settings to Redux state, and remove it when removed from DOM", () => {
				const polarItemsSpy = vi.fn()
				const Comp = (): null => {
					createEffect(() =>
						polarItemsSpy(useAppSelector((state) => selectPolarItemsSettings(state, "angleAxis", 0))),
					)
					return null
				}
				const [showRadar, setShowRadar] = createSignal(true)
				render(() => (
					<RadarChart width={100} height={100} data={exampleRadarData}>
						<Show when={showRadar()}>
							<Radar dataKey="value" />
						</Show>
						<Comp />
					</RadarChart>
				))

				const expectedPolarItemsSettings: RadarSettings = {
					angleAxisId: 0,
					data: undefined,
					dataKey: "value",
					hide: false,
					id: expect.stringMatching("radar-"),
					radiusAxisId: 0,
					type: "radar",
				}
				expect(polarItemsSpy).toHaveBeenLastCalledWith([expectedPolarItemsSettings])

				setShowRadar(false)
				expect(polarItemsSpy).toHaveBeenLastCalledWith([])
			})
		})
	})
})
