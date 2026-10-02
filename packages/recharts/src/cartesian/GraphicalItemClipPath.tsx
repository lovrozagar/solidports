/* eslint-disable import/no-cycle */
import { Show, createMemo } from 'solid-js';
import { AxisId } from "../state/cartesianAxisSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import {
	implicitXAxis,
	implicitYAxis,
	selectXAxisRange,
	selectXAxisSettings,
	selectYAxisRange,
	selectYAxisSettings,
} from "../state/selectors/axisSelectors"
import { usePlotArea } from "../hooks"

type GraphicalItemClipPathProps = {
	xAxisId: AxisId
	yAxisId: AxisId
	clipPathId: string
}

export function useNeedsClip(xAxisId: AxisId, yAxisId: AxisId) {
	const ctx = useChartStore()
	const xAxis = () => (ctx ? selectXAxisSettings(ctx.store, xAxisId) : undefined)
	const yAxis = () => (ctx ? selectYAxisSettings(ctx.store, yAxisId) : undefined)

	const needClipX = (): boolean => xAxis()?.allowDataOverflow ?? implicitXAxis.allowDataOverflow
	const needClipY = (): boolean => yAxis()?.allowDataOverflow ?? implicitYAxis.allowDataOverflow
	const needClip = () => needClipX() || needClipY()

	return { needClip, needClipX, needClipY }
}

export function GraphicalItemClipPath(props: GraphicalItemClipPathProps) {
	const ctx = useChartStore()
	const plotArea = createMemo(() => usePlotArea())

	/* eslint-disable-next-line solid/reactivity -- xAxisId/yAxisId are stable axis refs; useNeedsClip creates reactive closures internally */
	const { needClipX, needClipY, needClip } = useNeedsClip(props.xAxisId, props.yAxisId)
	/* Axis ranges include axis padding, so the clip honors it (#7232). */
	const xAxisRange = createMemo(() => (ctx ? selectXAxisRange(ctx.store, props.xAxisId, false) : undefined))
	const yAxisRange = createMemo(() => (ctx ? selectYAxisRange(ctx.store, props.yAxisId, false) : undefined))

	const clipRect = createMemo(() => {
		const area = plotArea()
		if (!needClip() || area == null) {
			return undefined
		}
		const { x, y, width, height } = area
		const xRange = xAxisRange()
		const yRange = yAxisRange()
		const clipX = needClipX() && xRange ? Math.min(xRange[0], xRange[1]) : x - width / 2
		const clipY = needClipY() && yRange ? Math.min(yRange[0], yRange[1]) : y - height / 2
		const clipWidth = needClipX() && xRange ? Math.abs(xRange[1] - xRange[0]) : width * 2
		const clipHeight = needClipY() && yRange ? Math.abs(yRange[1] - yRange[0]) : height * 2
		return { height: clipHeight, width: clipWidth, x: clipX, y: clipY }
	})

	return (
		<Show when={clipRect()}>
			{(rect) => (
				<clipPath id={`clipPath-${props.clipPathId}`}>
					<rect x={rect().x} y={rect().y} width={rect().width} height={rect().height} />
				</clipPath>
			)}
		</Show>
	)
}
