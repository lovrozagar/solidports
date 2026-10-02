/* eslint-disable import/no-cycle */
import { createContext, Show, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { uniqueId } from "../util/DataUtils"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectPlotArea } from "../state/selectors/selectPlotArea"

const ClipPathIdContext = createContext<string | null>(null)

/**
 * Generates a unique clip path ID for use in SVG elements,
 * and puts it in a context provider.
 *
 * To read the clip path ID, use the `useClipPathId` hook,
 * or render `<ClipPath>` component which will automatically use the ID from this context.
 *
 * @param props children - children to be wrapped by the provider
 * @returns Context Provider
 */
export function ClipPathProvider(props: { children: JSX.Element }) {
	const clipPathId = `${uniqueId("recharts")}-clip`
	const ctx = useChartStore()
	const plotArea = () => (ctx ? selectPlotArea(ctx.store) : undefined)

	/* Show's render-fn child re-fires on every truthy `when` value change —
	 * meaning the entire body, including `{props.children}`, gets re-instantiated
	 * each time `plotArea()` returns a new reference. With the Solid props proxy
	 * for children, that re-instantiates user JSX (and every Bar/Funnel inside)
	 * on every chart-offset reactive cycle. The cleanup of those children fires
	 * `removeZIndexLayer` / `removeGraphicalItem` etc., which invalidates
	 * selectors that feed back into selectPlotArea — tight loop, OOM. Always
	 * render the Provider + children; gate only the inline <defs> on plotArea. */
	return (
		<ClipPathIdContext value={clipPathId}>
			<Show when={plotArea()}>
				{(area) => (
					<defs>
						<clipPath id={clipPathId}>
							<rect x={area().x} y={area().y} height={area().height} width={area().width} />
						</clipPath>
					</defs>
				)}
			</Show>
			{props.children}
		</ClipPathIdContext>
	)
}

export const useClipPathId = (): string | null => {
	return useContext(ClipPathIdContext)
}
