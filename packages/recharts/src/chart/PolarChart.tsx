/* eslint-disable import/no-cycle */
import { createMemo, untrack } from 'solid-js';
import type { ChartOptions } from "../state/optionsSlice"
import { RechartsStateProvider } from "../state/RechartsStateProvider"
import { createInitialChartDataState, createInitialLayoutState } from "../state/chartState"
import { ChartDataContextProvider } from "../context/chartDataContext"
import { ReportMainChartProps } from "../state/ReportMainChartProps"
import { ReportChartProps } from "../state/ReportChartProps"
import { createInitialRootProps } from "./createInitialRootProps"
import { ReportEventSettings } from "../state/ReportEventSettings"
import { ReportPolarOptions } from "../state/ReportPolarOptions"
import type { Margin, PolarChartProps, TooltipEventType } from "../util/types"
import type { TooltipPayloadSearcher } from "../state/tooltipSlice"
import { CategoricalChart } from "./CategoricalChart"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { initialEventSettingsState } from "../state/eventSettingsSlice"

import { splitProps } from '../util/solid-1-compat';
const defaultMargin: Margin = { bottom: 5, left: 5, right: 5, top: 5 }

/**
 * These default props are the same for all PolarChart components.
 */
export const defaultPolarChartProps = {
	accessibilityLayer: true,
	barCategoryGap: "10%",
	barGap: 4,
	cx: "50%",
	cy: "50%",
	innerRadius: 0,
	layout: "radial",
	margin: defaultMargin,
	outerRadius: "80%",
	responsive: false,
	reverseStackOrder: false,
	stackOffset: "none",
	syncMethod: "index",
	...initialEventSettingsState,
} as const satisfies Partial<PolarChartProps<never>>

/**
 * These props are required for the PolarChart to function correctly.
 * Users usually would not need to specify these explicitly,
 * because the convenience components like PieChart, RadarChart, etc.
 * will provide these defaults.
 * We can't have the defaults in this file because each of those convenience components
 * have their own opinions about what they should be.
 */
type PolarChartPropsWithDefaults = PolarChartProps & {
	cx: NonNullable<PolarChartProps["cx"]>
	cy: NonNullable<PolarChartProps["cy"]>
	startAngle: NonNullable<PolarChartProps["startAngle"]>
	endAngle: NonNullable<PolarChartProps["endAngle"]>
	innerRadius: NonNullable<PolarChartProps["innerRadius"]>
	outerRadius: NonNullable<PolarChartProps["outerRadius"]>
}

/**
 * These are one-time, immutable options that decide the chart's behavior.
 * Users who wish to call CartesianChart may decide to pass these options explicitly,
 * but usually we would expect that they use one of the convenience components like PieChart, RadarChart, etc.
 */
export type PolarChartOptions = {
	chartName: string
	defaultTooltipEventType: TooltipEventType
	validateTooltipEventTypes: ReadonlyArray<TooltipEventType>
	tooltipPayloadSearcher: TooltipPayloadSearcher
	categoricalChartProps: PolarChartPropsWithDefaults
	ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
}

function PolarChartInner(props: {
	categoricalChartProps: PolarChartPropsWithDefaults
	ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
}) {
	/*
	 * See GOTCHA-004 and GOTCHA-005: memo must be created inside RechartsStoreProvider.
	 * resolveDefaultProps spreads the props proxy, which enumerates own keys including
	 * `children`; reading the children getter eagerly instantiates user JSX (Legend,
	 * Tooltip, etc.) under the CURRENT owner. That owner sits above RechartsWrapper, so
	 * those user components miss the LegendPortalContext / TooltipPortalContext Providers.
	 * Strip children with splitProps and pass them as JSX children so the read happens
	 * deep inside RechartsWrapper, where every Provider is visible.
	 */
	/* eslint-disable-next-line solid/reactivity -- splitProps receives the nested prop accessor once; restProps is a reactive proxy, reactivity flows through it */
	const [childrenProps, restProps] = splitProps(props.categoricalChartProps, ["children"])
	const polarChartProps = createMemo(() =>
		resolveDefaultProps(restProps, defaultPolarChartProps),
	)

	return (
		<>
			<ChartDataContextProvider chartData={polarChartProps().data} />
			<ReportMainChartProps layout={polarChartProps().layout} margin={polarChartProps().margin} />
			<ReportEventSettings
				throttleDelay={polarChartProps().throttleDelay}
				throttledEvents={polarChartProps().throttledEvents}
			/>
			<ReportChartProps
				baseValue={undefined}
				accessibilityLayer={polarChartProps().accessibilityLayer}
				barCategoryGap={polarChartProps().barCategoryGap}
				maxBarSize={polarChartProps().maxBarSize}
				stackOffset={polarChartProps().stackOffset}
				barGap={polarChartProps().barGap}
				barSize={polarChartProps().barSize}
				syncId={polarChartProps().syncId}
				syncMethod={polarChartProps().syncMethod}
				className={polarChartProps().className}
				reverseStackOrder={polarChartProps().reverseStackOrder}
			/>
			<ReportPolarOptions
				cx={polarChartProps().cx}
				cy={polarChartProps().cy}
				startAngle={polarChartProps().startAngle}
				endAngle={polarChartProps().endAngle}
				innerRadius={polarChartProps().innerRadius}
				outerRadius={polarChartProps().outerRadius}
			/>
			<CategoricalChart
				{...(() => {
					const { layout: _layout, ...rest } = polarChartProps()
					return rest
				})()}
				ref={props.ref}
			>
				{childrenProps.children}
			</CategoricalChart>
		</>
	)
}

export function PolarChart(props: PolarChartOptions) {
	const options = (): ChartOptions => ({
		chartName: props.chartName,
		defaultTooltipEventType: props.defaultTooltipEventType,
		eventEmitter: undefined,
		tooltipPayloadSearcher: props.tooltipPayloadSearcher,
		validateTooltipEventTypes: props.validateTooltipEventTypes,
	})

	const initialChartData = () =>
		untrack(() => createInitialChartDataState(props.categoricalChartProps.data))
	const initialLayout = () =>
		untrack(() =>
			createInitialLayoutState({
				height: props.categoricalChartProps.height,
				layoutType: props.categoricalChartProps.layout ?? defaultPolarChartProps.layout,
				margin: props.categoricalChartProps.margin ?? defaultPolarChartProps.margin,
				width: props.categoricalChartProps.width,
			}),
		)

	return (
		<RechartsStateProvider preloadedState={{
				chartData: initialChartData(),
				layout: initialLayout(),
				options: options(),
				rootProps: untrack(() => createInitialRootProps(props.categoricalChartProps)),
			}}>
			<PolarChartInner categoricalChartProps={props.categoricalChartProps} ref={props.ref} />
		</RechartsStateProvider>
	)
}
