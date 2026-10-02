import { fireEvent } from "../helper/render"
import { trackSpy } from "../helper/trackSpy"
import { describe, expect, it, Mock, vi } from "vitest"
import { Customized, SunburstChart } from "../../src"
import { exampleSunburstData } from "../_data"
import { useChartHeight, useChartWidth, useViewBox } from "../../src/context/chartLayoutContext"
import { useAppSelector } from "../helper/legacyDispatch"
import { sunburstChartMouseHoverTooltipSelector } from "../component/Tooltip/tooltipMouseHoverSelectors"
import { assertNotNull } from "../helper/assertNotNull"

import { useClipPathId } from "../../src/container/ClipPathProvider"
import { rechartsTestRender } from "../helper/createSelectorTestCase"
import { userEventSetup } from "../helper/userEventSetup"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"
import { TooltipInteractionState } from "../../src/state/tooltipSlice"

describe("<Sunburst />", () => {
	it("renders each sector in order under the correct category", () => {
		const { container } = rechartsTestRender(() => (
			<SunburstChart width={500} height={500} data={exampleSunburstData} />
		))

		const sectors = container.querySelectorAll(".recharts-sector")

		expect(sectors[0]).toHaveAttribute("fill", "#264653")
		expect(sectors[1]).toHaveAttribute("fill", "#264653")
		expect(sectors[2]).toHaveAttribute("fill", "#2a9d8f")
		expect(sectors[3]).toHaveAttribute("fill", "#2a9d8f")
		expect(sectors[4]).toHaveAttribute("fill", "#e9c46a")
	})

	it("fires callbacks upon hover and click events", async () => {
		const user = userEventSetup()
		const onMouseEnter = vi.fn()
		const onMouseLeave = vi.fn()
		const onClick = vi.fn()

		const { container } = rechartsTestRender(() => (
			<SunburstChart
				width={500}
				height={500}
				onClick={onClick}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				data={exampleSunburstData}
			/>
		))
		const sector = container.querySelectorAll(".recharts-sector")[0]

		await user.hover(sector)
		expect(onMouseEnter).toHaveBeenCalled()
		expectLastCalledWith(
			onMouseEnter,
			{
				children: [
					{
						name: "third child",
						value: 10,
					},
				],
				fill: "#264653",
				name: "Child1",
				tooltipIndex: "[0]",
				value: 30,
			},
			expect.any(Object),
		)

		await user.unhover(sector)
		expect(onMouseLeave).toHaveBeenCalled()
		expectLastCalledWith(
			onMouseLeave,
			{
				children: [
					{
						name: "third child",
						value: 10,
					},
				],
				fill: "#264653",
				name: "Child1",
				tooltipIndex: "[0]",
				value: 30,
			},
			expect.any(Object),
		)

		await user.click(sector)
		expect(onClick).toHaveBeenCalled()
		// click doesn't add the original event, not sure why?
		expectLastCalledWith(onClick, {
			children: [
				{
					name: "third child",
					value: 10,
				},
			],
			fill: "#264653",
			name: "Child1",
			tooltipIndex: "[0]",
			value: 30,
		})
	})

	it("does not call touch event callbacks", async () => {
		const onTouchMove = vi.fn()
		const onTouchEnd = vi.fn()

		const { container } = rechartsTestRender(() => (
			<SunburstChart
				width={500}
				height={500}
				// @ts-expect-error typescript is correct here - indeed SunburstChart does not fire touch events
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				data={exampleSunburstData}
			/>
		))
		const sector = container.querySelectorAll(".recharts-sector")[0]

		fireEvent.touchMove(sector, { touches: [{ clientX: 200, clientY: 200 }] })
		expect(onTouchMove).not.toHaveBeenCalled()
	})

	describe("SunburstChart layout context", () => {
		it("should provide viewBox but not clipPathId", () => {
			const clipPathSpy = vi.fn()
			const viewBoxSpy = vi.fn()
			const Comp = (): null => {
				trackSpy(clipPathSpy, () => useClipPathId())
				trackSpy(viewBoxSpy, () => useViewBox())
				return null
			}
			rechartsTestRender(() => (
				<SunburstChart width={100} height={50} data={exampleSunburstData}>
					<Customized component={<Comp />} />
				</SunburstChart>
			))

			expect(clipPathSpy).toHaveBeenLastCalledWith(null)
			expect(viewBoxSpy).toHaveBeenLastCalledWith({ height: 50, width: 100, x: 0, y: 0 })
			/* Solid computes once; upstream React renders twice */
			expect(viewBoxSpy).toHaveBeenCalledTimes(1)
		})

		it("should set width and height in context", () => {
			const widthSpy = vi.fn()
			const heightSpy = vi.fn()
			const Comp = (): null => {
				trackSpy(widthSpy, () => useChartWidth())
				trackSpy(heightSpy, () => useChartHeight())
				return null
			}
			rechartsTestRender(() => (
				<SunburstChart width={100} height={50} data={exampleSunburstData}>
					<Customized component={<Comp />} />
				</SunburstChart>
			))
			expect(widthSpy).toHaveBeenLastCalledWith(100)
			expect(heightSpy).toHaveBeenLastCalledWith(50)
			/* Solid computes once; upstream React renders twice */
			expect(widthSpy).toHaveBeenCalledTimes(1)
			expect(heightSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe("tooltip state", () => {
		it("should start with tooltip inactive, and activate it on hover and click on a link", () => {
			const tooltipStateSpy: Mock<
				(
					state: { click: TooltipInteractionState; hover: TooltipInteractionState } | undefined,
				) => void
			> = vi.fn()
			const Comp = (): null => {
				/* copy the fields so the fine-grained store read tracks them, like a Redux re-render */
				trackSpy(tooltipStateSpy, () =>
					useAppSelector((state) => ({
						click: { ...state.tooltip.itemInteraction.click },
						hover: { ...state.tooltip.itemInteraction.hover },
					})),
				)
				return null
			}
			const { container } = rechartsTestRender(() => (
				<SunburstChart width={1000} height={500} data={exampleSunburstData}>
					<Customized component={<Comp />} />
				</SunburstChart>
			))
			expect(tooltipStateSpy).toHaveBeenLastCalledWith({
				click: {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					index: null,
				},
				hover: {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					index: null,
				},
			})
			expect(tooltipStateSpy).toHaveBeenCalledTimes(1)

			const tooltipTriggerElement = container.querySelector(sunburstChartMouseHoverTooltipSelector)
			assertNotNull(tooltipTriggerElement)

			fireEvent.mouseOver(tooltipTriggerElement, { clientX: 200, clientY: 200 })

			expectLastCalledWith(tooltipStateSpy, {
				click: {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
				},
				hover: {
					active: true,
					coordinate: {
						x: 583.3333333333334,
						y: 250,
					},
					dataKey: "value",
					graphicalItemId: expect.stringMatching(/^recharts-sunburst-.+/),
					index: "[0]",
				},
			})
			expect(tooltipStateSpy).toHaveBeenCalledTimes(2)

			fireEvent.click(tooltipTriggerElement)

			expectLastCalledWith(tooltipStateSpy, {
				click: {
					active: true,
					coordinate: {
						x: 583.3333333333334,
						y: 250,
					},
					dataKey: "value",
					graphicalItemId: expect.stringMatching(/^recharts-sunburst-.+/),
					index: "[0]",
				},
				hover: {
					active: true,
					coordinate: {
						x: 583.3333333333334,
						y: 250,
					},
					dataKey: "value",
					graphicalItemId: expect.stringMatching(/^recharts-sunburst-.+/),
					index: "[0]",
				},
			})
			expect(tooltipStateSpy).toHaveBeenCalledTimes(3)

			fireEvent.mouseLeave(tooltipTriggerElement)

			expectLastCalledWith(tooltipStateSpy, {
				click: {
					active: true,
					coordinate: {
						x: 583.3333333333334,
						y: 250,
					},
					dataKey: "value",
					graphicalItemId: expect.stringMatching(/^recharts-sunburst-.+/),
					index: "[0]",
				},
				hover: {
					active: false,
					coordinate: {
						x: 583.3333333333334,
						y: 250,
					},
					dataKey: "value",
					graphicalItemId: expect.stringMatching(/^recharts-sunburst-.+/),
					index: "[0]",
				},
			})
			expect(tooltipStateSpy).toHaveBeenCalledTimes(4)
		})
	})
})
