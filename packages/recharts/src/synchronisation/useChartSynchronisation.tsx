/* eslint-disable import/no-cycle */
import { createEffect, untrack, createMemo } from 'solid-js';
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
import { selectActiveTooltipGraphicalItemId, selectTooltipAxisTicks } from "../state/selectors/tooltipSelectors"
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

	createEffect(
		() => {
			const mySyncId = selectSyncId(store)
			/* Unsynchronised charts must not track the tooltip ticks (every data point). */
			if (mySyncId == null) {
				return null
			}
			return {
				layout: selectChartLayout(store),
				myEventEmitter: selectEventEmitter(store),
				mySyncId,
				syncMethod: selectSyncMethod(store),
				tooltipTicks: selectTooltipAxisTicks(store),
			}
		},
		(sync) => {
		if (sync == null) {
			/* This chart is not synchronised with any other chart so we don't need to listen for any events. */
			return undefined
		}
		const { layout, myEventEmitter, mySyncId, syncMethod, tooltipTicks } = sync

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

			/*
			 * Handle source chart deactivation (mouseLeave) for ALL sync methods.
			 * This must be checked before any syncMethod-specific logic to ensure
			 * sourceViewBox is cleared, which allows isReceivingSynchronisation
			 * to become false and lets the normal emission flow resume.
			 */
			if (incomingState.active === false) {
				setStore("tooltip", "syncInteraction", {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
					label: undefined,
					sourceViewBox: undefined,
				})
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
			if (coordinate == null || vbSync == null) {
				setStore("tooltip", "syncInteraction", {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
					label: undefined,
					sourceViewBox: undefined,
				})
				return
			}

			if (activeTick == null) {
				/*
				 * The label from the source chart doesn't match any tick in this chart.
				 * This happens when synced charts have different data arrays
				 * (e.g., one chart has 3 data points while another has 252).
				 *
				 * We set active: false so the tooltip hides (correct — no data for this date),
				 * but we keep sourceViewBox set to signal that we're still receiving sync events.
				 * The emission guard in useTooltipChartSynchronisation checks sourceViewBox
				 * (not active) to decide whether to suppress outgoing sync events.
				 * Without this, the chart would emit a counter-sync event with active: false,
				 * cascading to clear tooltips on ALL other synced charts.
				 */
				setStore("tooltip", "syncInteraction", {
					active: false,
					coordinate: undefined,
					dataKey: undefined,
					graphicalItemId: undefined,
					index: null,
					label: undefined,
					sourceViewBox: incomingState.sourceViewBox,
				})
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
		/* Listeners fire inside another chart's effect; they read this chart's current state. */
		const untrackedListener: typeof listener = (...args) => untrack(() => listener(...args))
		eventCenter.on(TOOLTIP_SYNC_EVENT, untrackedListener)

		return () => {
			eventCenter.off(TOOLTIP_SYNC_EVENT, untrackedListener)
		}
		},
	)
}

function useBrushSyncEventsListener() {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store, setStore } = ctx

	createEffect(
		() => ({ myEventEmitter: selectEventEmitter(store), mySyncId: selectSyncId(store) }),
		({ myEventEmitter, mySyncId }) => {
		if (mySyncId == null) {
			/* This chart is not synchronised with any other chart so we don't need to listen for any events. */
			return undefined
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
		/* Listeners fire inside another chart's effect; they read this chart's current state. */
		const untrackedListener: typeof listener = (...args) => untrack(() => listener(...args))
		eventCenter.on(BRUSH_SYNC_EVENT, untrackedListener)

		return () => {
			eventCenter.off(BRUSH_SYNC_EVENT, untrackedListener)
		}
		},
	)
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

	createEffect(
		() => store.options.eventEmitter,
		(eventEmitter) => {
			if (eventEmitter == null) {
				setStore("options", "eventEmitter", Symbol("rechartsEventEmitter"))
			}
		},
	)

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
	const viewBox = createMemo(() => useViewBox())

	createEffect(
		() => {
			const syncId = selectSyncId(store)
			if (syncId == null) {
				return null
			}
			const activeDataKey = selectTooltipDataKey(store, tooltipEventType(), trigger())
			const eventEmitterSymbol = selectEventEmitter(store)
			const tooltipState = selectSynchronisedTooltipState(store)
			/*
			 * Use sourceViewBox (not active) to detect incoming synchronisation. It is set whenever
			 * another chart sends us a sync event, even when our own tooltip stays inactive, so charts
			 * with sparse data do not emit counter-sync events that clear the other tooltips.
			 */
			const isReceivingSynchronisation = tooltipState?.sourceViewBox != null

			if (isReceivingSynchronisation) {
				return null
			}
			if (eventEmitterSymbol == null) {
				return null
			}
			const labelValue = activeLabel()
			const idxValue = activeIndex()
			const syncState: TooltipSyncState = {
				active: isTooltipActive(),
				coordinate: activeCoordinate(),
				dataKey: activeDataKey,
				graphicalItemId: selectActiveTooltipGraphicalItemId(store),
				index: idxValue ?? null,
				label: typeof labelValue === "number" ? String(labelValue) : labelValue,
				sourceViewBox: viewBox(),
			}
			return { eventEmitterSymbol, syncId, syncState }
		},
		(sync) => {
			if (sync != null) {
				eventCenter.emit(TOOLTIP_SYNC_EVENT, sync.syncId, sync.syncState, sync.eventEmitterSymbol)
			}
		},
	)
}

export function useBrushChartSynchronisation() {
	const ctx = useChartStore()
	if (ctx == null) {
		return
	}
	const { store } = ctx

	createEffect(
		() => {
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
				return null
			}
			const syncAction: BrushStartEndIndex = { endIndex: brushEndIndex, startIndex: brushStartIndex }
			return { eventEmitterSymbol, syncAction, syncId }
		},
		(sync) => {
			if (sync != null) {
				eventCenter.emit(BRUSH_SYNC_EVENT, sync.syncId, sync.syncAction, sync.eventEmitterSymbol)
			}
		},
	)
}
