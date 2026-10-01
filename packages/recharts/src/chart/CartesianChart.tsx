/* eslint-disable import/no-cycle */
import { createMemo, splitProps } from "solid-js"
import type { ChartOptions } from "../state/optionsSlice"
import { RechartsStateProvider } from "../state/RechartsStateProvider"
import { ChartDataContextProvider } from "../context/chartDataContext"
import { ReportMainChartProps } from "../state/ReportMainChartProps"
import { ReportChartProps } from "../state/ReportChartProps"
import { ReportEventSettings } from "../state/ReportEventSettings"
import type { CartesianChartProps, Margin, TooltipEventType } from "../util/types"
import type { TooltipPayloadSearcher } from "../state/tooltipSlice"
import { CategoricalChart } from "./CategoricalChart"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { initialEventSettingsState } from "../state/eventSettingsSlice"

const defaultMargin: Margin = { bottom: 5, left: 5, right: 5, top: 5 }

export const defaultCartesianChartProps = {
	accessibilityLayer: true,
	barCategoryGap: "10%",
	barGap: 4,
	layout: "horizontal",
	margin: defaultMargin,
	responsive: false,
	reverseStackOrder: false,
	stackOffset: "none",
	syncMethod: "index",
	...initialEventSettingsState,
} as const satisfies Partial<CartesianChartProps>

/**
 * These are one-time, immutable options that decide the chart's behavior.
 * Users who wish to call CartesianChart may decide to pass these options explicitly,
 * but usually we would expect that they use one of the convenience components like BarChart, LineChart, etc.
 */
export type CartesianChartOptions = {
	chartName: string
	defaultTooltipEventType: TooltipEventType
	validateTooltipEventTypes: ReadonlyArray<TooltipEventType>
	tooltipPayloadSearcher: TooltipPayloadSearcher
	categoricalChartProps: CartesianChartProps
	ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
}

function CartesianChartInner(props: {
	categoricalChartProps: CartesianChartProps
	ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
}) {
	/*
	 * Owner MUST be inside RechartsStoreProvider — the memo captures its creation-site owner,
	 * and any createComponent triggered during memo evaluation (via the `children` getter on
	 * the Solid props proxy) inherits that owner. If this memo lived in the outer CartesianChart
	 * component, children instantiated through the spread would be OUTSIDE the store Provider.
	 *
	 * Children must NOT flow through the resolveDefaultProps spread. resolveDefaultProps does
	 * `{...realProps}` which enumerates own keys of the Solid props proxy — reading the
	 * `children` getter eagerly calls createComponent(...) on user JSX (Legend, Tooltip, etc.)
	 * under the CURRENT owner. That owner is inside RechartsStoreProvider but OUTSIDE
	 * RechartsWrapper, so user components miss the LegendPortalContext / TooltipPortalContext
	 * Providers that RechartsWrapper installs. Strip children with splitProps and pass them
	 * as JSX children so the read happens deep inside RechartsWrapper, where all Providers
	 * are visible.
	 */
	/* eslint-disable-next-line solid/reactivity -- splitProps receives the nested prop accessor once; restProps is a reactive proxy, reactivity flows through it */
	const [childrenProps, restProps] = splitProps(props.categoricalChartProps, ["children"])
	const rootChartProps = createMemo(() =>
		resolveDefaultProps(restProps, defaultCartesianChartProps),
	)

	return (
		<>
			<ChartDataContextProvider chartData={rootChartProps().data} />
			<ReportMainChartProps layout={rootChartProps().layout} margin={rootChartProps().margin} />
			<ReportEventSettings
				throttleDelay={rootChartProps().throttleDelay}
				throttledEvents={rootChartProps().throttledEvents}
			/>
			<ReportChartProps
				baseValue={rootChartProps().baseValue}
				accessibilityLayer={rootChartProps().accessibilityLayer}
				barCategoryGap={rootChartProps().barCategoryGap}
				maxBarSize={rootChartProps().maxBarSize}
				stackOffset={rootChartProps().stackOffset}
				barGap={rootChartProps().barGap}
				barSize={rootChartProps().barSize}
				syncId={rootChartProps().syncId}
				syncMethod={rootChartProps().syncMethod}
				className={rootChartProps().className}
				reverseStackOrder={rootChartProps().reverseStackOrder}
			/>
			<CategoricalChart {...rootChartProps()} ref={props.ref}>
				{childrenProps.children}
			</CategoricalChart>
		</>
	)
}

export function CartesianChart(props: CartesianChartOptions) {
	const options = (): ChartOptions => ({
		chartName: props.chartName,
		defaultTooltipEventType: props.defaultTooltipEventType,
		eventEmitter: undefined,
		tooltipPayloadSearcher: props.tooltipPayloadSearcher,
		validateTooltipEventTypes: props.validateTooltipEventTypes,
	})

	return (
		<RechartsStateProvider preloadedState={{ options: options() }}>
			<CartesianChartInner categoricalChartProps={props.categoricalChartProps} ref={props.ref} />
		</RechartsStateProvider>
	)
}
