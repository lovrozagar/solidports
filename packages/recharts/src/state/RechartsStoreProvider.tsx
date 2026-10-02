/* @jsxImportSource @solidjs/web */
/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { useIsPanorama } from "../context/PanoramaContext"
import { useOptionalChartState } from "./useChartState"
import { RechartsStateProvider } from "./RechartsStateProvider"
import type { ChartState } from "./chartState"

type RechartsStoreProviderProps = {
	children: JSX.Element
	preloadedState?: Partial<ChartState>
}

/**
 * Compatibility wrapper for tests that still mount RechartsStoreProvider.
 * Production charts use RechartsStateProvider only — one ChartState store.
 * Standalone mounts create that provider; nested mounts inherit it (no second store).
 */
export function RechartsStoreProvider(props: RechartsStoreProviderProps): JSX.Element {
	const isPanorama = useIsPanorama()
	if (isPanorama) {
		return <>{props.children}</>
	}

	const existing = useOptionalChartState()
	if (existing != null) {
		return <>{props.children}</>
	}

	return (
		<RechartsStateProvider preloadedState={props.preloadedState}>
			{props.children}
		</RechartsStateProvider>
	)
}
