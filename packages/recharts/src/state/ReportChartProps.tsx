/* eslint-disable import/no-cycle */
import { createEffect, onCleanup } from 'solid-js';
import type { UpdatableChartOptions } from "./rootPropsSlice"
import { initialRootPropsState } from "./rootPropsSlice"
import { useOptionalChartState } from "./useChartState"
import { teardownWrite } from "./teardownWrite"

export function ReportChartProps(props: UpdatableChartOptions): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	createEffect(
		() => ({
			accessibilityLayer: props.accessibilityLayer,
			barCategoryGap: props.barCategoryGap,
			barGap: props.barGap,
			barSize: props.barSize,
			baseValue: props.baseValue,
			className: props.className,
			maxBarSize: props.maxBarSize,
			reverseStackOrder: props.reverseStackOrder,
			stackOffset: props.stackOffset,
			syncId: props.syncId,
			syncMethod: props.syncMethod,
		}),
		(rootProps) => {
			ctx.setState("rootProps", rootProps)
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			ctx.setState("rootProps", { ...initialRootPropsState })
		})
	})

	return null
}
