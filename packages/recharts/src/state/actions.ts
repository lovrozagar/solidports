/* eslint-disable import/no-cycle, sort-keys */
import type { ChartState } from "./chartState"
import type { CartesianItemState, PolarItemState } from "./chartState"
import { readChartState } from "./chartState"
import { snapshot } from "solid-js"
import { markRawData } from "./rawData"
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

import { type SetStoreFunction } from '../util/solid-1-compat';
import { isSameStoreEntry } from "./storeIdentity"
import { setTooltipInteraction } from "./tooltipInteraction"
/**
 * Native Solid actions factory. Every mutator writes ChartState only.
 *
 * Method names mirror the legacy exports 1:1 so call sites can migrate from
 * `dispatch(setBrushSettings(x))` → `actions.setBrushSettings(x)` without renaming.
 */
export function createActions(
	store: ChartState,
	setStore: SetStoreFunction<ChartState>,
) {
	const setState = setStore
	const chart = readChartState(store)

	/* Upstream replaces the item in place: a changed id keeps the old item's position. */
	/* Item-level data is served by reference like chart data (see markRawData). */
	const cartesianItemState = (settings: CartesianGraphicalItemSettings): CartesianItemState => {
		markRawData((settings as { data?: unknown }).data)
		return { settings, type: settings.type } as CartesianItemState
	}
	const polarItemState = (settings: PolarGraphicalItemSettings): PolarItemState => {
		markRawData((settings as { data?: unknown }).data)
		return { settings, type: settings.type } as PolarItemState
	}

	const replaceGraphicalItem = (
		prevId: string,
		nextId: string,
		itemState: CartesianItemState | PolarItemState,
	): void => {
		if (prevId === nextId || !(prevId in store.graphicalItems)) {
			setState("graphicalItems", nextId, itemState as never)
			return
		}
		setState((draft) => {
			const entries = Object.entries(snapshot(draft.graphicalItems))
			for (const [key] of entries) {
				delete draft.graphicalItems[key]
			}
			for (const [key, value] of entries) {
				if (key === prevId) {
					draft.graphicalItems[nextId] = itemState
				} else if (key !== nextId) {
					draft.graphicalItems[key] = value
				}
			}
		})
	}

	return {
		/* --- brush --- */
		setBrushSettings(settings: { height: number; padding: { bottom: number; left: number; right: number; top: number }; width: number | undefined; x: number | undefined; y: number | undefined } | null): void {
			const val = settings ?? { height: 0, padding: { bottom: 0, left: 0, right: 0, top: 0 }, width: 0, x: 0, y: 0 }
			setState("brush", val)
		},

		/* --- cartesianAxis --- */
		addXAxis(settings: XAxisSettings): void {
			setState("cartesianAxes", "xAxis", String(settings.id), { settings })
		},
		removeXAxis(settings: XAxisSettings): void {
			const id = String(settings.id)
			setState("cartesianAxes", "xAxis", (axes) => { delete axes[id] })
		},
		replaceXAxis(payload: { prev: XAxisSettings; next: XAxisSettings }): void {
			setState("cartesianAxes", "xAxis", String(payload.next.id), { settings: payload.next })
		},
		addYAxis(settings: YAxisSettings): void {
			setState("cartesianAxes", "yAxis", String(settings.id), { settings })
		},
		removeYAxis(settings: YAxisSettings): void {
			const id = String(settings.id)
			setState("cartesianAxes", "yAxis", (axes) => { delete axes[id] })
		},
		replaceYAxis(payload: { prev: YAxisSettings; next: YAxisSettings }): void {
			setState("cartesianAxes", "yAxis", String(payload.next.id), { settings: payload.next })
		},
		updateYAxisWidth(payload: { id: AxisId; width: number }): void {
			const axisEntry = chart.cartesianAxes.yAxis[String(payload.id)]
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
			setState("cartesianAxes", "yAxis", String(payload.id), "settings", updated)
		},
		addZAxis(settings: ZAxisSettings): void {
			setState("cartesianAxes", "zAxis", String(settings.id), { settings })
		},
		removeZAxis(settings: ZAxisSettings): void {
			const id = String(settings.id)
			setState("cartesianAxes", "zAxis", (axes) => { delete axes[id] })
		},
		replaceZAxis(payload: { prev: ZAxisSettings; next: ZAxisSettings }): void {
			setState("cartesianAxes", "zAxis", String(payload.next.id), { settings: payload.next })
		},

		/* --- chartData --- */
		setChartData(data: ChartData | undefined): void {
			setState("chartData", "chartData", markRawData(data))
			if (data == null) {
				setState("chartData", "dataStartIndex", 0)
				setState("chartData", "dataEndIndex", 0)
				return
			}
			if (data.length > 0) {
				setState("chartData", "dataEndIndex", (prev: number) =>
					prev !== data.length - 1 ? data.length - 1 : prev,
				)
			}
		},
		setComputedData(data: unknown): void {
			setState("chartData", "computedData", markRawData(data))
		},
		setDataStartEndIndexes(payload: BrushStartEndIndexActionPayload): void {
			if (payload.startIndex !== undefined) {
				setState("chartData", "dataStartIndex", payload.startIndex)
			}
			if (payload.endIndex !== undefined) {
				setState("chartData", "dataEndIndex", payload.endIndex)
			}
		},

		/* --- errorBars (produce-based, see GOTCHA-013) --- */
		addErrorBar(payload: { errorBar: ErrorBarsSettings; itemId: GraphicalItemId }): void {
			setState(
				"errorBars",
				(errorBars) => {
					const list = errorBars[payload.itemId] ?? []
					errorBars[payload.itemId] = [...list, payload.errorBar]
				},
			)
		},
		removeErrorBar(payload: { errorBar: ErrorBarsSettings; itemId: GraphicalItemId }): void {
			setState(
				"errorBars",
				(errorBars) => {
					const list = errorBars[payload.itemId]
					if (list == null) return
					errorBars[payload.itemId] = list.filter((e) => !isSameStoreEntry(e, payload.errorBar))
				},
			)
		},
		replaceErrorBar(payload: {
			itemId: GraphicalItemId
			prev: ErrorBarsSettings
			next: ErrorBarsSettings
		}): void {
			setState(
				"errorBars",
				(errorBars) => {
					const list = errorBars[payload.itemId]
					if (list == null) return
					errorBars[payload.itemId] = list.map((e) =>
						e === payload.prev ? payload.next : e,
					)
				},
			)
		},

		/* --- eventSettings --- */
		setEventSettings(settings: Partial<EventSettingsState>): void {
			if (settings.throttleDelay !== undefined) {
				setState("eventSettings", "throttleDelay", settings.throttleDelay)
			}
			if (settings.throttledEvents !== undefined) {
				setState("eventSettings", "throttledEvents", settings.throttledEvents)
			}
		},

		/* --- graphicalItems --- */
		addCartesianGraphicalItem(item: CartesianGraphicalItemSettings): void {
			if (item.id != null) {
				setState("graphicalItems", String(item.id), cartesianItemState(item) as never)
			}
		},
		removeCartesianGraphicalItem(item: CartesianGraphicalItemSettings): void {
			if (item.id != null) {
				setState("graphicalItems", String(item.id), undefined as never)
			}
		},
		replaceCartesianGraphicalItem(payload: ReplacePayload<CartesianGraphicalItemSettings>): void {
			if (payload.next.id != null) {
				replaceGraphicalItem(String(payload.prev.id), String(payload.next.id), cartesianItemState(payload.next))
			}
		},
		addPolarGraphicalItem(item: PolarGraphicalItemSettings): void {
			if (item.id != null) {
				setState("graphicalItems", String(item.id), polarItemState(item) as never)
			}
		},
		removePolarGraphicalItem(item: PolarGraphicalItemSettings): void {
			if (item.id != null) {
				setState("graphicalItems", String(item.id), undefined as never)
			}
		},
		replacePolarGraphicalItem(payload: ReplacePayload<PolarGraphicalItemSettings>): void {
			if (payload.next.id != null) {
				replaceGraphicalItem(String(payload.prev.id), String(payload.next.id), polarItemState(payload.next))
			}
		},

		/* --- layout --- */
		setChartSize(size: Size): void {
			setState("layout", "width", size.width)
			setState("layout", "height", size.height)
		},
		setMargin(margin: Margin): void {
			setState("layout", "margin", margin)
		},
		setScale(scale: number): void {
			setState("layout", "scale", scale)
		},

		/* --- legend --- */
		setLegendSettings(settings: LegendSettings): void {
			setState("legend", "settings", settings)
		},
		setLegendSize(size: Size): void {
			setState("legend", "size", size)
		},
		addLegendPayload(payload: ReadonlyArray<LegendPayload>): void {
			setState("legend", "payload", (prev: ReadonlyArray<ReadonlyArray<LegendPayload>>) => [...prev, payload])
		},
		removeLegendPayload(payload: ReadonlyArray<LegendPayload>): void {
			setState("legend", "payload", (prev: ReadonlyArray<ReadonlyArray<LegendPayload>>) => {
				const index = prev.findIndex((e) => isSameStoreEntry(e, payload))
				if (index === -1) return prev
				return [...prev.slice(0, index), ...prev.slice(index + 1)]
			})
		},
		replaceLegendPayload(
			prev: ReadonlyArray<LegendPayload>,
			next: ReadonlyArray<LegendPayload>,
		): void {
			setState("legend", "payload", (arr: ReadonlyArray<ReadonlyArray<LegendPayload>>) => {
				const index = arr.findIndex((e) => isSameStoreEntry(e, prev))
				if (index === -1) return arr
				const copy = [...arr]
				copy[index] = next
				return copy
			})
		},

		/* --- polarAxis --- */
		addAngleAxis(settings: AngleAxisSettings): void {
			setState("polarAxes", "angleAxis", String(settings.id), { settings })
		},
		removeAngleAxis(settings: AngleAxisSettings): void {
			const id = String(settings.id)
			setState("polarAxes", "angleAxis", (axes) => { delete axes[id] })
		},
		addRadiusAxis(settings: RadiusAxisSettings): void {
			setState("polarAxes", "radiusAxis", String(settings.id), { settings })
		},
		removeRadiusAxis(settings: RadiusAxisSettings): void {
			const id = String(settings.id)
			setState("polarAxes", "radiusAxis", (axes) => { delete axes[id] })
		},

		/* --- referenceElements --- */
		addLine(settings: ReferenceLineSettings): void {
			setState("referenceElements", "lines", (prev) => [...prev, settings])
		},
		removeLine(settings: ReferenceLineSettings): void {
			setState("referenceElements", "lines", (prev) => prev.filter((l) => !isSameStoreEntry(l, settings)))
		},
		addDot(settings: ReferenceDotSettings): void {
			setState("referenceElements", "dots", (prev) => [...prev, settings])
		},
		removeDot(settings: ReferenceDotSettings): void {
			setState("referenceElements", "dots", (prev) => prev.filter((d) => !isSameStoreEntry(d, settings)))
		},
		addArea(settings: ReferenceAreaSettings): void {
			setState("referenceElements", "areas", (prev) => [...prev, settings])
		},
		removeArea(settings: ReferenceAreaSettings): void {
			setState("referenceElements", "areas", (prev) => prev.filter((a) => !isSameStoreEntry(a, settings)))
		},

		/* --- tooltip --- */
		mouseLeaveChart(): void {
			{
				setState("tooltip", "axisInteraction", "hover", "active", false)
				setState("tooltip", "itemInteraction", "hover", "active", false)
			}
		},
		mouseLeaveItem(): void {
			setState("tooltip", "itemInteraction", "hover", "active", false)
		},
		setActiveMouseOverItemIndex(payload: GraphicalItemTooltipActionPayload): void {
			const itemPayload = {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: payload.activeGraphicalItemId,
				index: payload.activeIndex,
			}
			setTooltipInteraction(setState, "itemInteraction", "hover", itemPayload)
		},
		setActiveClickItemIndex(payload: GraphicalItemTooltipActionPayload): void {
			const itemPayload = {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: payload.activeGraphicalItemId,
				index: payload.activeIndex,
			}
			setTooltipInteraction(setState, "itemInteraction", "click", itemPayload)
		},
		setTooltipSettingsState(settings: TooltipSettingsState): void {
			setState("tooltip", "settings", settings)
		},
		setMouseOverAxisIndex(payload: AxisTooltipActionPayload): void {
			const axisPayload = {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: undefined,
				index: payload.activeIndex,
			}
			setTooltipInteraction(setState, "axisInteraction", "hover", axisPayload)
		},
		setMouseClickAxisIndex(payload: AxisTooltipActionPayload): void {
			setTooltipInteraction(setState, "axisInteraction", "click", {
				active: true,
				coordinate: payload.activeCoordinate,
				dataKey: payload.activeDataKey,
				graphicalItemId: undefined,
				index: payload.activeIndex,
			})
		},
		setSyncInteraction(payload: TooltipSyncState): void {
			setState("tooltip", "syncInteraction", payload)
		},
		addTooltipEntrySettings(payload: TooltipPayloadConfiguration): void {
			markRawData(payload.dataDefinedOnItem)
			setState("tooltip", "tooltipItemPayloads", (prev: ReadonlyArray<TooltipPayloadConfiguration>) => [...prev, payload])
		},

		/* --- zIndex --- */
		registerZIndexPortalElement(payload: {
			element: Element
			isPanorama: boolean
			zIndex: number
		}): void {
			ensureZIndexEntry(setState, payload.zIndex, chart.zIndex.zIndexMap)
			const key = payload.isPanorama ? "panoramaElement" : "element"
			setState("zIndex", "zIndexMap", payload.zIndex, key, payload.element)
		},
		unregisterZIndexPortalElement(payload: { isPanorama: boolean; zIndex: number }): void {
			ensureZIndexEntry(setState, payload.zIndex, chart.zIndex.zIndexMap)
			const key = payload.isPanorama ? "panoramaElement" : "element"
			setState("zIndex", "zIndexMap", payload.zIndex, key, undefined)
		},
		addZIndexLayer(payload: { zIndex: number }): void {
			ensureZIndexEntry(setState, payload.zIndex, chart.zIndex.zIndexMap)
			setState("zIndex", "zIndexMap", payload.zIndex, "consumers", (c: number) => c + 1)
		},
		removeZIndexLayer(payload: { zIndex: number }): void {
			setState(
				"zIndex",
				"zIndexMap",
				payload.zIndex,
				"consumers",
				(c: number) => Math.max(0, c - 1),
			)
		},
		registerZIndexPortal(payload: { zIndex: number }): void {
			const existing = chart.zIndex.zIndexMap[payload.zIndex]
			if (existing) {
				setState("zIndex", "zIndexMap", payload.zIndex, "consumers", existing.consumers + 1)
			} else {
				setState("zIndex", "zIndexMap", payload.zIndex, {
					consumers: 1,
					element: undefined,
					panoramaElement: undefined,
				})
			}
		},
		unregisterZIndexPortal(payload: { zIndex: number }): void {
			const existing = chart.zIndex.zIndexMap[payload.zIndex]
			if (existing) {
				const newConsumers = existing.consumers - 1
				if (newConsumers <= 0 && !isDefaultZIndex(payload.zIndex)) {
					setState("zIndex", "zIndexMap", (prev) => {
						const next = { ...prev }
						delete next[payload.zIndex]
						return next
					})
				} else {
					setState("zIndex", "zIndexMap", payload.zIndex, "consumers", newConsumers)
				}
			}
		},
	}
}

export type ChartActions = ReturnType<typeof createActions>

/* Solid's setStore("zIndex","zIndexMap",N,key,...) crashes when zIndexMap[N]
   is undefined (custom zIndex outside DefaultZIndexes). Pre-seed before nested write. */
function ensureZIndexEntry(
	setState: SetStoreFunction<ChartState>,
	zIndex: number,
	currentMap: ChartState["zIndex"]["zIndexMap"],
): void {
	if (currentMap[zIndex] != null) return
	setState("zIndex", "zIndexMap", zIndex, {
		consumers: 0,
		element: undefined,
		panoramaElement: undefined,
	})
}
