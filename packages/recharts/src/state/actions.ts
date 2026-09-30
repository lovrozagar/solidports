/* eslint-disable import/no-cycle, sort-keys */
import { batch } from "solid-js"
import { produce } from "solid-js/store"
import type { SetStoreFunction } from "solid-js/store"
import type { RechartsRootState } from "./store"
import type { ChartState } from "./_solid/chartState"
import type { CartesianItemState, PolarItemState } from "./_solid/chartState"
import { isDefaultZIndex } from "./zIndexSlice"
import type {
	AxisId,
	XAxisSettings,
	YAxisSettings,
	ZAxisSettings,
} from "./cartesianAxisSlice"
import type { BrushStartEndIndexActionPayload, ChartData } from "./chartDataSlice"
import type { ErrorBarsSettings } from "./errorBarSlice"
import type { EventSettingsState } from "./eventSettingsSlice"
import type {
	CartesianGraphicalItemSettings,
	GraphicalItemId,
	PolarGraphicalItemSettings,
	ReplacePayload,
} from "./graphicalItemsSlice"
import type { LegendSettings } from "./legendSlice"
import type { LegendPayload } from "../component/DefaultLegendContent"
import type { Margin, Size } from "../util/types"
import type { AngleAxisSettings, RadiusAxisSettings } from "./polarAxisSlice"
import type {
	ReferenceAreaSettings,
	ReferenceDotSettings,
	ReferenceLineSettings,
} from "./referenceElementsSlice"
import type {
	AxisTooltipActionPayload,
	GraphicalItemTooltipActionPayload,
	TooltipPayloadConfiguration,
	TooltipSettingsState,
	TooltipSyncState,
} from "./tooltipSlice"

/**
 * Native Solid actions factory. Replaces per-slice action thunk exports.
 *
 * Each method takes the same payload shape as the legacy creator and applies the
 * mutation through `setStore` directly — no `(setStore, store) => ...` indirection.
 *
 * Method names mirror the legacy exports 1:1 so call sites can migrate from
 * `dispatch(setBrushSettings(x))` → `actions.setBrushSettings(x)` without renaming.
 */
export function createActions(
	store: RechartsRootState,
	setStore: SetStoreFunction<RechartsRootState>,
	setChartState?: SetStoreFunction<ChartState> | undefined,
) {
	return {
		/* --- brush --- */
		setBrushSettings(settings: { height: number; padding: { bottom: number; left: number; right: number; top: number }; width: number | undefined; x: number | undefined; y: number | undefined } | null): void {
			const val = settings ?? { height: 0, padding: { bottom: 0, left: 0, right: 0, top: 0 }, width: 0, x: 0, y: 0 }
			setStore("_solid", "brush", val)
			setChartState?.("brush", val)
			/* Legacy compat shim — dual-write keeps state.brush current for selector fallback */
			setStore("brush", val)
		},

		/* --- cartesianAxis --- */
		addXAxis(settings: XAxisSettings): void {
			setStore("_solid", "cartesianAxes", "xAxis", String(settings.id), { settings })
			setChartState?.("cartesianAxes", "xAxis", String(settings.id), { settings })
		},
		removeXAxis(settings: XAxisSettings): void {
			const id = String(settings.id)
			setStore("_solid", "cartesianAxes", "xAxis", produce((axes) => { delete axes[id] }))
			setChartState?.("cartesianAxes", "xAxis", produce((axes) => { delete axes[id] }))
		},
		replaceXAxis(payload: { prev: XAxisSettings; next: XAxisSettings }): void {
			setStore("_solid", "cartesianAxes", "xAxis", String(payload.next.id), { settings: payload.next })
			setChartState?.("cartesianAxes", "xAxis", String(payload.next.id), { settings: payload.next })
		},
		addYAxis(settings: YAxisSettings): void {
			setStore("_solid", "cartesianAxes", "yAxis", String(settings.id), { settings })
			setChartState?.("cartesianAxes", "yAxis", String(settings.id), { settings })
		},
		removeYAxis(settings: YAxisSettings): void {
			const id = String(settings.id)
			setStore("_solid", "cartesianAxes", "yAxis", produce((axes) => { delete axes[id] }))
			setChartState?.("cartesianAxes", "yAxis", produce((axes) => { delete axes[id] }))
		},
		replaceYAxis(payload: { prev: YAxisSettings; next: YAxisSettings }): void {
			setStore("_solid", "cartesianAxes", "yAxis", String(payload.next.id), { settings: payload.next })
			setChartState?.("cartesianAxes", "yAxis", String(payload.next.id), { settings: payload.next })
		},
		updateYAxisWidth(payload: { id: AxisId; width: number }): void {
			const axisEntry = store._solid.cartesianAxes.yAxis[String(payload.id)]
			const axis = axisEntry?.settings
			if (axis == null) return
			const history = axis.widthHistory ?? []
			if (
				history.length === 3 &&
				history[0] === history[2] &&
				payload.width === history[1] &&
				payload.width !== axis.width &&
				Math.abs(payload.width - (history[0] ?? 0)) <= 1
			) {
				return
			}
			const newHistory = [...history, payload.width].slice(-3)
			const updated = { ...axis, width: payload.width, widthHistory: newHistory }
			setStore("_solid", "cartesianAxes", "yAxis", String(payload.id), "settings", updated)
			setChartState?.("cartesianAxes", "yAxis", String(payload.id), "settings", updated)
		},
		addZAxis(settings: ZAxisSettings): void {
			setStore("_solid", "cartesianAxes", "zAxis", String(settings.id), { settings })
			setChartState?.("cartesianAxes", "zAxis", String(settings.id), { settings })
		},
		removeZAxis(settings: ZAxisSettings): void {
			const id = String(settings.id)
			setStore("_solid", "cartesianAxes", "zAxis", produce((axes) => { delete axes[id] }))
			setChartState?.("cartesianAxes", "zAxis", produce((axes) => { delete axes[id] }))
		},
		replaceZAxis(payload: { prev: ZAxisSettings; next: ZAxisSettings }): void {
			setStore("_solid", "cartesianAxes", "zAxis", String(payload.next.id), { settings: payload.next })
			setChartState?.("cartesianAxes", "zAxis", String(payload.next.id), { settings: payload.next })
		},

		/* --- chartData --- */
		setChartData(data: ChartData | undefined): void {
			setStore("chartData", "chartData", data)
			if (data == null) {
				setStore("chartData", "dataStartIndex", 0)
				setStore("chartData", "dataEndIndex", 0)
				return
			}
			if (data.length > 0) {
				setStore("chartData", "dataEndIndex", (prev: number) =>
					prev !== data.length - 1 ? data.length - 1 : prev,
				)
			}
		},
		setComputedData(data: unknown): void {
			setStore("chartData", "computedData", data)
		},
		setDataStartEndIndexes(payload: BrushStartEndIndexActionPayload): void {
			if (payload.startIndex !== undefined) {
				setStore("chartData", "dataStartIndex", payload.startIndex)
			}
			if (payload.endIndex !== undefined) {
				setStore("chartData", "dataEndIndex", payload.endIndex)
			}
		},

		/* --- errorBars (produce-based, see GOTCHA-013) --- */
		addErrorBar(payload: { errorBar: ErrorBarsSettings; itemId: GraphicalItemId }): void {
			setStore(
				"errorBars",
				produce((errorBars) => {
					const list = errorBars[payload.itemId] ?? []
					errorBars[payload.itemId] = [...list, payload.errorBar]
				}),
			)
		},
		removeErrorBar(payload: { errorBar: ErrorBarsSettings; itemId: GraphicalItemId }): void {
			setStore(
				"errorBars",
				produce((errorBars) => {
					const list = errorBars[payload.itemId]
					if (list == null) return
					errorBars[payload.itemId] = list.filter((e) => e !== payload.errorBar)
				}),
			)
		},
		replaceErrorBar(payload: {
			itemId: GraphicalItemId
			prev: ErrorBarsSettings
			next: ErrorBarsSettings
		}): void {
			setStore(
				"errorBars",
				produce((errorBars) => {
					const list = errorBars[payload.itemId]
					if (list == null) return
					errorBars[payload.itemId] = list.map((e) =>
						e === payload.prev ? payload.next : e,
					)
				}),
			)
		},

		/* --- eventSettings --- */
		setEventSettings(settings: Partial<EventSettingsState>): void {
			if (settings.throttleDelay !== undefined) {
				setStore("eventSettings", "throttleDelay", settings.throttleDelay)
			}
			if (settings.throttledEvents !== undefined) {
				setStore("eventSettings", "throttledEvents", settings.throttledEvents)
			}
		},

		/* --- graphicalItems --- */
		addCartesianGraphicalItem(item: CartesianGraphicalItemSettings): void {
			if (item.id != null) {
				const itemState = { settings: item, type: item.type } as CartesianItemState
				setStore("_solid", "graphicalItems", String(item.id), itemState as never)
				setChartState?.("graphicalItems", String(item.id), itemState as never)
			}
		},
		removeCartesianGraphicalItem(item: CartesianGraphicalItemSettings): void {
			if (item.id != null) {
				setStore("_solid", "graphicalItems", String(item.id), undefined as never)
				setChartState?.("graphicalItems", String(item.id), undefined as never)
			}
		},
		replaceCartesianGraphicalItem(payload: ReplacePayload<CartesianGraphicalItemSettings>): void {
			if (payload.next.id != null) {
				const itemState = { settings: payload.next, type: payload.next.type } as CartesianItemState
				setStore("_solid", "graphicalItems", String(payload.next.id), itemState as never)
				setChartState?.("graphicalItems", String(payload.next.id), itemState as never)
			}
		},
		addPolarGraphicalItem(item: PolarGraphicalItemSettings): void {
			if (item.id != null) {
				const itemState = { settings: item, type: item.type } as PolarItemState
				setStore("_solid", "graphicalItems", String(item.id), itemState as never)
				setChartState?.("graphicalItems", String(item.id), itemState as never)
			}
		},
		removePolarGraphicalItem(item: PolarGraphicalItemSettings): void {
			if (item.id != null) {
				setStore("_solid", "graphicalItems", String(item.id), undefined as never)
				setChartState?.("graphicalItems", String(item.id), undefined as never)
			}
		},
		replacePolarGraphicalItem(payload: ReplacePayload<PolarGraphicalItemSettings>): void {
			if (payload.next.id != null) {
				const itemState = { settings: payload.next, type: payload.next.type } as PolarItemState
				setStore("_solid", "graphicalItems", String(payload.next.id), itemState as never)
				setChartState?.("graphicalItems", String(payload.next.id), itemState as never)
			}
		},

		/* --- layout --- */
		setChartSize(size: Size): void {
			setStore("layout", "width", size.width)
			setStore("layout", "height", size.height)
		},
		setMargin(margin: Margin): void {
			setStore("layout", "margin", margin)
		},
		setScale(scale: number): void {
			setStore("layout", "scale", scale)
		},

		/* --- legend --- */
		setLegendSettings(settings: LegendSettings): void {
			setStore("_solid", "legend", "settings", settings)
			setChartState?.("legend", "settings", settings)
		},
		setLegendSize(size: Size): void {
			setStore("_solid", "legend", "size", size)
			setChartState?.("legend", "size", size)
		},
		addLegendPayload(payload: ReadonlyArray<LegendPayload>): void {
			setStore("_solid", "legend", "payload", (prev: ReadonlyArray<ReadonlyArray<LegendPayload>>) => [...prev, payload])
			setChartState?.("legend", "payload", (prev: ReadonlyArray<ReadonlyArray<LegendPayload>>) => [...prev, payload])
		},
		removeLegendPayload(payload: ReadonlyArray<LegendPayload>): void {
			setStore("_solid", "legend", "payload", (prev: ReadonlyArray<ReadonlyArray<LegendPayload>>) => {
				const index = prev.indexOf(payload)
				if (index === -1) return prev
				return [...prev.slice(0, index), ...prev.slice(index + 1)]
			})
			setChartState?.("legend", "payload", (prev: ReadonlyArray<ReadonlyArray<LegendPayload>>) => {
				const index = prev.indexOf(payload)
				if (index === -1) return prev
				return [...prev.slice(0, index), ...prev.slice(index + 1)]
			})
		},
		replaceLegendPayload(
			prev: ReadonlyArray<LegendPayload>,
			next: ReadonlyArray<LegendPayload>,
		): void {
			setStore("_solid", "legend", "payload", (arr: ReadonlyArray<ReadonlyArray<LegendPayload>>) => {
				const index = arr.indexOf(prev)
				if (index === -1) return arr
				const copy = [...arr]
				copy[index] = next
				return copy
			})
			setChartState?.("legend", "payload", (arr: ReadonlyArray<ReadonlyArray<LegendPayload>>) => {
				const index = arr.indexOf(prev)
				if (index === -1) return arr
				const copy = [...arr]
				copy[index] = next
				return copy
			})
		},

		/* --- polarAxis --- */
		addAngleAxis(settings: AngleAxisSettings): void {
			setStore("_solid", "polarAxes", "angleAxis", String(settings.id), { settings })
			setChartState?.("polarAxes", "angleAxis", String(settings.id), { settings })
		},
		removeAngleAxis(settings: AngleAxisSettings): void {
			const id = String(settings.id)
			setStore("_solid", "polarAxes", "angleAxis", produce((axes) => { delete axes[id] }))
			setChartState?.("polarAxes", "angleAxis", produce((axes) => { delete axes[id] }))
		},
		addRadiusAxis(settings: RadiusAxisSettings): void {
			setStore("_solid", "polarAxes", "radiusAxis", String(settings.id), { settings })
			setChartState?.("polarAxes", "radiusAxis", String(settings.id), { settings })
		},
		removeRadiusAxis(settings: RadiusAxisSettings): void {
			const id = String(settings.id)
			setStore("_solid", "polarAxes", "radiusAxis", produce((axes) => { delete axes[id] }))
			setChartState?.("polarAxes", "radiusAxis", produce((axes) => { delete axes[id] }))
		},

		/* --- referenceElements --- */
		addLine(settings: ReferenceLineSettings): void {
			setStore("referenceElements", "lines", (prev) => [...prev, settings])
		},
		removeLine(settings: ReferenceLineSettings): void {
			setStore("referenceElements", "lines", (prev) => prev.filter((l) => l !== settings))
		},
		addDot(settings: ReferenceDotSettings): void {
			setStore("referenceElements", "dots", (prev) => [...prev, settings])
		},
		removeDot(settings: ReferenceDotSettings): void {
			setStore("referenceElements", "dots", (prev) => prev.filter((d) => d !== settings))
		},
		addArea(settings: ReferenceAreaSettings): void {
			setStore("referenceElements", "areas", (prev) => [...prev, settings])
		},
		removeArea(settings: ReferenceAreaSettings): void {
			setStore("referenceElements", "areas", (prev) => prev.filter((a) => a !== settings))
		},

		/* --- tooltip --- */
		mouseLeaveChart(): void {
			batch(() => {
				setStore("_solid", "tooltip", "axisInteraction", "hover", "active", false)
				setStore("_solid", "tooltip", "itemInteraction", "hover", "active", false)
				/* Legacy compat shim — tests reading state.tooltip.* directly. */
				setStore("tooltip", "axisInteraction", "hover", "active", false)
				setStore("tooltip", "itemInteraction", "hover", "active", false)
				setChartState?.("tooltip", "axisInteraction", "hover", "active", false)
				setChartState?.("tooltip", "itemInteraction", "hover", "active", false)
			})
		},
		mouseLeaveItem(): void {
			batch(() => {
				setStore("_solid", "tooltip", "itemInteraction", "hover", "active", false)
				setStore("tooltip", "itemInteraction", "hover", "active", false)
				setChartState?.("tooltip", "itemInteraction", "hover", "active", false)
			})
		},
		setActiveMouseOverItemIndex(payload: GraphicalItemTooltipActionPayload): void {
			const itemPayload = {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: payload.activeGraphicalItemId,
				index: payload.activeIndex,
			}
			batch(() => {
				setStore("_solid", "tooltip", "itemInteraction", "hover", itemPayload)
				setStore("tooltip", "itemInteraction", "hover", itemPayload)
				setChartState?.("tooltip", "itemInteraction", "hover", itemPayload)
			})
		},
		setActiveClickItemIndex(payload: GraphicalItemTooltipActionPayload): void {
			const itemPayload = {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: payload.activeGraphicalItemId,
				index: payload.activeIndex,
			}
			batch(() => {
				setStore("_solid", "tooltip", "itemInteraction", "click", itemPayload)
				setStore("tooltip", "itemInteraction", "click", itemPayload)
				setChartState?.("tooltip", "itemInteraction", "click", itemPayload)
			})
		},
		setTooltipSettingsState(settings: TooltipSettingsState): void {
			setStore("_solid", "tooltip", "settings", settings)
			setStore("tooltip", "settings", settings)
			setChartState?.("tooltip", "settings", settings)
		},
		setMouseOverAxisIndex(payload: AxisTooltipActionPayload): void {
			const axisPayload = {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: undefined,
				index: payload.activeIndex,
			}
			setStore("_solid", "tooltip", "axisInteraction", "hover", axisPayload)
			setStore("tooltip", "axisInteraction", "hover", axisPayload)
			setChartState?.("tooltip", "axisInteraction", "hover", axisPayload)
		},
		setMouseClickAxisIndex(payload: AxisTooltipActionPayload): void {
			batch(() => {
				setStore("_solid", "tooltip", "syncInteraction", "active", false)
				setStore("_solid", "tooltip", "syncInteraction", "sourceViewBox", undefined)
				setStore("_solid", "tooltip", "keyboardInteraction", "active", false)
				setStore("_solid", "tooltip", "axisInteraction", "click", {
					active: true,
					coordinate: payload.activeCoordinate,
					dataKey: payload.activeDataKey,
					graphicalItemId: undefined,
					index: payload.activeIndex,
				})
				setStore("tooltip", "syncInteraction", "active", false)
				setStore("tooltip", "syncInteraction", "sourceViewBox", undefined)
				setStore("tooltip", "keyboardInteraction", "active", false)
				setStore("tooltip", "axisInteraction", "click", {
					active: true,
					coordinate: payload.activeCoordinate,
					dataKey: payload.activeDataKey,
					graphicalItemId: undefined,
					index: payload.activeIndex,
				})
				setChartState?.("tooltip", "syncInteraction", "active", false)
				setChartState?.("tooltip", "syncInteraction", "sourceViewBox", undefined)
				setChartState?.("tooltip", "keyboardInteraction", "active", false)
				setChartState?.("tooltip", "axisInteraction", "click", {
					active: true,
					coordinate: payload.activeCoordinate,
					dataKey: payload.activeDataKey,
					graphicalItemId: undefined,
					index: payload.activeIndex,
				})
			})
		},
		setSyncInteraction(payload: TooltipSyncState): void {
			setStore("_solid", "tooltip", "syncInteraction", payload)
			setStore("tooltip", "syncInteraction", payload)
			setChartState?.("tooltip", "syncInteraction", payload)
		},
		addTooltipEntrySettings(payload: TooltipPayloadConfiguration): void {
			setStore("_solid", "tooltip", "tooltipItemPayloads", (prev: ReadonlyArray<TooltipPayloadConfiguration>) => [...prev, payload])
			setStore("tooltip", "tooltipItemPayloads", (prev: ReadonlyArray<TooltipPayloadConfiguration>) => [...prev, payload])
			setChartState?.("tooltip", "tooltipItemPayloads", (prev: ReadonlyArray<TooltipPayloadConfiguration>) => [...prev, payload])
		},

		/* --- zIndex --- */
		registerZIndexPortalElement(payload: {
			element: Element
			isPanorama: boolean
			zIndex: number
		}): void {
			ensureZIndexEntry(setStore, payload.zIndex, store.zIndex.zIndexMap)
			const key = payload.isPanorama ? "panoramaElement" : "element"
			setStore("zIndex", "zIndexMap", payload.zIndex, key, payload.element)
		},
		unregisterZIndexPortalElement(payload: { isPanorama: boolean; zIndex: number }): void {
			ensureZIndexEntry(setStore, payload.zIndex, store.zIndex.zIndexMap)
			const key = payload.isPanorama ? "panoramaElement" : "element"
			setStore("zIndex", "zIndexMap", payload.zIndex, key, undefined)
		},
		addZIndexLayer(payload: { zIndex: number }): void {
			ensureZIndexEntry(setStore, payload.zIndex, store.zIndex.zIndexMap)
			setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", (c: number) => c + 1)
		},
		removeZIndexLayer(payload: { zIndex: number }): void {
			setStore(
				"zIndex",
				"zIndexMap",
				payload.zIndex,
				"consumers",
				(c: number) => Math.max(0, c - 1),
			)
		},
		registerZIndexPortal(payload: { zIndex: number }): void {
			const existing = store.zIndex.zIndexMap[payload.zIndex]
			if (existing) {
				setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", existing.consumers + 1)
			} else {
				setStore("zIndex", "zIndexMap", payload.zIndex, {
					consumers: 1,
					element: undefined,
					panoramaElement: undefined,
				})
			}
		},
		unregisterZIndexPortal(payload: { zIndex: number }): void {
			const existing = store.zIndex.zIndexMap[payload.zIndex]
			if (existing) {
				const newConsumers = existing.consumers - 1
				if (newConsumers <= 0 && !isDefaultZIndex(payload.zIndex)) {
					setStore("zIndex", "zIndexMap", (prev) => {
						const next = { ...prev }
						delete next[payload.zIndex]
						return next
					})
				} else {
					setStore("zIndex", "zIndexMap", payload.zIndex, "consumers", newConsumers)
				}
			}
		},
	}
}

export type ChartActions = ReturnType<typeof createActions>

/* Solid's setStore("zIndex","zIndexMap",N,key,...) crashes when zIndexMap[N]
   is undefined (custom zIndex outside DefaultZIndexes). Pre-seed before nested write. */
function ensureZIndexEntry(
	setStore: SetStoreFunction<RechartsRootState>,
	zIndex: number,
	currentMap: RechartsRootState["zIndex"]["zIndexMap"],
): void {
	if (currentMap[zIndex] != null) return
	setStore("zIndex", "zIndexMap", zIndex, {
		consumers: 0,
		element: undefined,
		panoramaElement: undefined,
	})
}
