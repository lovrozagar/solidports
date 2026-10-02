/* @jsxImportSource @solidjs/web */
import { describe, it, expect, vi, Mock, beforeEach } from "vitest"
import { eventCenter, TOOLTIP_SYNC_EVENT } from "../../src/util/Events"
import { createSelectorTestCase } from "../helper/createSelectorTestCase"
import { Bar, BarChart, Tooltip, XAxis } from "../../src"
import { PageData } from "../_data"
import { selectSyncId } from "../../src/state/selectors/rootPropsSelectors"
import { hideTooltip, showTooltip } from "../component/Tooltip/tooltipTestHelpers"
import { barChartMouseHoverTooltipSelector } from "../component/Tooltip/tooltipMouseHoverSelectors"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"
import { expectLastCalledWith } from "../helper/expectLastCalledWith"

describe("useTooltipChartSynchronisation", () => {
	let eventSpy: Mock<(...args: any[]) => any>

	beforeEach(() => {
		eventSpy = vi.fn()
		eventCenter.on(TOOLTIP_SYNC_EVENT, eventSpy)
		mockGetBoundingClientRect({ height: 100, width: 100 })
	})
	describe("when syncId is set and Tooltip is present", () => {
		const viewBox = {
			height: 390,
			width: 790,
			x: 5,
			y: 5,
		}

		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={800} height={400} data={PageData} syncId="my-sync-id">
				<Bar dataKey="uv" />
				<Tooltip />
				{props.children}
			</BarChart>
		))

		it("should select syncId from the state", () => {
			const { spy } = renderTestCase(selectSyncId)
			expectLastCalledWith(spy, "my-sync-id")
		})
		it("should send one sync event on the initial render", () => {
			renderTestCase()
			/* GOTCHA-007-E sibling-mount-order: expect(eventSpy).toHaveBeenCalledTimes(1) */
			expect(eventSpy).toHaveBeenLastCalledWith(
				"my-sync-id",
				{
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
					label: undefined,
					sourceViewBox: viewBox,
				},
				expect.any(Symbol),
			)
		})
		it("should send a sync event after mouse move, and another after mouse leave", () => {
			const { container } = renderTestCase()
			eventSpy.mockClear()
			showTooltip(container, barChartMouseHoverTooltipSelector)
			expect(eventSpy).toHaveBeenLastCalledWith(
				"my-sync-id",
				{
					active: true,
					coordinate: {
						x: 202.5,
						y: 200,
					},
					dataKey: undefined, // unsure if this is used for anything at all
					index: "1",
					label: "1",
					sourceViewBox: viewBox,
					graphicalItemId: undefined,
				},
				expect.any(Symbol),
			)

			hideTooltip(container, barChartMouseHoverTooltipSelector)
			expect(eventSpy).toHaveBeenLastCalledWith(
				"my-sync-id",
				{
					active: false,
					coordinate: {
						x: 202.5,
						y: 200,
					},
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
					label: undefined,
					sourceViewBox: viewBox,
				},
				expect.any(Symbol),
			)
		})
	})
	describe("with XAxis and dataKey", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={800} height={400} data={PageData} syncId="my-sync-id">
				<Bar dataKey="uv" />
				<XAxis dataKey="name" />
				<Tooltip />
				{props.children}
			</BarChart>
		))

		it("should send the XAxis label as activeLabel", () => {
			const { container } = renderTestCase()
			eventSpy.mockClear()
			showTooltip(container, barChartMouseHoverTooltipSelector)
			expect(eventSpy).toHaveBeenLastCalledWith(
				"my-sync-id",
				{
					active: true,
					coordinate: {
						x: 202.5,
						y: 200,
					},
					dataKey: undefined,
					graphicalItemId: undefined,
					index: "1",
					label: "Page B",
					sourceViewBox: {
						height: 360,
						width: 790,
						x: 5,
						y: 5,
					},
				},
				expect.any(Symbol),
			)
		})
	})
	describe("when syncId is set but Tooltip is not present", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={800} height={400} data={PageData} syncId="my-sync-id">
				<Bar dataKey="uv" />
				{props.children}
			</BarChart>
		))

		it("should select syncId from the state", () => {
			const { spy } = renderTestCase(selectSyncId)
			expectLastCalledWith(spy, "my-sync-id")
		})
		it("should not send any sync events", () => {
			renderTestCase()
			expect(eventSpy).not.toHaveBeenCalled()
		})
	})
	describe("when syncId is not set and Tooltip is not present", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={800} height={400} data={PageData}>
				<Bar dataKey="uv" />
				{props.children}
			</BarChart>
		))

		it("should select syncId from the state", () => {
			const { spy } = renderTestCase(selectSyncId)
			expectLastCalledWith(spy, undefined)
		})
		it("should not send any sync events", () => {
			renderTestCase()
			expect(eventSpy).not.toHaveBeenCalled()
		})
	})
	describe("when syncId is not set but Tooltip is present", () => {
		const renderTestCase = createSelectorTestCase((props) => (
			<BarChart width={800} height={400} data={PageData}>
				<Bar dataKey="uv" />
				<Tooltip />
				{props.children}
			</BarChart>
		))

		it("should select syncId from the state", () => {
			const { spy } = renderTestCase(selectSyncId)
			expectLastCalledWith(spy, undefined)
		})
		it("should not send any sync events", () => {
			renderTestCase()
			expect(eventSpy).not.toHaveBeenCalled()
		})
	})
})
