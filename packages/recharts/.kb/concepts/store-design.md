# Recharts Solid: Store Design

> **Status (v3.10.1 port):** implemented as one `createStore<ChartState>` per chart. Current file
> layout, access rules and Solid 2 constraints are in `../solid/store-semantics.md`; the rest of this
> document is the original design rationale and its snippets use Solid 1 APIs (`onMount`,
> `solid-js/store`, `Provider`). Names differ in places: `ChartStore` → `ChartState`,
> `cartesianAxis` → `cartesianAxes`, `polarAxis` → `polarAxes`, `ChartProvider` → `RechartsStateProvider`.

> **Status: implemented** — Phase 4 (sessions 1–7 + batches 1–7) landed the
> `createActions(store, setStore)` factory, `createEventHandlers` consolidation,
> and the `RechartsStoreContext` rename. Source of truth:
> - `src/state/actions.ts` — `createActions` factory + `ChartActions` type
> - `src/state/events.ts` — `createEventHandlers` factory + `ChartEventHandlers` type
> - `src/state/RechartsStoreContext.tsx` — context + `useChartStore`
> - `src/state/RechartsStoreProvider.tsx` — wires actions/events at mount
>
> Deferred (no acceptance-gate impact): per-slice action thunk exports remain
> as plain `(args) => (setStore, store) => void` functions to keep the existing
> test corpus green. `Set*` / `Report*` component-registration files retain
> their current shape pending a follow-up that converts them to inline
> `createEffect + onCleanup`.

## Redux → Solid Mapping

| Redux Concept                    | Solid Equivalent                  | Notes                   |
| -------------------------------- | --------------------------------- | ----------------------- |
| `configureStore`                 | `createStore()`                   | One per chart instance  |
| `createSlice`                    | Nested store sections             | No action types needed  |
| `useSelector`                    | Direct store access               | Fine-grained by default |
| `useDispatch` + action           | `setStore()` / `produce()`        | Direct mutation         |
| `reselect` createSelector        | `createMemo()`                    | Auto-tracks deps        |
| `createListenerMiddleware`       | Event handlers + `batch()`        | No middleware layer     |
| `autoBatchEnhancer`              | Native — Solid batches by default | Delete entirely         |
| `Redux DevTools`                 | Solid DevTools (`solid-devtools`) | Optional                |
| `React.createContext` + Provider | `createContext` + Provider        | Nearly identical        |
| `prepareAutoBatched`             | Not needed                        | Solid batches naturally |

## Store Shape

Single `createStore` per chart instance, mirrors Redux shape:

```typescript
import { createStore, produce, reconcile } from "solid-js/store"
import { createContext, useContext } from "solid-js"

type ChartStore = {
	brush: BrushState
	cartesianAxis: CartesianAxisState
	chartData: ChartDataState
	errorBars: ErrorBarsState
	eventSettings: EventSettingsState
	graphicalItems: GraphicalItemsState
	layout: LayoutState
	legend: LegendState
	options: OptionsState
	polarAxis: PolarAxisState
	polarOptions: PolarOptionsState | null
	referenceElements: ReferenceElementsState
	rootProps: RootPropsState
	tooltip: TooltipState
	zIndex: ZIndexState
}
```

## Context Pattern

```typescript
const ChartStoreContext = createContext<{
	store: ChartStore
	setStore: SetStoreFunction<ChartStore>
	actions: ChartActions
}>()

function useChartStore() {
	const ctx = useContext(ChartStoreContext)
	if (!ctx) throw new Error("useChartStore must be used within a chart")
	return ctx
}
```

Each chart creates its own store in its provider — same pattern as Redux but without the boilerplate:

```typescript
function ChartProvider(props: { children: JSX.Element, options: ChartOptions }) {
  const [store, setStore] = createStore<ChartStore>(createInitialState(props.options))
  const actions = createActions(store, setStore)

  return (
    <ChartStoreContext.Provider value={{ store, setStore, actions }}>
      {props.children}
    </ChartStoreContext.Provider>
  )
}
```

## Actions (Replace Reducers)

Redux reducers become simple functions that call `setStore`:

```typescript
function createActions(store: ChartStore, setStore: SetStoreFunction<ChartStore>) {
	return {
		/* --- brush --- */
		setBrushSettings: (settings: BrushState | null) =>
			setStore("brush", settings ?? initialBrushState),

		/* --- cartesianAxis --- */
		addXAxis: (axis: XAxisSettings) => setStore("cartesianAxis", "xAxis", axis.id, axis),

		removeXAxis: (id: AxisId) =>
			setStore(
				"cartesianAxis",
				"xAxis",
				produce((axes) => {
					delete axes[id]
				}),
			),

		replaceXAxis: (id: AxisId, next: XAxisSettings) =>
			setStore("cartesianAxis", "xAxis", id, reconcile(next)),

		addYAxis: (axis: YAxisSettings) => setStore("cartesianAxis", "yAxis", axis.id, axis),

		removeYAxis: (id: AxisId) =>
			setStore(
				"cartesianAxis",
				"yAxis",
				produce((axes) => {
					delete axes[id]
				}),
			),

		updateYAxisWidth: (id: AxisId, width: number) =>
			setStore(
				"cartesianAxis",
				"yAxis",
				id,
				produce((axis) => {
					/* preserve oscillation detection logic */
					const history = axis.widthHistory ?? []
					if (history.length >= 2) {
						const [prev, curr] = history.slice(-2)
						if (Math.abs(prev - width) < 1 && Math.abs(curr - axis.width) < 1) return
					}
					axis.widthHistory = [...history.slice(-4), axis.width]
					axis.width = width
				}),
			),

		/* --- chartData --- */
		setChartData: (data: ChartData | undefined) =>
			setStore(
				"chartData",
				produce((s) => {
					s.chartData = data
					s.dataEndIndex = data ? data.length - 1 : 0
				}),
			),

		setDataRange: (start: number, end: number) =>
			setStore(
				"chartData",
				produce((s) => {
					s.dataStartIndex = start
					s.dataEndIndex = end
				}),
			),

		/* --- graphicalItems --- */
		addCartesianItem: (item: CartesianGraphicalItemSettings) =>
			setStore("graphicalItems", "cartesianItems", (items) => [...items, item]),

		removeCartesianItem: (id: string) =>
			setStore("graphicalItems", "cartesianItems", (items) => items.filter((i) => i.id !== id)),

		replaceCartesianItem: (id: string, next: CartesianGraphicalItemSettings) =>
			setStore("graphicalItems", "cartesianItems", (items) =>
				items.map((i) => (i.id === id ? next : i)),
			),

		addPolarItem: (item: PolarGraphicalItemSettings) =>
			setStore("graphicalItems", "polarItems", (items) => [...items, item]),

		removePolarItem: (id: string) =>
			setStore("graphicalItems", "polarItems", (items) => items.filter((i) => i.id !== id)),

		/* --- layout --- */
		setLayout: (layout: LayoutType) => setStore("layout", "layoutType", layout),
		setChartSize: (w: number, h: number) =>
			setStore(
				"layout",
				produce((s) => {
					s.width = w
					s.height = h
				}),
			),
		setMargin: (m: Partial<Margin>) => setStore("layout", "margin", (prev) => ({ ...prev, ...m })),

		/* --- legend --- */
		setLegendSize: (w: number, h: number) => setStore("legend", "size", { width: w, height: h }),
		setLegendSettings: (s: LegendSettings) => setStore("legend", "settings", reconcile(s)),

		/* --- tooltip (most complex) --- */
		setMouseOverAxisIndex: (payload: TooltipAxisPayload) =>
			setStore(
				"tooltip",
				"axisInteraction",
				"hover",
				reconcile({
					active: true,
					index: payload.activeIndex,
					dataKey: payload.activeDataKey,
					coordinate: payload.activeCoordinate,
					graphicalItemId: undefined,
				}),
			),

		setMouseClickAxisIndex: (payload: TooltipAxisPayload) =>
			setStore(
				"tooltip",
				"axisInteraction",
				"click",
				reconcile({
					active: true,
					index: payload.activeIndex,
					dataKey: payload.activeDataKey,
					coordinate: payload.activeCoordinate,
					graphicalItemId: undefined,
				}),
			),

		setActiveMouseOverItemIndex: (payload: TooltipItemPayload) =>
			setStore(
				"tooltip",
				"itemInteraction",
				"hover",
				reconcile({
					active: true,
					index: payload.activeIndex,
					dataKey: payload.activeDataKey,
					coordinate: payload.activeCoordinate,
					graphicalItemId: payload.activeGraphicalItemId,
				}),
			),

		setActiveClickItemIndex: (payload: TooltipItemPayload) =>
			setStore(
				"tooltip",
				"itemInteraction",
				"click",
				reconcile({
					active: true,
					index: payload.activeIndex,
					dataKey: payload.activeDataKey,
					coordinate: payload.activeCoordinate,
					graphicalItemId: payload.activeGraphicalItemId,
				}),
			),

		setKeyboardInteraction: (payload: KeyboardPayload) =>
			setStore(
				"tooltip",
				"keyboardInteraction",
				reconcile({
					active: payload.active,
					index: payload.activeIndex,
					coordinate: payload.activeCoordinate,
					dataKey: undefined,
					graphicalItemId: undefined,
				}),
			),

		mouseLeaveChart: () =>
			setStore(
				"tooltip",
				produce((t) => {
					t.axisInteraction.hover.active = false
					t.itemInteraction.hover.active = false
				}),
			),

		mouseLeaveItem: () =>
			setStore(
				"tooltip",
				"itemInteraction",
				"hover",
				produce((h) => {
					h.active = false
				}),
			),

		setSyncInteraction: (payload: TooltipSyncState) =>
			setStore("tooltip", "syncInteraction", reconcile(payload)),

		setTooltipSettings: (s: TooltipSettingsState) => setStore("tooltip", "settings", reconcile(s)),

		/* --- options --- */
		setChartOptions: (o: Partial<OptionsState>) =>
			setStore(
				"options",
				produce((s) => Object.assign(s, o)),
			),

		/* --- polarOptions --- */
		setPolarOptions: (o: PolarOptionsState | null) => setStore("polarOptions", reconcile(o)),

		/* --- rootProps --- */
		setRootProps: (p: RootPropsState) => setStore("rootProps", reconcile(p)),

		/* --- eventSettings --- */
		setEventSettings: (s: EventSettingsState) => setStore("eventSettings", reconcile(s)),

		/* --- referenceElements --- */
		addReferenceDot: (dot: ReferenceDotSettings) =>
			setStore("referenceElements", "dots", (d) => [...d, dot]),
		removeReferenceDot: (dot: ReferenceDotSettings) =>
			setStore("referenceElements", "dots", (d) => d.filter((x) => x !== dot)),
		addReferenceLine: (line: ReferenceLineSettings) =>
			setStore("referenceElements", "lines", (l) => [...l, line]),
		removeReferenceLine: (line: ReferenceLineSettings) =>
			setStore("referenceElements", "lines", (l) => l.filter((x) => x !== line)),
		addReferenceArea: (area: ReferenceAreaSettings) =>
			setStore("referenceElements", "areas", (a) => [...a, area]),
		removeReferenceArea: (area: ReferenceAreaSettings) =>
			setStore("referenceElements", "areas", (a) => a.filter((x) => x !== area)),

		/* --- errorBars --- */
		addErrorBar: (itemId: string, bar: ErrorBarSettings) =>
			setStore("errorBars", itemId, (prev) => [...(prev ?? []), bar]),
		removeErrorBar: (itemId: string, bar: ErrorBarSettings) =>
			setStore("errorBars", itemId, (prev) =>
				(prev ?? []).filter((b) => b.dataKey !== bar.dataKey || b.direction !== bar.direction),
			),

		/* --- zIndex --- */
		registerZIndexPortal: (zIndex: number) =>
			setStore(
				"zIndex",
				"zIndexMap",
				zIndex,
				produce((entry) => {
					if (!entry) return { element: undefined, panoramaElement: undefined, consumers: 1 }
					entry.consumers++
				}),
			),
		unregisterZIndexPortal: (zIndex: number) =>
			setStore(
				"zIndex",
				"zIndexMap",
				zIndex,
				produce((entry) => {
					if (!entry) return
					entry.consumers--
				}),
			),
	}
}
```

## Selectors → createMemo

### Tier 1: Direct Access (no memo needed)

State readers become plain property access — Solid tracks automatically:

```typescript
/* Redux */
const selectChartWidth = (state: RootState) => state.layout.width
const width = useAppSelector(selectChartWidth)

/* Solid */
const { store } = useChartStore()
const width = store.layout.width /* tracked automatically in JSX/effects */
```

### Tier 2: Derived State (createMemo)

Reselect selectors become createMemo:

```typescript
/* Redux + reselect */
const selectChartOffset = createSelector(
	[
		selectChartWidth,
		selectChartHeight,
		selectMargin,
		selectBrushHeight,
		selectLegendSize,
		selectAllAxes,
	],
	combineChartOffset,
)

/* Solid */
function useChartOffset() {
	const { store } = useChartStore()
	return createMemo(() =>
		combineChartOffset(
			store.layout.width,
			store.layout.height,
			store.layout.margin,
			store.brush.height,
			store.legend.size,
			selectAllAxes(store) /* can be another memo */,
		),
	)
}
```

### Tier 3: Parameterized Selectors

Redux uses "picker" functions to pass params through createSelector. Solid just passes params:

```typescript
/* Redux — needs picker hack */
const selectAxisDomain = createSelector(
  [pickAxisType, pickAxisId, selectBaseAxis, ...],
  combineAxisDomain
)
/* usage: selectAxisDomain(state, axisType, axisId) */

/* Solid — just use params directly */
function useAxisDomain(axisType: AxisType, axisId: AxisId) {
  const { store } = useChartStore()
  return createMemo(() => {
    const axis = store.cartesianAxis[axisType][axisId]
    /* ... other deps ... */
    return combineAxisDomain(axis, /* ... */)
  })
}
```

### Tier 4: Combiners (keep as-is)

All pure functions in `combiners/` stay identical — they're framework-agnostic:

```typescript
/* Same in both Redux and Solid */
function combineAxisDomain(
	axis: BaseCartesianAxis,
	layout: LayoutType,
	displayedData: ChartData | undefined,
	/* ... */
): NumberDomain | CategoricalDomain | undefined {
	/* pure logic, unchanged */
}
```

## Middleware → Event Handlers

Redux middleware becomes direct event handlers with optional throttling:

```typescript
function createEventHandlers(store: ChartStore, actions: ChartActions) {
	let rafId: number | null = null
	let latestPointer: RelativePointer | null = null

	return {
		handleMouseMove: (pointer: RelativePointer) => {
			latestPointer = pointer
			const { throttleDelay, throttledEvents } = store.eventSettings
			const isThrottled = throttledEvents === "all" || throttledEvents.includes("mousemove")

			if (rafId !== null) {
				cancelAnimationFrame(rafId)
				rafId = null
			}

			const callback = () => {
				if (!latestPointer) return
				const tooltipEventType = selectTooltipEventType(store)
				if (tooltipEventType === "axis") {
					const activeProps = selectActivePropsFromChartPointer(store, latestPointer)
					if (activeProps?.activeIndex != null) {
						actions.setMouseOverAxisIndex({
							activeIndex: activeProps.activeIndex,
							activeDataKey: undefined,
							activeCoordinate: activeProps.activeCoordinate,
						})
					} else {
						actions.mouseLeaveChart()
					}
				}
				rafId = null
			}

			if (!isThrottled) {
				callback()
				return
			}

			if (throttleDelay === "raf") {
				rafId = requestAnimationFrame(callback)
			}
			/* ... timeout throttling same pattern ... */
		},

		handleMouseClick: (pointer: RelativePointer) => {
			const activeProps = selectActivePropsFromChartPointer(store, pointer)
			if (activeProps?.activeIndex != null) {
				actions.setMouseClickAxisIndex({
					activeIndex: activeProps.activeIndex,
					activeDataKey: undefined,
					activeCoordinate: activeProps.activeCoordinate,
				})
			}
		},

		handleKeyDown: (key: string) => {
			/* ... keyboard navigation logic ... */
		},

		handleFocus: () => {
			if (!store.rootProps.accessibilityLayer) return
			const { keyboardInteraction } = store.tooltip
			if (!keyboardInteraction.active && keyboardInteraction.index == null) {
				actions.setKeyboardInteraction({
					active: true,
					activeIndex: "0",
					activeCoordinate: selectCoordinateForDefaultIndex(store, "axis", "hover", "0"),
				})
			}
		},

		handleBlur: () => {
			if (!store.rootProps.accessibilityLayer) return
			const { keyboardInteraction } = store.tooltip
			if (keyboardInteraction.active) {
				actions.setKeyboardInteraction({
					active: false,
					activeIndex: keyboardInteraction.index,
					activeCoordinate: keyboardInteraction.coordinate,
				})
			}
		},

		handleTouchMove: (touches: TouchList, currentTarget: HTMLElement) => {
			/* ... same throttle pattern as mouseMove ... */
		},

		handleExternalEvent: (eventType: string, handler: Function, event: Event) => {
			/* ... per-event-type throttle maps ... */
		},

		cleanup: () => {
			if (rafId !== null) cancelAnimationFrame(rafId)
			/* ... clear all timeouts ... */
		},
	}
}
```

## What Gets Deleted

| Redux Code                              | Lines     | Solid Replacement            |
| --------------------------------------- | --------- | ---------------------------- |
| `store.ts` (configureStore)             | 116       | ~5 lines createStore         |
| `RechartsReduxContext.tsx`              | ~30       | ~5 lines createContext       |
| `RechartsStoreProvider.tsx`             | ~50       | ~15 lines Provider component |
| `hooks.ts` (useAppSelector/Dispatch)    | ~40       | 0 — direct access            |
| `prepareAutoBatched` in every slice     | scattered | 0 — Solid batches natively   |
| Picker selectors (~30 files)            | ~300      | 0 — pass params directly     |
| `reduxDevtoolsJsonStringifyReplacer.ts` | ~30       | 0                            |
| **Total deleted**                       | **~600+** | **~25 lines replacement**    |

## Component Registration Pattern

Redux uses "Report" components to dispatch state into store. Solid uses `onMount`/`onCleanup`:

```typescript
/* Redux: ReportChartProps.tsx */
function ReportChartProps(props) {
	const dispatch = useAppDispatch()
	useEffect(() => {
		dispatch(setChartData(props.data))
	}, [props.data])
	return null
}

/* Solid: just use onMount + createEffect in the provider or component */
function ChartDataSync(props: { data: ChartData }) {
	const { actions } = useChartStore()
	createEffect(() => actions.setChartData(props.data))
	onCleanup(() => actions.setChartData(undefined))
	return null
}
```

## Panorama (Brush) Pattern

Redux avoids nested providers for brush's mini-chart. Solid does the same:

```typescript
function ChartProvider(props) {
  const parentStore = useContext(ChartStoreContext)
  const isPanorama = !!parentStore

  /* If panorama, reuse parent store */
  if (isPanorama) {
    return <>{props.children}</>
  }

  const [store, setStore] = createStore(createInitialState())
  const actions = createActions(store, setStore)
  return (
    <ChartStoreContext.Provider value={{ store, setStore, actions }}>
      {props.children}
    </ChartStoreContext.Provider>
  )
}
```

## File Structure

```
src/
├── store/
│   ├── types.ts           /* All state types (from Redux slice types) */
│   ├── initial.ts         /* Initial state for all sections */
│   ├── context.ts         /* createContext + useChartStore */
│   ├── actions.ts         /* createActions function */
│   ├── events.ts          /* createEventHandlers (replaces 4 middleware) */
│   └── provider.tsx       /* ChartProvider component */
├── selectors/             /* Same structure, createMemo instead of createSelector */
│   ├── combiners/         /* UNCHANGED — pure functions */
│   ├── axisSelectors.ts
│   ├── tooltipSelectors.ts
│   ├── barSelectors.ts
│   └── ...
└── ...
```

## Migration Checklist

- [ ] Define `ChartStore` type (merge all slice types)
- [ ] Define `createInitialState()` (merge all initialStates)
- [ ] Create `ChartStoreContext` + `useChartStore`
- [ ] Create `createActions()` (merge all reducers)
- [ ] Create `createEventHandlers()` (merge all middleware)
- [ ] Create `ChartProvider` component
- [ ] Port selectors: state readers → direct access
- [ ] Port selectors: computed → createMemo hooks
- [ ] Delete picker selectors entirely
- [ ] Keep combiner functions unchanged
- [ ] Port Report\* components → createEffect + onCleanup
- [ ] Port Set\* components → createEffect + onCleanup
