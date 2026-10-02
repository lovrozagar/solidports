/* @jsxImportSource @solidjs/web */
import { describe, expect, it } from "vitest"
import type { JSX } from '@solidjs/web';
import { createSelectorTestCase } from "../../helper/createSelectorTestCase"
import { AxisDomainTypeInput } from "../../../src/util/types"
import { BarChart, XAxis } from "../../../src"
import { selectXAxisSettings } from "../../../src/state/selectors/axisSelectors"
import { defaultAxisId } from "../../../src/state/cartesianAxisSlice"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"

describe("XAxis type", () => {
	describe("in vertical chart", () => {
		const TestCase = (props: { children?: JSX.Element; axisType?: AxisDomainTypeInput }) => {
			return (
				<BarChart
					layout="vertical"
					width={400}
					height={400}
					data={[
						{ x: "A", y: 12 },
						{ x: "B", y: 5 },
					]}
				>
					<XAxis type={props.axisType} dataKey="x" />
					{props.children}
				</BarChart>
			)
		}

		describe("with default type", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase>{props.children}</TestCase>
			))

			it('should default to "category" type', () => {
				/*
				 * This is unfortunate behavior because in vertical charts you usually want XAxis to be "number"
				 * by default. However, changing this now would be a breaking change.
				 */
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "category" }))
			})
		})
		describe('with explicit "number" type', () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase axisType="number">{props.children}</TestCase>
			))

			it('should set type to "number"', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "number" }))
			})
		})
		describe('with explicit "category" type', () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase axisType="category">{props.children}</TestCase>
			))

			it('should set type to "category"', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "category" }))
			})
		})
		describe('with type="auto"', () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase axisType="auto">{props.children}</TestCase>
			))

			it('should infer type as "number"', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "number" }))
			})
		})
	})
	describe("in horizontal chart", () => {
		const TestCase = (props: { children?: JSX.Element; axisType?: AxisDomainTypeInput }) => {
			return (
				<BarChart
					width={400}
					height={400}
					data={[
						{ x: 12, y: "A" },
						{ x: 5, y: "B" },
					]}
				>
					<XAxis type={props.axisType} dataKey="x" />
					{props.children}
				</BarChart>
			)
		}

		describe("with default type", () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase>{props.children}</TestCase>
			))

			it('should default to "category" type', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "category" }))
			})
		})
		describe('with explicit "number" type', () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase axisType="number">{props.children}</TestCase>
			))

			it('should set type to "number"', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "number" }))
			})
		})
		describe('with explicit "category" type', () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase axisType="category">{props.children}</TestCase>
			))

			it('should set type to "category"', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "category" }))
			})
		})
		describe('with type="auto"', () => {
			const renderTestCase = createSelectorTestCase((props) => (
				<TestCase axisType="auto">{props.children}</TestCase>
			))

			it('should infer type as "category"', () => {
				const { spy } = renderTestCase((state) => selectXAxisSettings(state, defaultAxisId))
				expectLastCalledWith(spy, expect.objectContaining({ type: "category" }))
			})
		})
	})
})
