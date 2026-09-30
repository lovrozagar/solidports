import { createEffect, onCleanup, useContext } from "solid-js"
import { produce } from "solid-js/store"
import { RechartsStateContext } from "./_solid/RechartsStateContext"
import { RechartsStoreContext } from "./RechartsStoreContext"
import type {
	CartesianGraphicalItemSettings,
	PolarGraphicalItemSettings,
} from "./graphicalItemsSlice"
import type { CartesianItemState, PolarItemState } from "./_solid/chartState"

/** Registers a cartesian graphical item into chartState on mount, updates on change, removes on cleanup. */
export function SetCartesianGraphicalItem<T extends CartesianGraphicalItemSettings>(
	props: T,
): null {
	const stateCtx = useContext(RechartsStateContext)
	const ctx = useContext(RechartsStoreContext)
	if (stateCtx == null) {
		return null
	}

	let prevProps: T | null = null

	createEffect(() => {
		const current = { ...props } as T
		if (current.id != null) {
			const itemState = { settings: current, type: current.type } as CartesianItemState
			stateCtx.setState("graphicalItems", String(current.id), itemState as never)
			/* Legacy compat shim — keeps `state.graphicalItems.cartesianItems` populated for tests reading the legacy slice shape directly. */
			if (ctx != null) {
				const prev = prevProps
				ctx.setStore(
					"graphicalItems",
					"cartesianItems",
					produce((items) => {
						const arr = items as CartesianGraphicalItemSettings[]
						if (prev != null) {
							const idx = arr.findIndex((it) => it.id === prev.id)
							if (idx !== -1) {
								arr[idx] = current
								return
							}
						}
						arr.push(current)
					}),
				)
			}
		}
		prevProps = current
	})

	onCleanup(() => {
		if (prevProps?.id != null) {
			stateCtx.setState("graphicalItems", String(prevProps.id), undefined as never)
			if (ctx != null) {
				const removeId = prevProps.id
				ctx.setStore(
					"graphicalItems",
					"cartesianItems",
					produce((items) => {
						const arr = items as CartesianGraphicalItemSettings[]
						const idx = arr.findIndex((it) => it.id === removeId)
						if (idx !== -1) {
							arr.splice(idx, 1)
						}
					}),
				)
			}
			prevProps = null
		}
	})

	return null
}

/** Registers a polar graphical item into chartState on mount, updates on change, removes on cleanup. */
export function SetPolarGraphicalItem(props: PolarGraphicalItemSettings): null {
	const stateCtx = useContext(RechartsStateContext)
	const ctx = useContext(RechartsStoreContext)
	if (stateCtx == null) {
		return null
	}

	let prevProps: PolarGraphicalItemSettings | null = null

	createEffect(() => {
		const current = { ...props } as PolarGraphicalItemSettings
		if (current.id != null) {
			const itemState = { settings: current, type: current.type } as PolarItemState
			stateCtx.setState("graphicalItems", String(current.id), itemState as never)
			if (ctx != null) {
				const prev = prevProps
				ctx.setStore(
					"graphicalItems",
					"polarItems",
					produce((items) => {
						const arr = items as PolarGraphicalItemSettings[]
						if (prev != null) {
							const idx = arr.findIndex((it) => it.id === prev.id)
							if (idx !== -1) {
								arr[idx] = current
								return
							}
						}
						arr.push(current)
					}),
				)
			}
		}
		prevProps = current
	})

	onCleanup(() => {
		if (prevProps?.id != null) {
			stateCtx.setState("graphicalItems", String(prevProps.id), undefined as never)
			if (ctx != null) {
				const removeId = prevProps.id
				ctx.setStore(
					"graphicalItems",
					"polarItems",
					produce((items) => {
						const arr = items as PolarGraphicalItemSettings[]
						const idx = arr.findIndex((it) => it.id === removeId)
						if (idx !== -1) {
							arr.splice(idx, 1)
						}
					}),
				)
			}
			prevProps = null
		}
	})

	return null
}
