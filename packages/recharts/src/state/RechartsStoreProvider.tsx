/* eslint-disable import/no-cycle */
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { useContext } from "solid-js"
import { createInitialState } from "./store"
import type { RechartsRootState } from "./store"
import { useIsPanorama } from "../context/PanoramaContext"
import { RechartsStoreContext } from "./RechartsStoreContext"
import { createEventHandlers } from "./events"
import { RechartsStateContext } from "./_solid/RechartsStateContext"

type RechartsStoreProviderProps = {
	children: JSX.Element
	preloadedState?: Partial<RechartsRootState>
}

export function RechartsStoreProvider(props: RechartsStoreProviderProps): JSX.Element {
	const isPanorama = useIsPanorama()

	/*
	 * Panorama means that this chart is not its own chart, it's only a "preview"
	 * being rendered as a child of Brush.
	 * In such case, it should not have a store on its own - it should implicitly inherit
	 * whatever data is in the "parent" or "root" chart.
	 * Which here is represented by not having a Provider at all. All reads will use the root store by default.
	 */
	if (isPanorama) {
		return <>{props.children}</>
	}

	/*
	 * Each chart gets its own store instance.
	 * In React+Redux this used a ref to avoid recreating the store on every render.
	 * In Solid, the component body runs only once so no ref is needed.
	 */
	/* Mirror the new ChartState proxy into _solid so selectors can read new state first (D9/D11).
	   Optional: RechartsStoreProvider may be mounted without RechartsStateProvider in tests. */
	const stateCtx = useContext(RechartsStateContext)
	/* eslint-disable-next-line solid/reactivity -- preloadedState seeds the store once; intentionally read-once like React initialState */
	const solidOverride = stateCtx?.state != null ? { _solid: stateCtx.state } : {}
	const [store, setStore] = createStore(createInitialState({ ...props.preloadedState, ...solidOverride }))
	const events = createEventHandlers(store, setStore, stateCtx?.setState)

	return (
		<RechartsStoreContext.Provider value={{ events, setStore, store }}>
			{props.children}
		</RechartsStoreContext.Provider>
	)
}
