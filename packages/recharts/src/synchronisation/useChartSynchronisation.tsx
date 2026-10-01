/* eslint-disable import/no-cycle */
import { batch, createEffect, onCleanup } from "solid-js"
import { useChartStore } from "../state/RechartsStoreContext"
import {
	selectEventEmitter,
	selectSyncId,
	selectSyncMethod,
} from "../state/selectors/rootPropsSelectors"
import { BRUSH_SYNC_EVENT, eventCenter, TOOLTIP_SYNC_EVENT } from "../util/Events"
import type { TooltipIndex, TooltipSyncState } from "../state/tooltipSlice"
import { selectTooltipDataKey } from "../state/selectors/selectors"
import type { Coordinate, TickItem, TooltipEventType } from "../util/types"
import type { TooltipTrigger } from "../chart/types"
import { selectTooltipAxisTicks } from "../state/selectors/tooltipSelectors"
import { selectSynchronisedTooltipState } from "./syncSelectors"
import { selectChartLayout, useViewBox } from "../context/chartLayoutContext"
import { useIsPanorama } from "../context/PanoramaContext"
import { selectChartViewBox } from "../state/selectors/selectChartOffsetInternal"
import {
	selectBrushDimensions,
	selectBrushSettings,
} from "../state/selectors/brushSelectors"
import type { CartesianViewBoxRequired } from "../util/types"
import type { BrushStartEndIndex } from "../context/brushUpdateContext"
import type { ActiveLabel, MouseHandlerDataParam } from "./types"

function useTooltipSyncEventsListener() {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store, setStore } = ctx
	/* Capture isPanorama at owner setup. The listener fires from a non-Solid
	   event bus (no owner on the call stack), so `useContext` inside `useViewBox`
	   would return the default. Read viewBox directly off the captured store
	   instead. Mirrors the original useViewBox body. */
	const isPanorama = useIsPanorama()
	const viewBox = (): CartesianViewBoxRequired | undefined => {
		const rootViewBox = selectChartViewBox(store)
		const brushDimensions = selectBrushDimensions(store)
		const brushPadding = selectBrushSettings(store)?.padding
		if (isPanorama === false || brushDimensions == null || brushPadding == null) {
			return rootViewBox
		}
		return {
			height: brushDimensions.height - brushPadding.top - brushPadding.bottom,
			width: brushDimensions.width - brushPadding.left - brushPadding.right,
			x: brushPadding.left,
			y: brushPadding.top,
		}
	}

	createEffect(() => {
		const mySyncId = selectSyncId(store)
		const myEventEmitter = selectEventEmitter(store)
		const syncMethod = selectSyncMethod(store)
		const tooltipTicks = selectTooltipAxisTicks(store)
		const layout = selectChartLayout(store)

		if (mySyncId == null) {
			/* This chart is not synchronised with any other chart so we don't need to listen for any events. */
			return
		}

		const listener = (
			incomingSyncId: number | string,
			incomingState: TooltipSyncState,
			emitter: symbol,
		) => {
			if (myEventEmitter === emitter) {
				/* We don't want to process events that we sent ourselves. */
				return
			}
			if (mySyncId !== incomingSyncId) {
				/* This event is not for this chart */
				return
			}
			if (syncMethod === "index") {
				const vb = viewBox()
				if (vb && incomingState?.coordinate && incomingState.sourceViewBox) {
					const { x, y, ...otherCoordinateProps } = incomingState.coordinate
					const {
						x: sourceX,
						y: sourceY,
						width: sourceWidth,
						height: sourceHeight,
					} = incomingState.sourceViewBox

					const scaledCoordinate = {
						...otherCoordinateProps,
						x: vb.x + (sourceWidth ? (x - sourceX) / sourceWidth : 0) * vb.width,
						y: vb.y + (sourceHeight ? (y - sourceY) / sourceHeight : 0) * vb.height,
					}

					const syncPayload = { ...incomingState, coordinate: scaledCoordinate }
					setStore("tooltip", "syncInteraction", syncPayload)
				} else {
					setStore("tooltip", "syncInteraction", incomingState)
				}
				return
			}

			if (tooltipTicks == null) {
				/* for the other two sync methods, we need the ticks to be available */
				return
			}

			let activeTick: TickItem | undefined
			if (typeof syncMethod === "function") {
				/*
				 * This is what the data shape in 2.x CategoricalChartState used to look like.
				 * In 3.x we store things differently but let's try to keep the old shape for compatibility.
				 */
				const syncMethodParam: MouseHandlerDataParam = {
					activeCoordinate: incomingState.coordinate,
					activeDataKey: incomingState.dataKey,
					activeIndex: incomingState.index == null ? undefined : Number(incomingState.index),
					activeLabel: incomingState.label,
					activeTooltipIndex: incomingState.index == null ? undefined : Number(incomingState.index),
					isTooltipActive: incomingState.active,
				}
				/* Call a callback function. If there is an application specific algorithm */
				const activeTooltipIndex = syncMethod(tooltipTicks, syncMethodParam)
				activeTick = tooltipTicks[activeTooltipIndex]
			} else if (syncMethod === "value") {
				/* labels are always strings, tick.value might be a string or a number, depending on axis type */
				activeTick = tooltipTicks.find((tick) => String(tick.value) === incomingState.label)
			}

			const { coordinate } = incomingState

			const vbSync = viewBox()
			if (
				activeTick == null ||
				incomingState.active === false ||
				coordinate == null ||
				vbSync == null
			) {
				const deactivatePayload = {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
					label: undefined,
					sourceViewBox: undefined,
				}
				setStore("tooltip", "syncInteraction", deactivatePayload)
				return
			}

			const { x, y } = coordinate
			const validateChartX = Math.min(x, vbSync.x + vbSync.width)
			const validateChartY = Math.min(y, vbSync.y + vbSync.height)
			const activeCoordinate: Coordinate = {
				x: layout === "horizontal" ? activeTick.coordinate : validateChartX,
				y: layout === "horizontal" ? validateChartY : activeTick.coordinate,
			}

			const activePayload = {
				active: incomingState.active,
				coordinate: activeCoordinate,
				dataKey: incomingState.dataKey,
				graphicalItemId: incomingState.graphicalItemId,
				index: String(activeTick.index),
				label: incomingState.label,
				sourceViewBox: incomingState.sourceViewBox,
			}
			setStore("tooltip", "syncInteraction", activePayload)
		}
		eventCenter.on(TOOLTIP_SYNC_EVENT, listener)

		onCleanup(() => {
			eventCenter.off(TOOLTIP_SYNC_EVENT, listener)
		})
	})
}

function useBrushSyncEventsListener() {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store, setStore } = ctx

	createEffect(() => {
		const mySyncId = selectSyncId(store)
		const myEventEmitter = selectEventEmitter(store)

		if (mySyncId == null) {
			/* This chart is not synchronised with any other chart so we don't need to listen for any events. */
			return
		}

		const listener = (
			incomingSyncId: number | string,
			action: BrushStartEndIndex,
			emitter: symbol,
		) => {
			if (myEventEmitter === emitter) {
				/* We don't want to process events that we sent ourselves. */
				return
			}
			if (mySyncId === incomingSyncId) {
				setStore("chartData", "dataStartIndex", action.startIndex)
				setStore("chartData", "dataEndIndex", action.endIndex)
			}
		}
		eventCenter.on(BRUSH_SYNC_EVENT, listener)

		onCleanup(() => {
			eventCenter.off(BRUSH_SYNC_EVENT, listener)
		})
	})
}

/**
 * Will receive synchronisation events from other charts.
 *
 * Reads syncMethod from state and decides how to synchronise the tooltip based on that.
 *
 * @returns void
 */
export function useSynchronisedEventsFromOtherCharts() {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store, setStore } = ctx

	createEffect(() => {
		if (store.options.eventEmitter == null) {
			setStore("options", "eventEmitter", Symbol("rechartsEventEmitter"))
		}
	})

	useTooltipSyncEventsListener()
	useBrushSyncEventsListener()
}

/**
 * Will send events to other charts.
 * If syncId is undefined, no events will be sent.
 *
 * This ignores the syncMethod, because that is set and computed on the receiving end.
 *
 * @param tooltipEventType from Tooltip
 * @param trigger from Tooltip
 * @param activeCoordinate from state
 * @param activeLabel from state
 * @param activeIndex from state
 * @param isTooltipActive from state
 * @returns void
 */
/* Each param is an accessor — reading inside the effect tracks the upstream
   memo, so emit fires whenever finalIsActive / coordinate / index transitions.
   Plain T params would be snapshotted at call time and never refreshed (GOTCHA-002). */
export function useTooltipChartSynchronisation(
	tooltipEventType: () => TooltipEventType | undefined,
	trigger: () => TooltipTrigger,
	activeCoordinate: () => Coordinate | undefined,
	activeLabel: () => ActiveLabel,
	activeIndex: () => TooltipIndex | undefined,
	isTooltipActive: () => boolean,
) {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store } = ctx
	const viewBox = () => useViewBox()

	createEffect(() => {
		const activeDataKey = selectTooltipDataKey(store, tooltipEventType(), trigger())
		const eventEmitterSymbol = selectEventEmitter(store)
		const syncId = selectSyncId(store)
		const tooltipState = selectSynchronisedTooltipState(store)
		const isReceivingSynchronisation = tooltipState?.active

		if (isReceivingSynchronisation) {
			/* Already receiving sync — emitting back would loop. */
			return
		}
		if (syncId == null) {
			return
		}
		if (eventEmitterSymbol == null) {
			return
		}
		const labelValue = activeLabel()
		const idxValue = activeIndex()
		const syncState: TooltipSyncState = {
			active: isTooltipActive(),
			coordinate: activeCoordinate(),
			dataKey: activeDataKey,
			graphicalItemId: undefined,
			index: idxValue ?? null,
			label: typeof labelValue === "number" ? String(labelValue) : labelValue,
			sourceViewBox: viewBox(),
		}
		eventCenter.emit(TOOLTIP_SYNC_EVENT, syncId, syncState, eventEmitterSymbol)
	})
}

export function useBrushChartSynchronisation() {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store } = ctx

	createEffect(() => {
		const syncId = selectSyncId(store)
		const eventEmitterSymbol = selectEventEmitter(store)
		const brushStartIndex = store.chartData.dataStartIndex
		const brushEndIndex = store.chartData.dataEndIndex

		if (
			syncId == null ||
			brushStartIndex == null ||
			brushEndIndex == null ||
			eventEmitterSymbol == null
		) {
			return
		}
		const syncAction: BrushStartEndIndex = { endIndex: brushEndIndex, startIndex: brushStartIndex }
		eventCenter.emit(BRUSH_SYNC_EVENT, syncId, syncAction, eventEmitterSymbol)
	})
}
