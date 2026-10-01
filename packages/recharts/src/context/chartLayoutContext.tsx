/* eslint-disable import/no-cycle */
import { createRenderEffect } from "solid-js"
import type {
	CartesianLayout,
	CartesianViewBoxRequired,
	ChartOffsetInternal,
	LayoutType,
	Margin,
	Percent,
	PolarLayout,
	TrapezoidViewBox,
} from "../util/types"
import { useChartStore } from "../state/RechartsStoreContext"
import type { ChartState } from "../state/store"
import { selectChartViewBox } from "../state/selectors/selectChartOffsetInternal"
import { selectChartHeight, selectChartWidth } from "../state/selectors/containerSelectors"
import { useIsPanorama } from "./PanoramaContext"
import { selectBrushDimensions, selectBrushSettings } from "../state/selectors/brushSelectors"
import { useResponsiveContainerContext } from "../component/ResponsiveContainer"
import { isPositiveNumber } from "../util/isWellBehavedNumber"
import { useChartOffsetInternal as useChartOffsetInternalShared } from "../state/hooks/useChartSelectors"

export function cartesianViewBoxToTrapezoid(box: undefined): undefined
export function cartesianViewBoxToTrapezoid(
	box: CartesianViewBoxRequired | TrapezoidViewBox,
): TrapezoidViewBox
export function cartesianViewBoxToTrapezoid(
	box: CartesianViewBoxRequired | TrapezoidViewBox | undefined,
): TrapezoidViewBox | undefined {
	if (box == null) {
		return undefined
	}
	return {
		height: box.height,
		lowerWidth: "lowerWidth" in box ? box.lowerWidth : box.width,
		upperWidth: "upperWidth" in box ? box.upperWidth : box.width,
		width: box.width,
		x: box.x,
		y: box.y,
	}
}

/**
 * Returns the chart viewBox. Reactive when called inside a tracked scope
 * (JSX, `createMemo`, `createEffect`). See GOTCHA-011.
 */
export const useViewBox = (): CartesianViewBoxRequired | undefined => {
	const panorama = useIsPanorama()
	const ctx = useChartStore()
	if (!ctx) {
		return undefined
	}
	const rootViewBox = selectChartViewBox(ctx.store)
	const brushDimensions = selectBrushDimensions(ctx.store)
	const brushPadding = selectBrushSettings(ctx.store)?.padding
	if (panorama === false || brushDimensions == null || brushPadding == null) {
		return rootViewBox
	}
	return {
		height: brushDimensions.height - brushPadding.top - brushPadding.bottom,
		width: brushDimensions.width - brushPadding.left - brushPadding.right,
		x: brushPadding.left,
		y: brushPadding.top,
	}
}

const manyComponentsThrowErrorsIfOffsetIsUndefined: ChartOffsetInternal = {
	bottom: 0,
	brushBottom: 0,
	height: 0,
	left: 0,
	right: 0,
	top: 0,
	width: 0,
}
/**
 * For internal use only. If you want this information, `import { useOffset } from 'recharts'` instead.
 *
 * Returns the chart offset in pixels — bare value matching upstream React API.
 * Reactivity comes from the store proxy property reads inside selector — when
 * called inside a reactive scope (createMemo/createEffect/JSX), the call
 * tracks store changes. Call this hook eagerly inside such scopes; calling it
 * once at component setup snapshots the value at that moment.
 */
export const useOffsetInternal = (): ChartOffsetInternal =>
	useChartOffsetInternalShared() ?? manyComponentsThrowErrorsIfOffsetIsUndefined

/**
 * Returns the chart width in pixels. Reactive when called inside a tracked scope
 * (JSX, `createMemo`, `createEffect`). See GOTCHA-011.
 */
export const useChartWidth = (): number | undefined => {
	const ctx = useChartStore()
	return ctx ? selectChartWidth(ctx.store) : undefined
}

/**
 * Returns the chart height in pixels. Reactive when called inside a tracked scope
 * (JSX, `createMemo`, `createEffect`). See GOTCHA-011.
 */
export const useChartHeight = (): number | undefined => {
	const ctx = useChartStore()
	return ctx ? selectChartHeight(ctx.store) : undefined
}

/**
 * Returns the user-declared chart margin. Reactive when called inside a tracked scope.
 */
export const useMargin = (): Margin | undefined => {
	const ctx = useChartStore()
	return ctx?.store.layout.margin
}

export const selectChartLayout = (state: ChartState): LayoutType => state.layout.layoutType

export const useChartLayout = (): LayoutType | undefined => {
	const ctx = useChartStore()
	return ctx ? selectChartLayout(ctx.store) : undefined
}

export const useCartesianChartLayout = (): CartesianLayout | undefined => {
	const l = useChartLayout()
	if (l === "horizontal" || l === "vertical") {
		return l
	}
	return undefined
}

export const selectPolarChartLayout = (state: ChartState): PolarLayout | undefined => {
	const layout = state.layout.layoutType
	if (layout === "centric" || layout === "radial") {
		return layout
	}
	return undefined
}

export const usePolarChartLayout = (): PolarLayout | undefined => {
	const ctx = useChartStore()
	return ctx ? selectPolarChartLayout(ctx.store) : undefined
}

/**
 * Returns true if the component is rendered inside a chart context. Reactive when
 * called inside a tracked scope.
 */
export const useIsInChartContext = (): boolean => {
	return useChartLayout() !== undefined
}

export const ReportChartSize = (props: {
	height: number | Percent | undefined
	width: number | Percent | undefined
}): null => {
	const ctx = useChartStore()

	/*
	 * Skip dispatching properties in panorama chart for two reasons:
	 * 1. The root chart should be deciding on these properties, and
	 * 2. Brush reads these properties from redux store, and so they must remain stable
	 *      to avoid circular dependency and infinite re-rendering.
	 */
	const isPanorama = useIsPanorama()

	const responsiveContainerCalculations = useResponsiveContainerContext()

	/* createRenderEffect dispatches during setup so size/margin land before
	   downstream sibling components run their own setup. Tests asserting
	   `useOffsetInternal()` returns the populated offset on first synchronous
	   read depend on this ordering (React's render-time layout effects). */
	createRenderEffect(() => {
		let width = props.width
		let height = props.height

		if (responsiveContainerCalculations) {
			/*
			 * In case we receive width and height from ResponsiveContainer,
			 * we will always prefer those.
			 * Only in case ResponsiveContainer does not provide width or height,
			 * we will fall back to the explicitly provided width and height.
			 *
			 * This to me feels backwards - we should allow override by the more specific props on individual charts, right?
			 * But this is 3.x behaviour, so let's keep it for backwards compatibility.
			 *
			 * We can change this in 4.x if we want to.
			 */
			width =
				responsiveContainerCalculations.width > 0
					? responsiveContainerCalculations.width
					: props.width
			height =
				responsiveContainerCalculations.height > 0
					? responsiveContainerCalculations.height
					: props.height
		}

		if (isPanorama === false && isPositiveNumber(width) && isPositiveNumber(height)) {
			ctx?.setStore("layout", "width", width)
			ctx?.setStore("layout", "height", height)
		}
	})

	return null
}

export const ReportChartMargin = (props: { margin: Partial<Margin> }): null => {
	const ctx = useChartStore()
	createRenderEffect(() => {
		const m = props.margin
		ctx?.setStore("layout", "margin", {
			bottom: m.bottom ?? 0,
			left: m.left ?? 0,
			right: m.right ?? 0,
			top: m.top ?? 0,
		})
	})
	return null
}
