/* eslint-disable import/no-cycle */
import { Show } from "solid-js"
import { AxisId } from "../state/cartesianAxisSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import {
	implicitXAxis,
	implicitYAxis,
	selectXAxisSettings,
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
	const plotArea = () => usePlotArea()

	/* eslint-disable-next-line solid/reactivity -- xAxisId/yAxisId are stable axis refs; useNeedsClip creates reactive closures internally */
	const { needClipX, needClipY, needClip } = useNeedsClip(props.xAxisId, props.yAxisId)

	return (
		<Show when={needClip() && plotArea()}>
			{(area) => (
				<clipPath id={`clipPath-${props.clipPathId}`}>
					<rect
						x={needClipX() ? area().x : area().x - area().width / 2}
						y={needClipY() ? area().y : area().y - area().height / 2}
						width={needClipX() ? area().width : area().width * 2}
						height={needClipY() ? area().height : area().height * 2}
					/>
				</clipPath>
			)}
		</Show>
	)
}
