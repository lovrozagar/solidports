/* eslint-disable import/no-cycle */
import { createMemo, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ActiveDotProps, ActiveDotType, DataKey } from "../util/types"
import { adaptEventHandlers } from "../util/types"
import { Dot } from "../shape/Dot"
import { Layer } from "../container/Layer"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectActiveTooltipIndex } from "../state/selectors/tooltipSelectors"
import { useActiveTooltipDataPoints } from "../hooks"
import { isNullish } from "../util/DataUtils"
import { svgPropertiesNoEventsFromUnknown } from "../util/svgPropertiesNoEvents"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { cloneJsxNodeWithProps, isJsxNode } from "../util/ReactUtils"

export interface PointType {
	readonly x: number | null
	readonly y: number | null
	readonly value?: unknown
	readonly payload?: unknown
}

function ActivePoint(props: {
	point: PointType
	activeDot: ActiveDotType
	childIndex: number
	dataKey: DataKey<unknown> | undefined
	/**
	 * Different graphical elements have different opinion on what is their main color.
	 * Sometimes stroke, sometimes fill, sometimes combination.
	 */
	mainColor: string | undefined
	clipPath?: string
}): JSX.Element {
	return <>{renderActivePoint(props)}</>
}

/* Runs inside ActivePoint's JSX expression so every reactive read is tracked. */
function renderActivePoint(props: {
	point: PointType
	activeDot: ActiveDotType
	childIndex: number
	dataKey: DataKey<unknown> | undefined
	/**
	 * Different graphical elements have different opinion on what is their main color.
	 * Sometimes stroke, sometimes fill, sometimes combination.
	 */
	mainColor: string | undefined
	clipPath?: string
}) {
	/* eslint-disable solid/reactivity -- activeDot/point checks are structural guards; dotProps is a reactive accessor that re-reads props on each call */
	if (props.activeDot === false || props.point.x == null || props.point.y == null) {
		return null
	}

	const dotProps = createMemo(
		(): ActiveDotProps =>
			/* eslint-disable sort-keys -- upstream key order becomes the DOM attribute order */
			({
				index: props.childIndex,
				dataKey: props.dataKey,
				cx: props.point.x,
				cy: props.point.y,
				r: 4,
				fill: props.mainColor ?? "none",
				strokeWidth: 2,
				stroke: "#fff",
				payload: props.point.payload,
				value: props.point.value,
				/* eslint-enable sort-keys */
				...svgPropertiesNoEventsFromUnknown(props.activeDot),
				...(typeof props.activeDot === "object" && props.activeDot !== null
					? adaptEventHandlers(props.activeDot as Record<string, unknown>)
					: {}),
			}) as ActiveDotProps,
	)
	/* eslint-enable solid/reactivity */

	const renderDot = (): JSX.Element => {
		if (typeof props.activeDot === "function") {
			return (props.activeDot as (p: ActiveDotProps) => JSX.Element)(dotProps())
		}
		if (isJsxNode(props.activeDot)) {
			return cloneJsxNodeWithProps(
				props.activeDot,
				dotProps() as unknown as Record<string, unknown>,
			) as unknown as JSX.Element
		}
		return <Dot {...dotProps()} />
	}

	return (
		<Layer class="recharts-active-dot" clip-path={props.clipPath}>
			{renderDot()}
		</Layer>
	)
}

interface ActivePointsProps extends ZIndexable {
	points: ReadonlyArray<PointType>
	/**
	 * Different graphical elements have different opinion on what is their main color.
	 * Sometimes stroke, sometimes fill, sometimes combination.
	 * `undefined` means that the color is not set, and the point will be transparent.
	 */
	mainColor: string | undefined
	itemDataKey: DataKey<unknown> | undefined
	activeDot: ActiveDotType
	clipPath?: string
}

export function ActivePoints(props: ActivePointsProps) {
	const ctx = useChartStore()
	const zIndex = () => props.zIndex ?? DefaultZIndexes.activeDot
	const activeTooltipIndex = createMemo(() =>
		ctx ? selectActiveTooltipIndex(ctx.store) : undefined,
	)
	const activeDataPoints = createMemo(() => useActiveTooltipDataPoints())

	const activePoint = (): PointType | undefined => {
		const dataPoints = activeDataPoints()
		if (props.points == null || dataPoints == null) {
			return undefined
		}
		return props.points.find((p) => dataPoints.includes(p.payload))
	}

	return (
		<Show when={!isNullish(activePoint())}>
			<ZIndexLayer zIndex={zIndex()}>
				<ActivePoint
					point={activePoint() as PointType}
					childIndex={Number(activeTooltipIndex())}
					mainColor={props.mainColor}
					dataKey={props.itemDataKey}
					activeDot={props.activeDot}
					clipPath={props.clipPath}
				/>
			</ZIndexLayer>
		</Show>
	)
}
