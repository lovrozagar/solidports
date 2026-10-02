import type { Coordinate, DataKey } from "../util/types"
import { useOptionalChartState } from "../state/useChartState"
import type { TooltipPayload } from "../state/tooltipSlice"
import { setTooltipInteraction } from "../state/tooltipInteraction"

/**
 * Some graphical items choose to provide more information to the tooltip
 * and some do not.
 */
export type TooltipTriggerInfo = {
	tooltipPayload?: TooltipPayload
	tooltipPosition?: Coordinate
}

export type MouseEnterLeaveEvent<T, E extends SVGElement = SVGElement> = (
	data: T,
	index: number,
	event: MouseEvent & { currentTarget: E },
) => void

/* GOTCHA-005-D: callers MUST pass a Solid accessor `() => props.foo.onClick` so
   live prop changes flow through to the dispatch on every event. Eager values
   (`props.foo.onClick`) can no longer be supported because the prior `.length === 0`
   detection misclassified user-supplied `vi.fn()` (also arity 0) as accessors,
   invoking them with no args at click time and breaking onClick payload. */
type EventHandlerSource<T, E extends SVGElement> = () => MouseEnterLeaveEvent<T, E> | undefined

function readHandler<T, E extends SVGElement>(
	source: EventHandlerSource<T, E>,
): MouseEnterLeaveEvent<T, E> | undefined {
	return source()
}

export const useMouseEnterItemDispatch = <
	T extends TooltipTriggerInfo,
	E extends SVGElement = SVGElement,
>(
	onMouseEnterFromProps: EventHandlerSource<T, E>,
	dataKey: () => DataKey<unknown> | undefined,
	graphicalItemId: string,
) => {
	const newCtx = useOptionalChartState()
	return (data: T, index: number) => (event: MouseEvent & { currentTarget: E }) => {
		readHandler(onMouseEnterFromProps)?.(data, index, event)
		const hoverPayload = {
			active: true,
			coordinate: data.tooltipPosition,
			dataKey: dataKey(),
			graphicalItemId,
			index: String(index),
		}
		if (newCtx != null) setTooltipInteraction(newCtx.setState, "itemInteraction", "hover", hoverPayload)
	}
}

export const useMouseLeaveItemDispatch = <
	T extends TooltipTriggerInfo,
	E extends SVGElement = SVGElement,
>(
	onMouseLeaveFromProps: EventHandlerSource<T, E>,
) => {
	const newCtx = useOptionalChartState()
	return (data: T, index: number) => (event: MouseEvent & { currentTarget: E }) => {
		readHandler(onMouseLeaveFromProps)?.(data, index, event)
		newCtx?.setState("tooltip", "itemInteraction", "hover", "active", false)
	}
}

export const useMouseClickItemDispatch = <
	T extends TooltipTriggerInfo,
	E extends SVGElement = SVGElement,
>(
	onMouseClickFromProps: EventHandlerSource<T, E>,
	dataKey: () => DataKey<unknown> | undefined,
	graphicalItemId: string,
) => {
	const newCtx = useOptionalChartState()
	return (data: T, index: number) => (event: MouseEvent & { currentTarget: E }) => {
		readHandler(onMouseClickFromProps)?.(data, index, event)
		const clickPayload = {
			active: true,
			coordinate: data.tooltipPosition,
			dataKey: dataKey(),
			graphicalItemId,
			index: String(index),
		}
		if (newCtx != null) setTooltipInteraction(newCtx.setState, "itemInteraction", "click", clickPayload)
	}
}
