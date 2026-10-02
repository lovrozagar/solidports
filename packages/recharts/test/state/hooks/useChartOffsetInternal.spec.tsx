/**
 * T2 — dep-tracking unit tests for provider-level shared selector hooks.
 *
 * These tests MUST FAIL until src/state/hooks/useChartSelectors.tsx is created (Step 1).
 * The import below will throw "Cannot find module" — that IS the expected RED state.
 *
 * After Step 1 lands, all tests here must go GREEN and stay GREEN through Steps 2-6.
 * They are the structural guard against the four prior failed memoization attempts.
 */
import { createRoot, flush, untrack } from 'solid-js'
import { observe } from "../../helper/observe"
import { render } from "../../helper/render"
import { describe, expect, it } from "vitest"
import type { JSX } from '@solidjs/web';
import { createInitialState } from "../../../src/state/store"
import { RechartsStoreContext } from "../../../src/state/RechartsStoreContext"
import { createActions } from "../../../src/state/actions"
import { createEventHandlers } from "../../../src/state/events"
import {
	ChartSelectorsProvider,
	createChartSelectors,
	useChartOffsetInternal,
	useAllXAxes,
	useAllYAxes,
} from "../../../src/state/hooks/useChartSelectors"

import { createStore } from '../../../src/util/solid-1-compat';
/* ── test harness ─────────────────────────────────────────────────── */

type StoreCtx = ReturnType<typeof buildStoreCtx>

function buildStoreCtx(preloaded?: Parameters<typeof createInitialState>[0]) {
	const [store, setStore] = createStore(createInitialState(preloaded))
	const actions = createActions(store, setStore)
	const events = createEventHandlers(store, setStore, actions)
	return { actions, events, setStore, store }
}

function withProvider(ctx: StoreCtx, children: () => JSX.Element): JSX.Element {
	const { actions, events, setStore, store } = ctx
	const chartSelectors = createChartSelectors(store)
	return (
		<RechartsStoreContext value={{ actions, events, setStore, store }}>
			<ChartSelectorsProvider value={chartSelectors}>
				{children()}
			</ChartSelectorsProvider>
		</RechartsStoreContext>
	)
}

/* ── useChartOffsetInternal ──────────────────────────────────────── */

describe("useChartOffsetInternal", () => {
	it("emits initial offset on first createEffect run", () => {
		expect.assertions(2)
		const ctx = buildStoreCtx()
		const emitted: ReturnType<typeof useChartOffsetInternal>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useChartOffsetInternal())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		expect(emitted.length).toBeGreaterThanOrEqual(1)
		/* initial state has no size set — offset dimensions are 0 */
		expect(emitted[0]).toMatchObject({ height: 0, width: 0 })
	})

	it("re-fires after setChartSize with updated width and height", () => {
		expect.assertions(2)
		const ctx = buildStoreCtx()
		const emitted: ReturnType<typeof useChartOffsetInternal>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useChartOffsetInternal())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		ctx.actions.setChartSize({ height: 600, width: 800 })
		flush()

		expect(emitted.length).toBeGreaterThanOrEqual(2)
		const last = emitted.at(-1)
		/* offset.height/width = chartSize minus margins (default margin=5 each side) */
		expect(last).toMatchObject({ height: 590, width: 790 })
	})

	it("re-fires after setMargin with updated top and left", () => {
		expect.assertions(2)
		const ctx = buildStoreCtx()
		/* give it a size so margin changes are visible in offset */
		ctx.actions.setChartSize({ height: 600, width: 800 })
		flush()
		const emitted: ReturnType<typeof useChartOffsetInternal>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useChartOffsetInternal())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		ctx.actions.setMargin({ bottom: 0, left: 30, right: 0, top: 20 })
		flush()

		expect(emitted.length).toBeGreaterThanOrEqual(2)
		const last = emitted.at(-1)
		/* top/left appear directly in the offset */
		expect(last).toMatchObject({ left: 30, top: 20 })
	})

	it("re-fires after addYAxis — offset.left increases by axis width", () => {
		expect.assertions(2)
		const ctx = buildStoreCtx()
		ctx.actions.setChartSize({ height: 600, width: 800 })
		flush()
		ctx.actions.setMargin({ bottom: 0, left: 0, right: 0, top: 0 })
		flush()
		const emitted: ReturnType<typeof useChartOffsetInternal>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useChartOffsetInternal())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		ctx.actions.addYAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "left",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
			width: 60,
		})

		flush()

		expect(emitted.length).toBeGreaterThanOrEqual(2)
		const last = emitted.at(-1)
		/* left-oriented Y axis with width=60, margin.left=0 → offset.left=60 */
		expect(last?.left).toBe(60)
	})

	it("two probe instances under same provider receive the same object reference", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		ctx.actions.setChartSize({ height: 600, width: 800 })
		flush()

		let ref1: ReturnType<typeof useChartOffsetInternal> | undefined
		let ref2: ReturnType<typeof useChartOffsetInternal> | undefined

		const Probe1 = (): null => {
			/* read INSIDE a createEffect so the memo dep is registered */
			observe(() => {
				ref1 = useChartOffsetInternal()
			})
			return null
		}
		const Probe2 = (): null => {
			observe(() => {
				ref2 = useChartOffsetInternal()
			})
			return null
		}

		render(() => withProvider(ctx, () => <><Probe1 /><Probe2 /></>))

		/* both probes must receive the exact same object (shared memo, not per-component recomputation) */
		expect(ref1).toBe(ref2)
	})
})

/* ── useAllXAxes ─────────────────────────────────────────────────── */

describe("useAllXAxes", () => {
	it("returns empty array from initial state", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		const emitted: ReturnType<typeof useAllXAxes>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useAllXAxes())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		expect(emitted[0]).toEqual([])
	})

	it("re-fires after addXAxis with the new axis in the array", () => {
		expect.assertions(2)
		const ctx = buildStoreCtx()
		const emitted: ReturnType<typeof useAllXAxes>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useAllXAxes())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		ctx.actions.addXAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
		})

		flush()

		expect(emitted.length).toBeGreaterThanOrEqual(2)
		const last = emitted.at(-1)
		expect(last).toHaveLength(1)
	})

	it("does not re-fire when only Y axes change", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		let fireCount = 0

		const Probe = (): null => {
			observe(() => {
				useAllXAxes()
				fireCount++
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		const countAfterMount = fireCount

		ctx.actions.addYAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "left",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
			width: 60,
		})

		flush()

		/* useAllXAxes memo must NOT re-fire when yAxis changes */
		expect(fireCount).toBe(countAfterMount)
	})

	it("returns the exact same array reference when X axis state is unchanged", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		const refs: ReturnType<typeof useAllXAxes>[] = []

		const Probe = (): null => {
			observe(() => {
				refs.push(useAllXAxes())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		/* trigger an unrelated store write */
		ctx.actions.setChartSize({ height: 600, width: 800 })
		flush()

		/* createMemo with equals check — same deps → same ref */
		expect(refs[0]).toBe(refs.at(-1))
	})

	it("two probe instances receive the same array reference (shared memo)", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		let ref1: ReturnType<typeof useAllXAxes> | undefined
		let ref2: ReturnType<typeof useAllXAxes> | undefined

		const Probe1 = (): null => {
			observe(() => {
				ref1 = useAllXAxes()
			})
			return null
		}
		const Probe2 = (): null => {
			observe(() => {
				ref2 = useAllXAxes()
			})
			return null
		}

		render(() => withProvider(ctx, () => <><Probe1 /><Probe2 /></>))

		expect(ref1).toBe(ref2)
	})
})

/* ── useAllYAxes ─────────────────────────────────────────────────── */

describe("useAllYAxes", () => {
	it("returns empty array from initial state", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		const emitted: ReturnType<typeof useAllYAxes>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useAllYAxes())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		expect(emitted[0]).toEqual([])
	})

	it("re-fires after addYAxis with the new axis in the array", () => {
		expect.assertions(2)
		const ctx = buildStoreCtx()
		const emitted: ReturnType<typeof useAllYAxes>[] = []

		const Probe = (): null => {
			observe(() => {
				emitted.push(useAllYAxes())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		ctx.actions.addYAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "left",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
			width: 60,
		})

		flush()

		expect(emitted.length).toBeGreaterThanOrEqual(2)
		expect(emitted.at(-1)).toHaveLength(1)
	})

	it("does not re-fire when only X axes change", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		let fireCount = 0

		const Probe = (): null => {
			observe(() => {
				useAllYAxes()
				fireCount++
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		const countAfterMount = fireCount

		ctx.actions.addXAxis({
			allowDataOverflow: false,
			allowDecimals: true,
			allowDuplicatedCategory: true,
			angle: 0,
			dataKey: undefined,
			domain: undefined,
			height: 30,
			hide: false,
			id: 0,
			includeHidden: false,
			interval: "preserveStartEnd",
			minTickGap: 5,
			mirror: false,
			name: undefined,
			orientation: "bottom",
			padding: {},
			reversed: false,
			scale: "auto",
			tick: true,
			tickCount: undefined,
			tickFormatter: undefined,
			ticks: undefined,
			type: "number",
			unit: undefined,
		})

		flush()

		/* useAllYAxes memo must NOT re-fire when xAxis changes */
		expect(fireCount).toBe(countAfterMount)
	})

	it("returns the exact same array reference when Y axis state is unchanged", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		const refs: ReturnType<typeof useAllYAxes>[] = []

		const Probe = (): null => {
			observe(() => {
				refs.push(useAllYAxes())
			})
			return null
		}

		render(() => withProvider(ctx, () => <Probe />))

		ctx.actions.setChartSize({ height: 600, width: 800 })
		flush()

		expect(refs[0]).toBe(refs.at(-1))
	})

	it("two probe instances receive the same array reference (shared memo)", () => {
		expect.assertions(1)
		const ctx = buildStoreCtx()
		let ref1: ReturnType<typeof useAllYAxes> | undefined
		let ref2: ReturnType<typeof useAllYAxes> | undefined

		const Probe1 = (): null => {
			observe(() => {
				ref1 = useAllYAxes()
			})
			return null
		}
		const Probe2 = (): null => {
			observe(() => {
				ref2 = useAllYAxes()
			})
			return null
		}

		render(() => withProvider(ctx, () => <><Probe1 /><Probe2 /></>))

		expect(ref1).toBe(ref2)
	})
})

/* ── createRoot guard (hooks must be no-ops outside provider) ────── */

describe("hooks outside provider", () => {
	it("useChartOffsetInternal returns undefined outside provider", () => {
		expect.assertions(1)
		let result: ReturnType<typeof useChartOffsetInternal> | undefined
		createRoot((dispose) => {
			result = useChartOffsetInternal()
			dispose()
		})
		expect(result).toBeUndefined()
	})

	it("useAllXAxes returns undefined outside provider", () => {
		expect.assertions(1)
		let result: ReturnType<typeof useAllXAxes> | undefined
		createRoot((dispose) => {
			result = useAllXAxes()
			dispose()
		})
		expect(result).toBeUndefined()
	})

	it("useAllYAxes returns undefined outside provider", () => {
		expect.assertions(1)
		let result: ReturnType<typeof useAllYAxes> | undefined
		createRoot((dispose) => {
			result = useAllYAxes()
			dispose()
		})
		expect(result).toBeUndefined()
	})
})
