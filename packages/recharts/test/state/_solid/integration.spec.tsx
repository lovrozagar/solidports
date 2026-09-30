/* @jsxImportSource solid-js */
import { describe, it } from "vitest"

/*
 * Integration tests for RechartsStateProvider wired into real chart components.
 * Enabled after GREEN (Phase 1 impl complete). All three are .skip until then.
 */

describe("RechartsStateProvider integration", () => {
	it.skip(
		"RechartsStateProvider mounted alongside RechartsStoreProvider — both contexts work",
		() => {
			/*
			 * Render:
			 *   <RechartsStateProvider>
			 *     <RechartsStoreProvider>
			 *       <LineChart width={200} height={100}>
			 *         <Line dataKey="value" />
			 *         <BothContextsReader />  <- calls useChartState() + useChartStore()
			 *       </LineChart>
			 *     </RechartsStoreProvider>
			 *   </RechartsStateProvider>
			 *
			 * Assert:
			 *   - querySelector(".recharts-line .recharts-curve") is non-null
			 *   - BothContextsReader renders without throwing (both hooks return defined values)
			 */
		},
	)

	it.skip("panorama (Brush sub-chart) inherits parent state — no nested provider", () => {
		/*
		 * Render a BarChart with a Brush (which internally mounts a panorama sub-chart).
		 * The panorama must NOT mount its own RechartsStateProvider — it inherits the
		 * parent's context via the same early-return that RechartsStoreProvider uses
		 * (useIsPanorama() === true → skip provider, return children directly).
		 *
		 * Assert:
		 *   - useChartState() called from inside the panorama returns the SAME state
		 *     reference as the parent chart's context (verify via Object.is comparison
		 *     on state object or by mutating parent state and observing panorama reader).
		 */
	})

	it.skip("provider cleanup on unmount — no signal leaks", () => {
		/*
		 * Strategy:
		 *   1. Render <RechartsStateProvider><Child/></RechartsStateProvider>.
		 *   2. Inside Child, use createEffect to read state.chartSize.width and push
		 *      to an external array effectCalls[].
		 *   3. Capture setState handle before unmount.
		 *   4. Unmount the provider (cleanup() from render).
		 *   5. Call setState("chartSize", "width", 1) on the captured handle.
		 *   6. Assert effectCalls.length did not increase after unmount — the effect
		 *      was cleaned up by onCleanup and no longer fires.
		 */
	})
})
