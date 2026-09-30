/* eslint-disable import/no-cycle, sort-keys */
import { type Component, createMemo, type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { clsx } from "clsx"
import type {
	ChartOffsetInternal,
	Coordinate,
	LayoutType,
	PolarCoordinate,
	TooltipEventType,
} from "../util/types"
import { isPolarCoordinate } from "../util/types"
import { Curve } from "../shape/Curve"
import { Cross } from "../shape/Cross"
import { getCursorRectangle } from "../util/cursor/getCursorRectangle"
import { Rectangle } from "../shape/Rectangle"
import { getRadialCursorPoints } from "../util/cursor/getRadialCursorPoints"
import { Sector } from "../shape/Sector"
import { getCursorPoints } from "../util/cursor/getCursorPoints"
import { useChartLayout, useOffsetInternal } from "../context/chartLayoutContext"
import { useTooltipAxisBandSize } from "../context/useTooltipAxis"
import { useChartName } from "../state/selectors/selectors"
import type { TooltipIndex, TooltipPayload } from "../state/tooltipSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import { svgPropertiesNoEventsFromUnknown } from "../util/svgPropertiesNoEvents"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

/**
 * If set false, no cursor will be drawn when tooltip is active.
 * If set an object, the option is the configuration of cursor.
 * If set a JSX element, the option is the custom element of drawing cursor
 */
export type CursorDefinition = boolean | JSX.Element | Record<string, unknown>

export interface CursorProps extends ZIndexable {
	cursor: CursorDefinition
	tooltipEventType: TooltipEventType
	coordinate: Coordinate | PolarCoordinate | undefined
	payload: TooltipPayload
	index: TooltipIndex | undefined
}

export type CursorConnectedProps = CursorProps & {
	tooltipAxisBandSize: number
	layout: LayoutType
	offset: ChartOffsetInternal
	chartName: string
}

function RenderCursor(props: {
	cursor: CursorDefinition
	cursorComp: Component<Record<string, unknown>>
	cursorProps: Record<string, unknown>
}) {
	/* eslint-disable solid/reactivity -- cursor type is structural (stable at mount); nodeType check runs once */
	if (typeof props.cursor === "object" && props.cursor != null && "nodeType" in props.cursor) {
		/* JSX element passed directly -- not common in Solid, but handle gracefully */
		return props.cursor as JSX.Element
	}
	/* eslint-enable solid/reactivity */
	/* Spread props.cursorProps via Dynamic — props is a Solid props proxy, so each
	   property read flows through reactively. The plain-literal returned by the
	   parent's accessor is wrapped in the proxy via parent's `cursorProps={...}`
	   getter compiled by Solid. */
	return <Dynamic component={props.cursorComp} {...props.cursorProps} />
}

export function CursorInternal(props: CursorConnectedProps) {
	/* GOTCHA-017 (cursor reactivity): each piece is a SEPARATE reactive accessor.
	   The previous version used a single createMemo returning a fresh object literal —
	   plain object spread on Dynamic enumerates keys once and freezes points/d.
	   Per-key accessors via mergeProps make Dynamic's spread track each value live. */
	const isVisible = (): boolean =>
		Boolean(
			props.cursor &&
				props.coordinate != null &&
				(props.chartName === "ScatterChart" || props.tooltipEventType === "axis"),
		)
	const cursorComp = (): Component<Record<string, unknown>> => {
		if (props.chartName === "ScatterChart") return Cross as Component<Record<string, unknown>>
		if (props.chartName === "BarChart") return Rectangle as Component<Record<string, unknown>>
		if (
			props.layout === "radial" &&
			props.coordinate != null &&
			isPolarCoordinate(props.coordinate as Coordinate | PolarCoordinate)
		) {
			return Sector as Component<Record<string, unknown>>
		}
		return Curve as Component<Record<string, unknown>>
	}
	const preferredZIndex = (): number => {
		if (props.chartName === "BarChart") return DefaultZIndexes.cursorRectangle
		return DefaultZIndexes.cursorLine
	}
	const restPropsObj = (): Record<string, unknown> => {
		const coord = props.coordinate
		if (coord == null) return {}
		if (props.chartName === "ScatterChart") {
			return coord as unknown as Record<string, unknown>
		}
		if (props.chartName === "BarChart") {
			return getCursorRectangle(
				props.layout,
				coord as Coordinate,
				props.offset,
				props.tooltipAxisBandSize,
			) as unknown as Record<string, unknown>
		}
		if (props.layout === "radial" && isPolarCoordinate(coord as Coordinate | PolarCoordinate)) {
			const { cx, cy, radius, startAngle, endAngle } = getRadialCursorPoints(
				coord as PolarCoordinate,
			)
			return { cx, cy, endAngle, innerRadius: radius, outerRadius: radius, startAngle }
		}
		return { points: getCursorPoints(props.layout, coord as Coordinate, props.offset) }
	}
	const extraClassName = (): string | undefined => {
		const cursorObj =
			typeof props.cursor === "object" && props.cursor != null ? props.cursor : undefined
		return cursorObj && "className" in cursorObj ? String(cursorObj.className) : undefined
	}
	const cursorProps = (): Record<string, unknown> => ({
		stroke: "#ccc",
		"pointer-events": "none",
		...props.offset,
		...restPropsObj(),
		...svgPropertiesNoEventsFromUnknown(props.cursor),
		payload: props.payload,
		payloadIndex: props.index,
		class: clsx("recharts-tooltip-cursor", extraClassName()),
	})

	return (
		<Show when={isVisible()}>
			<ZIndexLayer zIndex={props.zIndex ?? preferredZIndex()}>
				<RenderCursor
					cursor={props.cursor}
					cursorComp={cursorComp()}
					cursorProps={cursorProps()}
				/>
			</ZIndexLayer>
		</Show>
	)
}

/*
 * Cursor is the background, or a highlight,
 * that shows when user mouses over or activates
 * an area.
 *
 * It usually shows together with a tooltip
 * to emphasise which part of the chart does the tooltip refer to.
 */
export function Cursor(props: CursorProps) {
	const ctx = useChartStore()
	/* All public/internal hooks bare T (GOTCHA-011). Arrow-thunk pattern
	   preserves callsite shape and re-runs the selector on each reactive read. */
	const tooltipAxisBandSize = () => useTooltipAxisBandSize()
	const offset = () => useOffsetInternal()
	const layout = () => useChartLayout()
	const chartName = createMemo(() => (ctx ? useChartName(ctx.store) : undefined))

	return (
		<Show
			when={
				tooltipAxisBandSize() != null &&
				offset() != null &&
				layout() != null &&
				chartName() != null
			}
		>
			<CursorInternal
				{...props}
				offset={offset()}
				layout={layout() as NonNullable<ReturnType<typeof layout>>}
				tooltipAxisBandSize={tooltipAxisBandSize() as NonNullable<ReturnType<typeof tooltipAxisBandSize>>}
				chartName={chartName() as NonNullable<ReturnType<typeof chartName>>}
			/>
		</Show>
	)
}
