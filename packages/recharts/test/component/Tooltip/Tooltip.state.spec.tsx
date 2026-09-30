/* @jsxImportSource solid-js */
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { LineChart, Tooltip } from "../../../src"
import type { TooltipSettingsState } from "../../../src/state/tooltipSlice"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"

describe("Tooltip state integration", () => {
	describe("with explicit settings", () => {
		const renderTestCase = createSelectorTestCase((props: { children: any }) => (
			<LineChart width={1} height={1}>
				<Tooltip shared trigger="click" axisId="my-axis-id" active defaultIndex={4} />
				{props.children}
			</LineChart>
		))

		test("should publish its settings to Redux store", () => {
			const { spy } = renderTestCase((state) => state.tooltip.settings)
			const expected: TooltipSettingsState = {
				active: true,
				axisId: "my-axis-id",
				defaultIndex: "4",
				shared: true,
				trigger: "click",
			}
			expectLastCalledWith(spy, expected)
		})
	})
	describe("with default settings", () => {
		const renderTestCase = createSelectorTestCase((props: { children: any }) => (
			<LineChart width={1} height={1}>
				<Tooltip />
				{props.children}
			</LineChart>
		))

		test("should publish its settings to Redux store", () => {
			const { spy } = renderTestCase((state) => state.tooltip.settings)
			const expected: TooltipSettingsState = {
				active: undefined,
				axisId: 0,
				defaultIndex: undefined,
				shared: undefined,
				trigger: "hover",
			}
			expectLastCalledWith(spy, expected)
		})
	})
	describe("with implicit settings", () => {
		const renderTestCase = createSelectorTestCase((props: { children: any }) => (
			<LineChart width={1} height={1}>
				{props.children}
			</LineChart>
		))

		test("should read initial settings from Redux store", () => {
			const { spy } = renderTestCase((state) => state.tooltip.settings)
			const expected: TooltipSettingsState = {
				active: false,
				axisId: 0,
				defaultIndex: undefined,
				shared: undefined,
				trigger: "hover",
			}
			expectLastCalledWith(spy, expected)
		})
	})
})
