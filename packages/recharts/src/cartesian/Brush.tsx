/* eslint-disable import/no-cycle, sort-keys */
import { createMemo, createSignal, onCleanup, Show, createEffect, untrack } from 'solid-js';
import type { WithoutRemoveFalse } from "../util/types"
import type { JSX } from '@solidjs/web';
import { clsx } from "clsx"
import { scalePoint } from "victory-vendor/d3-scale"
import range from "es-toolkit/compat/range"
import { Layer } from "../container/Layer"
import { Text } from "../component/Text"
import { getValueByDataKey } from "../util/ChartUtils"
import { isNumber, isNotNil } from "../util/DataUtils"
import { generatePrefixStyle } from "../util/CssPrefixUtils"
import type { DataConsumer, DataKey, Padding } from "../util/types"
import { useChartData, useDataIndex } from "../context/chartDataContext"
import type { BrushStartEndIndex, OnBrushUpdate } from "../context/brushUpdateContext"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/useChartState"
import type { ChartData } from "../state/chartDataSlice"
import type { BrushSettings } from "../state/brushSlice"
import { PanoramaContextProvider } from "../context/PanoramaContext"
import { selectBrushDimensions } from "../state/selectors/brushSelectors"
import { useBrushChartSynchronisation } from "../synchronisation/useChartSynchronisation"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { cloneJsxNodeWithProps, isJsxNode } from "../util/ReactUtils"
import { teardownWrite } from "../state/teardownWrite"

type BrushTravellerType = JSX.Element | ((travellerProps: TravellerProps) => JSX.Element)

type BrushTickFormatter = (value: unknown, index: number) => number | string

interface BrushProps<DataPointType = unknown, DataValueType = unknown> extends DataConsumer<
	DataPointType,
	DataValueType
> {
	x?: number
	y?: number
	dy?: number
	width?: number
	className?: string
	ariaLabel?: string
	/** @defaultValue 40 */
	height?: number
	/** @defaultValue 5 */
	travellerWidth?: number
	traveller?: BrushTravellerType
	/** @defaultValue 1 */
	gap?: number
	padding?: Padding
	startIndex?: number
	endIndex?: number
	tickFormatter?: BrushTickFormatter
	children?: JSX.Element
	onChange?: OnBrushUpdate
	onDragEnd?: OnBrushUpdate
	/** @defaultValue 1000 */
	leaveTimeOut?: number
	/** @defaultValue false */
	alwaysShowText?: boolean
}

export type Props = WithoutRemoveFalse<Omit<JSX.GSVGAttributes<SVGGElement>, "onChange" | "onDragEnd" | "ref">> &
	BrushProps

type InternalProps = WithoutRemoveFalse<Omit<JSX.GSVGAttributes<SVGGElement>, "onChange" | "onDragEnd" | "ref">> &
	RequiresDefaultProps<BrushProps, typeof defaultBrushProps>

type BrushTravellerId = "startX" | "endX"

type TravellerProps = {
	x: number
	y: number
	width: number
	height: number
	stroke?: string
}

function DefaultTraveller(props: TravellerProps) {
	const lineY = () => Math.floor(props.y + props.height / 2) - 1

	return (
		<>
			<rect
				x={props.x}
				y={props.y}
				width={props.width}
				height={props.height}
				fill={props.stroke}
				stroke="none"
			/>
			<line
				x1={props.x + 1}
				y1={lineY()}
				x2={props.x + props.width - 1}
				y2={lineY()}
				fill="none"
				stroke="#fff"
			/>
			<line
				x1={props.x + 1}
				y1={lineY() + 2}
				x2={props.x + props.width - 1}
				y2={lineY() + 2}
				fill="none"
				stroke="#fff"
			/>
		</>
	)
}

/* eslint-disable solid/reactivity -- travellerType/travellerProps reads are structural type checks at component setup; Traveller is called once per mount, not in a reactive context */
function Traveller(props: {
	travellerType: BrushTravellerType | undefined
	travellerProps: TravellerProps
}): JSX.Element {
	return <>{renderTraveller(props)}</>
}

/* Runs inside Traveller's JSX expression so every reactive read is tracked. */
function renderTraveller(props: {
	travellerType: BrushTravellerType | undefined
	travellerProps: TravellerProps
}) {
	if (typeof props.travellerType === "function") {
		return (props.travellerType as (p: TravellerProps) => JSX.Element)(props.travellerProps)
	}
	if (isJsxNode(props.travellerType)) {
		return <>{cloneJsxNodeWithProps(props.travellerType, props.travellerProps as unknown as Record<string, unknown>) as unknown as JSX.Element}</>
	}
	return <DefaultTraveller {...props.travellerProps} />
}
/* eslint-enable solid/reactivity */

function getNameFromUnknown(value: unknown): string | undefined {
	if (
		isNotNil(value) &&
		typeof value === "object" &&
		"name" in (value as Record<string, unknown>) &&
		typeof (value as Record<string, unknown>).name === "string"
	) {
		return (value as Record<string, unknown>).name as string
	}
	return undefined
}

function getAriaLabel(data: ReadonlyArray<unknown>, startIndex: number, endIndex: number) {
	const start = getNameFromUnknown(data[startIndex])
	const end = getNameFromUnknown(data[endIndex])
	return `Min value: ${start}, Max value: ${end}`
}

/* eslint-disable solid/reactivity -- plain utility fn; props parameter is not a Solid reactive proxy at this call site */
function getTextOfTick(props: {
	index: number
	data: ChartData
	dataKey: DataKey<unknown, string | number> | undefined
	tickFormatter: BrushTickFormatter | undefined
}): number | string {
	const text: string | number = getValueByDataKey(
		props.data[props.index],
		props.dataKey,
		props.index,
	)
	return typeof props.tickFormatter === "function" ? props.tickFormatter(text, props.index) : text
}
/* eslint-enable solid/reactivity */

function getIndexInRange(valueRange: number[], x: number) {
	const len = valueRange.length
	let start = 0
	let end = len - 1

	while (end - start > 1) {
		const middle = Math.floor((start + end) / 2)
		const middleValue = valueRange[middle]

		if (middleValue != null && middleValue > x) {
			end = middle
		} else {
			start = middle
		}
	}

	const endValue = valueRange[end]
	return endValue != null && x >= endValue ? end : start
}

function getIndex({
	startX,
	endX,
	scaleValues,
	gap,
	data,
}: {
	startX: number
	endX: number
	scaleValues: number[]
	gap: number
	data: ChartData
}): BrushStartEndIndex {
	const lastIndex = data.length - 1
	const min = Math.min(startX, endX)
	const max = Math.max(startX, endX)
	const minIndex = getIndexInRange(scaleValues, min)
	const maxIndex = getIndexInRange(scaleValues, max)
	return {
		endIndex: maxIndex === lastIndex ? lastIndex : maxIndex - (maxIndex % gap),
		startIndex: minIndex - (minIndex % gap),
	}
}

function Background(props: {
	x: number
	y: number
	width: number
	height: number
	fill: string | undefined
	stroke: string | undefined
}) {
	return (
		<rect
			stroke={props.stroke}
			fill={props.fill}
			x={props.x}
			y={props.y}
			width={props.width}
			height={props.height}
		/>
	)
}

function BrushText(props: {
	startIndex: number
	endIndex: number
	y: number
	height: number
	travellerWidth: number
	stroke: string | undefined
	tickFormatter: BrushTickFormatter | undefined
	dataKey: DataKey<unknown> | undefined
	data: ChartData
	startX: number
	endX: number
}) {
	const offset = 5
	const attrs = () => ({
		fill: props.stroke,
		pointerEvents: "none" as const,
	})

	return (
		<Layer class="recharts-brush-texts">
			<Text
				textAnchor="end"
				verticalAnchor="middle"
				x={Math.min(props.startX, props.endX) - offset}
				y={props.y + props.height / 2}
				{...attrs()}
			>
				{getTextOfTick({
					data: props.data,
					dataKey: props.dataKey,
					index: props.startIndex,
					tickFormatter: props.tickFormatter,
				})}
			</Text>
			<Text
				textAnchor="start"
				verticalAnchor="middle"
				x={Math.max(props.startX, props.endX) + props.travellerWidth + offset}
				y={props.y + props.height / 2}
				{...attrs()}
			>
				{getTextOfTick({
					data: props.data,
					dataKey: props.dataKey,
					index: props.endIndex,
					tickFormatter: props.tickFormatter,
				})}
			</Text>
		</Layer>
	)
}

function Slide(props: {
	y: number
	height: number
	stroke: string | undefined
	travellerWidth: number
	startX: number
	endX: number
	onMouseEnter: (e: MouseEvent | TouchEvent) => void
	onMouseLeave: (e: MouseEvent | TouchEvent) => void
	onMouseDown: (e: MouseEvent | TouchEvent) => void
	onTouchStart: (e: MouseEvent | TouchEvent) => void
}) {
	const x = () => Math.min(props.startX, props.endX) + props.travellerWidth
	const width = () => Math.max(Math.abs(props.endX - props.startX) - props.travellerWidth, 0)

	return (
		<rect
			class="recharts-brush-slide"
			onMouseEnter={(e) => props.onMouseEnter(e)}
			onMouseOver={(e) => props.onMouseEnter(e)}
			onMouseLeave={(e) => props.onMouseLeave(e)}
			onMouseOut={(e) => props.onMouseLeave(e)}
			onMouseDown={(e) => props.onMouseDown(e)}
			onTouchStart={(e) => props.onTouchStart(e)}
			style={{ cursor: "move" }}
			stroke="none"
			fill={props.stroke}
			fill-opacity={0.2}
			x={x()}
			y={props.y}
			width={width()}
			height={props.height}
		/>
	)
}

function Panorama(props: {
	x: number
	y: number
	width: number
	height: number
	data: ChartData
	children: JSX.Element | undefined
	padding: Padding
}) {
	/* In Solid, we cannot use Children.count/Children.only. Instead we pass children directly. */
	return <Show when={props.children != null}>{props.children}</Show>
}

const createScale = ({
	data,
	startIndex,
	endIndex,
	x,
	width,
	travellerWidth,
}: {
	data: ChartData | undefined
	startIndex: number
	endIndex: number
	x: number
	width: number
	travellerWidth: number
}) => {
	if (!data || !data.length) {
		return {}
	}

	const len = data.length
	const scale = scalePoint<number>()
		.domain(range(0, len))
		.range([x, x + width - travellerWidth])
	const scaleValues = scale
		.domain()
		.map((entry) => scale(entry))
		.filter(isNotNil)

	return {
		endX: scale(endIndex),
		scale,
		scaleValues,
		startX: scale(startIndex),
	}
}

/**
 * Brush implemented with Solid signals instead of React class component state.
 */
function BrushWithState(
	props: InternalProps & {
		data: ChartData
		x: number
		y: number
		width: number
		startIndex: number
		endIndex: number
		onChange: OnBrushUpdate
		startIndexControlledFromProps?: number
		endIndexControlledFromProps?: number
	},
) {
	const scaleData = () =>
		createScale({
			data: props.data,
			endIndex: props.endIndex,
			startIndex: props.startIndex,
			travellerWidth: props.travellerWidth,
			width: props.width,
			x: props.x,
		})

	/* Seed traveller positions before first render, like upstream's derived state. */
	const initialScale = untrack(scaleData)
	const [startX, setStartX] = createSignal(initialScale.startX ?? 0)
	const [endX, setEndX] = createSignal(initialScale.endX ?? 0)
	const [isTextActive, setIsTextActive] = createSignal(false)
	const [isSlideMoving, setIsSlideMoving] = createSignal(false)
	const [isTravellerMoving, setIsTravellerMoving] = createSignal(false)
	const [isTravellerFocused, setIsTravellerFocused] = createSignal(false)

	let slideMoveStartX = 0
	let brushMoveStartX = 0
	let movingTravellerId: BrushTravellerId | undefined
	let leaveTimer: number | null = null
	let prevData: ChartData | undefined
	let prevWidth: number | undefined
	let prevX: number | undefined
	let prevTravellerWidth: number | undefined
	let prevStartIndexControlledFromProps: number | undefined
	let prevEndIndexControlledFromProps: number | undefined

	createEffect(
		() => ({
			data: props.data,
			endControlled: props.endIndexControlledFromProps,
			endIndex: props.endIndex,
			interacting: isSlideMoving() || isTravellerMoving() || isTravellerFocused() || isTextActive(),
			startControlled: props.startIndexControlledFromProps,
			startIndex: props.startIndex,
			travellerWidth: props.travellerWidth,
			width: props.width,
			x: props.x,
		}),
		(input) => untrack(() => {
		const { data, endControlled, endIndex, interacting, startControlled, startIndex, travellerWidth, width, x } = input
		const sd = createScale({
			data,
			endIndex,
			startIndex,
			travellerWidth,
			width,
			x,
		})

		if (data !== prevData) {
			prevData = data
			prevWidth = width
			prevX = x
			prevTravellerWidth = travellerWidth
			prevStartIndexControlledFromProps = startControlled
			prevEndIndexControlledFromProps = endControlled
			if (sd.startX != null) setStartX(sd.startX)
			if (sd.endX != null) setEndX(sd.endX)
			return
		}

		if (width !== prevWidth || x !== prevX || travellerWidth !== prevTravellerWidth) {
			prevWidth = width
			prevX = x
			prevTravellerWidth = travellerWidth
			if (sd.startX != null) setStartX(sd.startX)
			if (sd.endX != null) setEndX(sd.endX)
			return
		}

		if (interacting) {
			return
		}

		if (startControlled != null && prevStartIndexControlledFromProps !== startControlled) {
			prevStartIndexControlledFromProps = startControlled
			const next = createScale({
				data,
				endIndex,
				startIndex: startControlled,
				travellerWidth,
				width,
				x,
			})
			if (next.startX != null) setStartX(next.startX)
		}
		if (endControlled != null && prevEndIndexControlledFromProps !== endControlled) {
			prevEndIndexControlledFromProps = endControlled
			const next = createScale({
				data,
				endIndex: endControlled,
				startIndex,
				travellerWidth,
				width,
				x,
			})
			if (next.endX != null) setEndX(next.endX)
		}
		}),
	)

	const detachDragEndListener = () => {
		window.removeEventListener("mouseup", handleDragEnd, true)
		window.removeEventListener("touchend", handleDragEnd, true)
		window.removeEventListener("mousemove", handleDrag, true)
	}

	const attachDragEndListener = () => {
		window.addEventListener("mouseup", handleDragEnd, true)
		window.addEventListener("touchend", handleDragEnd, true)
		window.addEventListener("mousemove", handleDrag, true)
	}

	onCleanup(() => {
		if (leaveTimer) {
			clearTimeout(leaveTimer)
			leaveTimer = null
		}
		detachDragEndListener()
	})

	const handleDragEnd = () => {
		setIsTravellerMoving(false)
		setIsSlideMoving(false)
		props.onDragEnd?.({ endIndex: props.endIndex, startIndex: props.startIndex })
		detachDragEndListener()
	}

	const handleDrag = (e: MouseEvent | TouchEvent) => {
		if (leaveTimer) {
			clearTimeout(leaveTimer)
			leaveTimer = null
		}
		const pageX = "changedTouches" in e ? (e.changedTouches[0]?.pageX ?? 0) : e.pageX
		if (isTravellerMoving()) {
			handleTravellerMove(pageX)
		} else if (isSlideMoving()) {
			handleSlideDrag(pageX)
		}
	}

	const handleSlideDrag = (pageX: number) => {
		const sv = scaleData().scaleValues
		if (sv == null) return
		let delta = pageX - slideMoveStartX

		if (delta > 0) {
			delta = Math.min(
				delta,
				props.x + props.width - props.travellerWidth - endX(),
				props.x + props.width - props.travellerWidth - startX(),
			)
		} else if (delta < 0) {
			delta = Math.max(delta, props.x - startX(), props.x - endX())
		}
		const newIndex = getIndex({
			data: props.data,
			endX: endX() + delta,
			gap: props.gap,
			scaleValues: sv,
			startX: startX() + delta,
		})

		if (newIndex.startIndex !== props.startIndex || newIndex.endIndex !== props.endIndex) {
			props.onChange(newIndex)
		}

		setStartX((prev) => prev + delta)
		setEndX((prev) => prev + delta)
		slideMoveStartX = pageX
	}

	const handleTravellerMove = (pageX: number) => {
		const sv = scaleData().scaleValues
		if (movingTravellerId == null || sv == null) return
		const prevValue = movingTravellerId === "startX" ? startX() : endX()

		let delta = pageX - brushMoveStartX
		if (delta > 0) {
			delta = Math.min(delta, props.x + props.width - props.travellerWidth - prevValue)
		} else if (delta < 0) {
			delta = Math.max(delta, props.x - prevValue)
		}

		const params = {
			data: props.data,
			endX: endX(),
			gap: props.gap,
			scaleValues: sv,
			startX: startX(),
		}
		if (movingTravellerId === "startX") {
			params.startX = prevValue + delta
		} else {
			params.endX = prevValue + delta
		}

		const newIndex = getIndex(params)

		if (movingTravellerId === "startX") {
			setStartX(prevValue + delta)
		} else {
			setEndX(prevValue + delta)
		}
		brushMoveStartX = pageX

		props.onChange(newIndex)
	}

	const handleSlideDragStart = (e: MouseEvent | TouchEvent) => {
		const pageX =
			"changedTouches" in e ? (e.changedTouches[0]?.pageX ?? 0) : (e as MouseEvent).pageX
		setIsTravellerMoving(false)
		setIsSlideMoving(true)
		slideMoveStartX = pageX
		attachDragEndListener()
	}

	const handleTravellerDragStart = (id: BrushTravellerId, e: MouseEvent | TouchEvent) => {
		const pageX =
			"changedTouches" in e ? (e.changedTouches[0]?.pageX ?? 0) : (e as MouseEvent).pageX
		setIsSlideMoving(false)
		setIsTravellerMoving(true)
		movingTravellerId = id
		brushMoveStartX = pageX
		attachDragEndListener()
	}

	const handleTravellerMoveKeyboard = (direction: 1 | -1, id: BrushTravellerId) => {
		const sv = scaleData().scaleValues
		if (sv == null) return

		let currentIndex = -1
		if (id === "startX") currentIndex = props.startIndex
		else if (id === "endX") currentIndex = props.endIndex

		if (currentIndex < 0 || currentIndex >= props.data.length) return

		const newIndex = currentIndex + direction
		if (newIndex === -1 || newIndex >= sv.length) return

		const newScaleValue = sv[newIndex]
		if (newScaleValue == null) return

		if (
			(id === "startX" && newScaleValue >= endX()) ||
			(id === "endX" && newScaleValue <= startX())
		)
			return

		if (id === "startX") setStartX(newScaleValue)
		else setEndX(newScaleValue)

		props.onChange(
			getIndex({
				data: props.data,
				endX: id === "endX" ? newScaleValue : endX(),
				gap: props.gap,
				scaleValues: sv,
				startX: id === "startX" ? newScaleValue : startX(),
			}),
		)
	}

	const handleLeaveWrapper = () => {
		if (isTravellerMoving() || isSlideMoving()) {
			leaveTimer = window.setTimeout(handleDragEnd, props.leaveTimeOut)
		}
	}

	const handleEnterSlideOrTraveller = () => setIsTextActive(true)
	const handleLeaveSlideOrTraveller = () => setIsTextActive(false)
	/* React's onMouseEnter/Leave derive from mouseover/mouseout; a mouseout into one of the
	   traveller's own children is not a leave. */
	const handleOutSlideOrTraveller = (e: MouseEvent) => {
		const next = e.relatedTarget as Node | null
		if (next != null && (e.currentTarget as Element).contains(next)) {
			return
		}
		handleLeaveSlideOrTraveller()
	}

	const calculatedY = () => props.y + (props.dy ?? 0)

	const shouldRender = () =>
		props.data &&
		props.data.length &&
		isNumber(props.x) &&
		isNumber(props.y) &&
		isNumber(props.width) &&
		isNumber(props.height) &&
		props.width > 0 &&
		props.height > 0

	const layerClass = () => clsx("recharts-brush", props.className)
	const style = generatePrefixStyle("userSelect", "none")
	const ariaLabelBrush = () =>
		props.ariaLabel || getAriaLabel(props.data, props.startIndex, props.endIndex)

	const travellerProps = (travellerX: number): TravellerProps => {
		const filteredSvg = svgPropertiesNoEvents(props) as Record<string, unknown>
		const { x: _x, y: _y, width: _w, height: _h, ...rest } = filteredSvg
		return {
			x: Math.max(travellerX, props.x),
			y: calculatedY(),
			width: props.travellerWidth,
			height: props.height,
			...(rest as Record<string, unknown>),
		} as TravellerProps
	}

	return (
		<Show when={shouldRender()}>
			<Layer
				class={layerClass()}
				onMouseLeave={handleLeaveWrapper}
				onTouchMove={(e: TouchEvent) => {
					const touch = e.changedTouches?.[0]
					if (touch != null) handleDrag(e)
				}}
				style={style}
			>
				<Background
					x={props.x}
					y={calculatedY()}
					width={props.width}
					height={props.height}
					fill={props.fill}
					stroke={props.stroke}
				/>
				<PanoramaContextProvider>
					<Panorama
						x={props.x}
						y={calculatedY()}
						width={props.width}
						height={props.height}
						data={props.data}
						padding={props.padding}
					>
						{props.children}
					</Panorama>
				</PanoramaContextProvider>
				<Slide
					y={calculatedY()}
					height={props.height}
					stroke={props.stroke}
					travellerWidth={props.travellerWidth}
					startX={startX()}
					endX={endX()}
					onMouseEnter={handleEnterSlideOrTraveller}
					onMouseLeave={handleLeaveSlideOrTraveller}
					onMouseDown={handleSlideDragStart}
					onTouchStart={handleSlideDragStart}
				/>
				{/* Start traveller */}
				<Layer
					tabindex={0}
					/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no <input>; upstream uses role="slider" on the traveller group */
					role="slider"
					aria-label={ariaLabelBrush()}
					aria-valuemin={0}
					aria-valuemax={props.data.length - 1}
					aria-valuenow={startX()}
					class="recharts-brush-traveller"
					onMouseEnter={handleEnterSlideOrTraveller}
					onMouseOver={handleEnterSlideOrTraveller}
					onMouseLeave={handleLeaveSlideOrTraveller}
					onMouseOut={handleOutSlideOrTraveller}
					onMouseDown={(e: MouseEvent) => handleTravellerDragStart("startX", e)}
					onTouchStart={(e: TouchEvent) => handleTravellerDragStart("startX", e)}
					onKeyDown={(e: KeyboardEvent) => {
						if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return
						e.preventDefault()
						e.stopPropagation()
						handleTravellerMoveKeyboard(e.key === "ArrowRight" ? 1 : -1, "startX")
					}}
					onFocus={() => setIsTravellerFocused(true)}
					onBlur={() => setIsTravellerFocused(false)}
					style={{ cursor: "col-resize" }}
				>
					<Traveller travellerType={props.traveller} travellerProps={travellerProps(startX())} />
				</Layer>
				{/* End traveller */}
				<Layer
					tabindex={0}
					/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no <input>; upstream uses role="slider" on the traveller group */
					role="slider"
					aria-label={ariaLabelBrush()}
					aria-valuemin={0}
					aria-valuemax={props.data.length - 1}
					aria-valuenow={endX()}
					class="recharts-brush-traveller"
					onMouseEnter={handleEnterSlideOrTraveller}
					onMouseOver={handleEnterSlideOrTraveller}
					onMouseLeave={handleLeaveSlideOrTraveller}
					onMouseOut={handleOutSlideOrTraveller}
					onMouseDown={(e: MouseEvent) => handleTravellerDragStart("endX", e)}
					onTouchStart={(e: TouchEvent) => handleTravellerDragStart("endX", e)}
					onKeyDown={(e: KeyboardEvent) => {
						if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return
						e.preventDefault()
						e.stopPropagation()
						handleTravellerMoveKeyboard(e.key === "ArrowRight" ? 1 : -1, "endX")
					}}
					onFocus={() => setIsTravellerFocused(true)}
					onBlur={() => setIsTravellerFocused(false)}
					style={{ cursor: "col-resize" }}
				>
					<Traveller travellerType={props.traveller} travellerProps={travellerProps(endX())} />
				</Layer>
				<Show
					when={
						isTextActive() ||
						isSlideMoving() ||
						isTravellerMoving() ||
						isTravellerFocused() ||
						props.alwaysShowText
					}
				>
					<BrushText
						startIndex={props.startIndex}
						endIndex={props.endIndex}
						y={calculatedY()}
						height={props.height}
						travellerWidth={props.travellerWidth}
						stroke={props.stroke}
						tickFormatter={props.tickFormatter}
						dataKey={props.dataKey}
						data={props.data}
						startX={startX()}
						endX={endX()}
					/>
				</Show>
			</Layer>
		</Show>
	)
}

function BrushInternal(props: InternalProps) {
	const ctx = useChartStore()
	const newCtx = useOptionalChartState()
	/* Memos resolve context at setup, so event handlers can read them later. */
	const chartData = createMemo(() => useChartData())
	const dataIndexes = createMemo(() => useDataIndex())
	const onChangeFromProps = () => props.onChange

	createEffect(
		() => {
			chartData()
			return { endIndex: props.endIndex, startIndex: props.startIndex }
		},
		({ endIndex, startIndex }) => {
			if (startIndex !== undefined) {
				newCtx?.setState("chartData", "dataStartIndex", startIndex)
			}
			if (endIndex !== undefined) {
				newCtx?.setState("chartData", "dataEndIndex", endIndex)
			}
		},
	)

	useBrushChartSynchronisation()

	const onChange = (nextState: BrushStartEndIndex) => {
		const idx = dataIndexes()
		if (idx == null) return
		if (nextState.startIndex !== idx.startIndex || nextState.endIndex !== idx.endIndex) {
			onChangeFromProps()?.(nextState)
			if (nextState.startIndex !== undefined) {
				newCtx?.setState("chartData", "dataStartIndex", nextState.startIndex)
			}
			if (nextState.endIndex !== undefined) {
				newCtx?.setState("chartData", "dataEndIndex", nextState.endIndex)
			}
		}
	}

	/* perf: cache selector result; without memo every consumer read triggers full chain. */
	const brushDimensions = createMemo(() => (ctx ? selectBrushDimensions(ctx.store) : undefined))

	return (
		<Show
			when={
				brushDimensions() != null &&
				dataIndexes() != null &&
				chartData() != null &&
				chartData()?.length
			}
		>
			<BrushWithState
				{...props}
				data={chartData() as ChartData}
				x={brushDimensions()?.x ?? 0}
				y={brushDimensions()?.y ?? 0}
				width={brushDimensions()?.width ?? 0}
				startIndex={dataIndexes()?.startIndex ?? 0}
				endIndex={dataIndexes()?.endIndex ?? 0}
				onChange={onChange}
				startIndexControlledFromProps={props.startIndex ?? undefined}
				endIndexControlledFromProps={props.endIndex ?? undefined}
			/>
		</Show>
	)
}

function BrushSettingsDispatcher(props: BrushSettings): null {
	const newCtx = useOptionalChartState()
	createEffect(
		() => ({ height: props.height, padding: props.padding, width: props.width, x: props.x, y: props.y }),
		(settings) => {
			newCtx?.setState("brush", settings)
			return () => {
				teardownWrite(() => {
					newCtx?.setState("brush", { height: 0, padding: { bottom: 0, left: 0, right: 0, top: 0 }, width: 0, x: 0, y: 0 })
				})
			}
		},
	)
	return null
}

export const defaultBrushProps = {
	alwaysShowText: false,
	fill: "#fff",
	gap: 1,
	height: 40,
	leaveTimeOut: 1000,
	padding: { bottom: 1, left: 1, right: 1, top: 1 },
	stroke: "#666",
	travellerWidth: 5,
} as const satisfies Partial<Props>

/**
 * Renders a scrollbar that allows the user to zoom and pan in the chart along its XAxis.
 * It also allows you to render a small overview of the chart inside the brush that is always visible
 * and shows the full data set so that the user can see where they are zoomed in.
 *
 * If a chart is synchronized with other charts using the `syncId` prop on the chart,
 * the brush will also synchronize the zooming and panning between all synchronized charts.
 *
 * @see {@link https://recharts.github.io/en-US/examples/BrushBarChart/ BarChart with Brush}
 * @see {@link https://recharts.github.io/en-US/examples/SynchronizedLineChart/ Synchronized Brush}
 *
 * @consumes CartesianChartContext
 */
export function Brush(outsideProps: Props) {
	const props = resolveDefaultProps(outsideProps, defaultBrushProps)
	return (
		<>
			<BrushSettingsDispatcher
				height={props.height}
				x={props.x}
				y={props.y}
				width={props.width}
				padding={props.padding}
			/>
			<BrushInternal {...props} />
		</>
	)
}
Brush.displayName = "Brush"
