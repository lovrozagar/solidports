import { createEffect, onCleanup, useContext } from 'solid-js';
import { RechartsStateContext } from "./RechartsStateContext"
import type {
	CartesianGraphicalItemSettings,
	PolarGraphicalItemSettings,
} from "./graphicalItemsSlice"
import type { CartesianItemState, PolarItemState } from "./chartState"
import { teardownWrite } from "./teardownWrite"

/** Registers a cartesian graphical item into chartState on mount, updates on change, removes on cleanup. */
export function SetCartesianGraphicalItem<T extends CartesianGraphicalItemSettings>(
	props: T,
): null {
	const stateCtx = useContext(RechartsStateContext)
	if (stateCtx == null) {
		return null
	}

	let prevProps: T | null = null

	createEffect(
		() => ({ ...props }) as T,
		(current) => {
			if (current.id != null) {
				const itemState = { settings: current, type: current.type } as CartesianItemState
				stateCtx.setState("graphicalItems", String(current.id), itemState as never)
			}
			prevProps = current
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			if (prevProps?.id != null) {
				stateCtx.setState("graphicalItems", String(prevProps.id), undefined as never)
				prevProps = null
			}
		})
	})

	return null
}

/** Registers a polar graphical item into chartState on mount, updates on change, removes on cleanup. */
export function SetPolarGraphicalItem(props: PolarGraphicalItemSettings): null {
	const stateCtx = useContext(RechartsStateContext)
	if (stateCtx == null) {
		return null
	}

	let prevProps: PolarGraphicalItemSettings | null = null

	createEffect(
		() => ({ ...props }) as PolarGraphicalItemSettings,
		(current) => {
			if (current.id != null) {
				const itemState = { settings: current, type: current.type } as PolarItemState
				stateCtx.setState("graphicalItems", String(current.id), itemState as never)
			}
			prevProps = current
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			if (prevProps?.id != null) {
				stateCtx.setState("graphicalItems", String(prevProps.id), undefined as never)
				prevProps = null
			}
		})
	})

	return null
}
