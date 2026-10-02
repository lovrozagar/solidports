/* @jsxImportSource @solidjs/web */
import type { JSX } from '@solidjs/web';
import { untrack } from 'solid-js';
import { RechartsStateContext } from "./RechartsStateContext"
import type { RechartsStateContextValue } from "./RechartsStateContext"
import type { ChartState } from "./chartState"
import { createInitialChartState } from "./chartState"
import { useIsPanorama } from "../context/PanoramaContext"
import { RechartsStoreContext } from "./RechartsStoreContext"
import { createEventHandlers } from "./events"

import { createStore, type SetStoreFunction } from '../util/solid-1-compat';
type RechartsStateProviderProps = {
	/**
	 * Top-level keys override defaults. Sub-objects must be complete — shallow
	 * merge only; partial nested overrides are not supported in Phase 1.
	 */
	preloadedState?: Partial<ChartState>
	children: JSX.Element
}

/* Solid setStore throws when a path segment points to an undefined intermediate node.
   Wraps to pre-initialize missing nodes before the deep write — needed for callers that
   write into axis slots that haven't been mounted yet (e.g. test probes, panorama shared state).
   Only the ≥4-arg case (3+ path segments) needs the walk; shallow writes are fine as-is. */
function makeAutoInitsetState(
	state: ChartState,
	setStore: SetStoreFunction<ChartState>,
): SetStoreFunction<ChartState> {
	return ((...args: unknown[]) => {
		if (args.length >= 4) {
			/* The walk only probes for missing nodes; a setter must not subscribe its caller. */
			untrack(() => {
				const pathSegments = args.slice(0, -1)
				let node: unknown = state
				for (let i = 0; i < pathSegments.length - 1; i++) {
					const seg = pathSegments[i]
					if (typeof seg !== "string" && typeof seg !== "number") break
					const next = (node as Record<string | number, unknown>)[seg]
					if (next === undefined || next === null) {
						;(setStore as (...a: unknown[]) => void)(...pathSegments.slice(0, i + 1), {})
					}
					node = (node as Record<string | number, unknown>)[seg] ?? {}
				}
			})
		}
		;(setStore as (...a: unknown[]) => void)(...args)
	}) as SetStoreFunction<ChartState>
}

/** Mounts an isolated ChartState store and exposes it via RechartsStateContext. */
export function RechartsStateProvider(props: RechartsStateProviderProps): JSX.Element {
	const isPanorama = useIsPanorama()

	/*
	 * Panorama = this is a Brush sub-chart preview, not a real chart instance.
	 * Skip mounting a new store so descendants inherit the parent chart's context
	 * via Solid context bubbling — mirrors RechartsStoreProvider's panorama guard.
	 */
	if (isPanorama) {
		return <>{props.children}</>
	}

	/* preloadedState seeds the store once, like React initialState. */
	const [state, setStore] = createStore<ChartState>(
		untrack(() => createInitialChartState(props.preloadedState)),
	)
	const setState = makeAutoInitsetState(state, setStore)
	const value: RechartsStateContextValue = { setState, state }
	const events = createEventHandlers(state, setState)
	return (
		<RechartsStateContext value={value}>
			<RechartsStoreContext
				value={{
					events,
					setStore: setState,
					store: state,
				}}
			>
				{props.children}
			</RechartsStoreContext>
		</RechartsStateContext>
	)
}
