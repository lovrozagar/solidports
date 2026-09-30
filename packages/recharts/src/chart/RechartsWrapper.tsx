/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { batch, createSignal, onCleanup } from "solid-js"
import { clsx } from "clsx"
import { useChartStore } from "../state/RechartsStoreContext"
import { useOptionalChartState } from "../state/_solid/useChartState"
import { useSynchronisedEventsFromOtherCharts } from "../synchronisation/useChartSynchronisation"
import { useReportScale } from "../util/useReportScale"
import type { ExternalMouseEvents } from "./types"
import { TooltipPortalContext } from "../context/tooltipPortalContext"
import { LegendPortalContext } from "../context/legendPortalContext"
import { ReportChartSize } from "../context/chartLayoutContext"
import { useResponsiveContainerContext } from "../component/ResponsiveContainer"
import type { HTMLMousePointer, Percent } from "../util/types"

export type RechartsWrapperProps = ExternalMouseEvents & {
	children: JSX.Element
	width: number | Percent | undefined
	height: number | Percent | undefined
	/**
	 * If true, then it will listen to container size changes and adapt the SVG chart accordingly.
	 * If false, then it renders the chart at the specified width and height and will stay that way
	 * even if the container size changes.
	 */
	responsive: boolean
	class?: string
	style?: JSX.CSSProperties
	ref?: HTMLDivElement | ((el: HTMLDivElement) => void)
	/**
	 * Treemap is special snowflake that handles its own mouse events so
	 * here is a flag to disable the dispatching of mouse events from RechartsWrapper.
	 * If false, then this disables mouse click and touch event dispatching.
	 * Mouse move events are still dispatched because they are needed for tooltip synchronization.
	 * @default true
	 */
	dispatchTouchEvents?: boolean
}

function EventSynchronizer(): null {
	useSynchronisedEventsFromOtherCharts()
	return null
}

/* Solid does not auto-append `px` to numeric inline style values like React does
   for length properties — `height: 200` lands on the DOM as a unitless string and
   browsers ignore it. Mirror React's behavior on length-typed keys. */
const PX_KEYS = new Set([
	"width",
	"height",
	"minWidth",
	"minHeight",
	"maxWidth",
	"maxHeight",
	"top",
	"left",
	"right",
	"bottom",
])
function pxifyStyle(style: JSX.CSSProperties | undefined): JSX.CSSProperties | undefined {
	if (style == null) return style
	let mutated = false
	const out: Record<string, string | number> = {}
	for (const k of Object.keys(style)) {
		const v = (style as Record<string, string | number | undefined>)[k]
		if (v == null) continue
		if (PX_KEYS.has(k) && typeof v === "number") {
			out[k] = `${v}px`
			mutated = true
		} else {
			out[k] = v
		}
	}
	return mutated ? (out as JSX.CSSProperties) : style
}

function getNumberOrZero(value: number | string | undefined): number {
	if (typeof value === "number") {
		return value
	}
	if (typeof value === "string") {
		const parsed = parseFloat(value)
		if (!Number.isNaN(parsed)) {
			return parsed
		}
	}
	return 0
}

type WrapperDivProps = {
	width: number | string | undefined
	height: number | string | undefined
	class?: string
	style?: JSX.CSSProperties
	ref?: HTMLDivElement | ((el: HTMLDivElement) => void)
	onClick?: (e: MouseEvent) => void
	onContextMenu?: (e: MouseEvent) => void
	onDblClick?: (e: MouseEvent) => void
	/* `onFocus`/`onBlur` (focus/blur events) do NOT bubble in the DOM. The
	 * focusable target is the inner `<svg tabindex=0>`, not this wrapper div —
	 * so a focus event on the svg never reaches a div-level `onfocus` listener.
	 * Solid binds events 1:1 with the DOM (no React-style synthetic delegation),
	 * so we listen to `focusin`/`focusout` instead — those bubble. */
	onFocusIn?: () => void
	onFocusOut?: () => void
	onKeyDown?: (e: KeyboardEvent) => void
	onMouseDown?: (e: MouseEvent) => void
	onMouseEnter?: (e: MouseEvent) => void
	onMouseLeave?: (e: MouseEvent) => void
	onMouseMove?: (e: MouseEvent) => void
	/* React's onMouseEnter/Leave were synthetic and fired on mouseover/mouseout too.
	   Solid binds native events 1:1 — mouseenter doesn't fire on fireEvent.mouseOver.
	   Bind both pairs so test helpers that fire mouseOver/mouseOut still trigger
	   the same dispatch path users get from real-browser pointer entry. */
	onMouseOver?: (e: MouseEvent) => void
	onMouseOut?: (e: MouseEvent) => void
	onMouseUp?: (e: MouseEvent) => void
	onTouchEnd?: (e: TouchEvent) => void
	onTouchMove?: (e: TouchEvent) => void
	onTouchStart?: (e: TouchEvent) => void
	children?: JSX.Element
}

function ResponsiveDiv(props: WrapperDivProps) {
	let observerRef: ResizeObserver | null = null

	/* eslint-disable solid/reactivity -- props.style.height/width seed signal once at setup; innerRef is a callback ref (not a signal), used correctly with ref={innerRef} */
	const [sizes, setSizes] = createSignal<{
		containerWidth: number
		containerHeight: number
	}>({
		containerHeight: getNumberOrZero(props.style?.height),
		containerWidth: getNumberOrZero(props.style?.width),
	})
	/* eslint-enable solid/reactivity */

	function setContainerSize(newWidth: number, newHeight: number) {
		const roundedWidth = Math.round(newWidth)
		const roundedHeight = Math.round(newHeight)
		const prev = sizes()
		if (prev.containerWidth === roundedWidth && prev.containerHeight === roundedHeight) {
			return
		}
		setSizes({ containerHeight: roundedHeight, containerWidth: roundedWidth })
	}

	/* eslint-disable-next-line solid/reactivity -- innerRef is a callback ref assigned via ref={innerRef}; linter false-positive on function-as-ref */
	function innerRef(node: HTMLDivElement) {
		if (typeof props.ref === "function") {
			props.ref(node)
		}
		if (typeof ResizeObserver !== "undefined") {
			const { width: containerWidth, height: containerHeight } = node.getBoundingClientRect()
			setContainerSize(containerWidth, containerHeight)
			const callback = (entries: ResizeObserverEntry[]) => {
				const entry = entries[0]
				if (entry == null) {
					return
				}
				const { width, height } = entry.contentRect
				setContainerSize(width, height)
			}
			const observer = new ResizeObserver(callback)
			observer.observe(node)
			observerRef = observer
		}
	}

	onCleanup(() => {
		if (observerRef != null) {
			observerRef.disconnect()
		}
	})

	/* eslint-disable solid/reactivity -- innerRef is a callback ref; ref={fn} is the correct Solid pattern */
	return (
		<>
			<ReportChartSize width={sizes().containerWidth} height={sizes().containerHeight} />
			<div
				ref={innerRef}
				class={props.class}
				style={pxifyStyle(props.style)}
				onClick={(e) => props.onClick?.(e)}
				onContextMenu={(e) => props.onContextMenu?.(e)}
				onDblClick={(e) => props.onDblClick?.(e)}
				onFocusIn={() => props.onFocusIn?.()}
				onFocusOut={() => props.onFocusOut?.()}
				onKeyDown={(e) => props.onKeyDown?.(e)}
				onMouseDown={(e) => props.onMouseDown?.(e)}
				onMouseEnter={(e) => props.onMouseEnter?.(e)}
				onMouseLeave={(e) => props.onMouseLeave?.(e)}
				onMouseMove={(e) => props.onMouseMove?.(e)}
				onMouseOver={(e) => props.onMouseOver?.(e)}
				onMouseOut={(e) => props.onMouseOut?.(e)}
				onMouseUp={(e) => props.onMouseUp?.(e)}
				onTouchEnd={(e) => props.onTouchEnd?.(e)}
				onTouchMove={(e) => props.onTouchMove?.(e)}
				onTouchStart={(e) => props.onTouchStart?.(e)}
			>
				{props.children}
			</div>
		</>
	)
	/* eslint-enable solid/reactivity */
}

function ReadSizeOnceDiv(props: WrapperDivProps) {
	/* eslint-disable solid/reactivity -- props.height/width seed signal once at setup; innerRef is a callback ref */
	const [sizes, setSizes] = createSignal<{
		containerWidth: number
		containerHeight: number
	}>({
		containerHeight: getNumberOrZero(props.height),
		containerWidth: getNumberOrZero(props.width),
	})
	/* eslint-enable solid/reactivity */

	function setContainerSize(newWidth: number, newHeight: number) {
		const roundedWidth = Math.round(newWidth)
		const roundedHeight = Math.round(newHeight)
		const prev = sizes()
		if (prev.containerWidth === roundedWidth && prev.containerHeight === roundedHeight) {
			return
		}
		setSizes({ containerHeight: roundedHeight, containerWidth: roundedWidth })
	}

	/* eslint-disable-next-line solid/reactivity -- callback ref assigned via ref={innerRef}; linter false-positive on function-as-ref */
	function innerRef(node: HTMLDivElement) {
		if (typeof props.ref === "function") {
			props.ref(node)
		}
		const { width: containerWidth, height: containerHeight } = node.getBoundingClientRect()
		setContainerSize(containerWidth, containerHeight)
	}

	/* eslint-disable solid/reactivity -- innerRef is a callback ref; ref={fn} is the correct Solid pattern */
	return (
		<>
			<ReportChartSize width={sizes().containerWidth} height={sizes().containerHeight} />
			<div
				ref={innerRef}
				class={props.class}
				style={pxifyStyle(props.style)}
				onClick={(e) => props.onClick?.(e)}
				onContextMenu={(e) => props.onContextMenu?.(e)}
				onDblClick={(e) => props.onDblClick?.(e)}
				onFocusIn={() => props.onFocusIn?.()}
				onFocusOut={() => props.onFocusOut?.()}
				onKeyDown={(e) => props.onKeyDown?.(e)}
				onMouseDown={(e) => props.onMouseDown?.(e)}
				onMouseEnter={(e) => props.onMouseEnter?.(e)}
				onMouseLeave={(e) => props.onMouseLeave?.(e)}
				onMouseMove={(e) => props.onMouseMove?.(e)}
				onMouseOver={(e) => props.onMouseOver?.(e)}
				onMouseOut={(e) => props.onMouseOut?.(e)}
				onMouseUp={(e) => props.onMouseUp?.(e)}
				onTouchEnd={(e) => props.onTouchEnd?.(e)}
				onTouchMove={(e) => props.onTouchMove?.(e)}
				onTouchStart={(e) => props.onTouchStart?.(e)}
			>
				{props.children}
			</div>
		</>
	)
	/* eslint-enable solid/reactivity */
}

function StaticDiv(props: WrapperDivProps & { width: number; height: number }) {
	return (
		<>
			<ReportChartSize width={props.width} height={props.height} />
			<div
				ref={props.ref}
				class={props.class}
				style={pxifyStyle(props.style)}
				onClick={(e) => props.onClick?.(e)}
				onContextMenu={(e) => props.onContextMenu?.(e)}
				onDblClick={(e) => props.onDblClick?.(e)}
				onFocusIn={() => props.onFocusIn?.()}
				onFocusOut={() => props.onFocusOut?.()}
				onKeyDown={(e) => props.onKeyDown?.(e)}
				onMouseDown={(e) => props.onMouseDown?.(e)}
				onMouseEnter={(e) => props.onMouseEnter?.(e)}
				onMouseLeave={(e) => props.onMouseLeave?.(e)}
				onMouseMove={(e) => props.onMouseMove?.(e)}
				onMouseOver={(e) => props.onMouseOver?.(e)}
				onMouseOut={(e) => props.onMouseOut?.(e)}
				onMouseUp={(e) => props.onMouseUp?.(e)}
				onTouchEnd={(e) => props.onTouchEnd?.(e)}
				onTouchMove={(e) => props.onTouchMove?.(e)}
				onTouchStart={(e) => props.onTouchStart?.(e)}
			>
				{props.children}
			</div>
		</>
	)
}

/* eslint-disable solid/reactivity -- props.width/height type checks are structural guards at component setup; NonResponsiveDiv branches once at mount */
function NonResponsiveDiv(props: WrapperDivProps) {
	/* When width or height are percentages or CSS short names, read size from DOM once */
	if (typeof props.width === "string" || typeof props.height === "string") {
		return <ReadSizeOnceDiv {...props} />
	}
	/* When both are numbers, use them directly */
	if (typeof props.width === "number" && typeof props.height === "number") {
		return <StaticDiv {...props} width={props.width} height={props.height} />
	}
	/* eslint-enable solid/reactivity */
	/* When width/height are undefined, render wrapper div without reporting size */
	return (
		<>
			<ReportChartSize
				width={props.width as number | undefined}
				height={props.height as number | undefined}
			/>
			<div
				ref={props.ref}
				class={props.class}
				style={pxifyStyle(props.style)}
				onClick={(e) => props.onClick?.(e)}
				onContextMenu={(e) => props.onContextMenu?.(e)}
				onDblClick={(e) => props.onDblClick?.(e)}
				onFocusIn={() => props.onFocusIn?.()}
				onFocusOut={() => props.onFocusOut?.()}
				onKeyDown={(e) => props.onKeyDown?.(e)}
				onMouseDown={(e) => props.onMouseDown?.(e)}
				onMouseEnter={(e) => props.onMouseEnter?.(e)}
				onMouseLeave={(e) => props.onMouseLeave?.(e)}
				onMouseMove={(e) => props.onMouseMove?.(e)}
				onMouseOver={(e) => props.onMouseOver?.(e)}
				onMouseOut={(e) => props.onMouseOut?.(e)}
				onMouseUp={(e) => props.onMouseUp?.(e)}
				onTouchEnd={(e) => props.onTouchEnd?.(e)}
				onTouchMove={(e) => props.onTouchMove?.(e)}
				onTouchStart={(e) => props.onTouchStart?.(e)}
			>
				{props.children}
			</div>
		</>
	)
}

function getWrapperDivComponent(responsive: boolean) {
	return responsive ? ResponsiveDiv : NonResponsiveDiv
}

export function RechartsWrapper(props: RechartsWrapperProps) {
	let _containerRef: HTMLDivElement | null = null
	const ctx = useChartStore()
	const newCtx = useOptionalChartState()
	const [tooltipPortal, setTooltipPortal] = createSignal<HTMLElement | null>(null)
	const [legendPortal, setLegendPortal] = createSignal<HTMLElement | null>(null)

	const setScaleRef = useReportScale()

	const responsiveContainerCalculations = useResponsiveContainerContext()
	const width = () =>
		responsiveContainerCalculations.width > 0 ? responsiveContainerCalculations.width : props.width
	const height = () =>
		responsiveContainerCalculations.height > 0
			? responsiveContainerCalculations.height
			: props.height

	function innerRef(node: HTMLDivElement) {
		setScaleRef(node)
		if (typeof props.ref === "function") {
			props.ref(node)
		}
		setTooltipPortal(node)
		setLegendPortal(node)
		_containerRef = node
	}

	function toHTMLMousePointer(e: MouseEvent): HTMLMousePointer {
		return {
			clientX: e.clientX,
			clientY: e.clientY,
			currentTarget: e.currentTarget as HTMLElement,
		}
	}

	/* GOTCHA-016-C: dedupe across native mouseenter + mouseover bindings.
	   Solid binds 1:1; both fire on real entry. Shared flag prevents double-dispatch. */
	let mouseEntered = false

	function myOnClick(e: MouseEvent) {
		ctx?.events.handleMouseClick(toHTMLMousePointer(e))
		ctx?.events.handleExternalEvent(e, props.onClick)
	}

	function myOnMouseEnter(e: MouseEvent) {
		ctx?.events.handleMouseMove(toHTMLMousePointer(e))
		if (!mouseEntered) {
			mouseEntered = true
			ctx?.events.handleExternalEvent(e, props.onMouseEnter)
		}
	}

	function myOnMouseLeave(e: MouseEvent) {
		batch(() => {
			newCtx?.setState("tooltip", "axisInteraction", "hover", "active", false)
			newCtx?.setState("tooltip", "itemInteraction", "hover", "active", false)
			/* Mirror the legacy store so selectTooltipState's legacy-vs-_solid
			   check doesn't see stale active=true from prior mouseMoveAction. */
			ctx?.setStore("tooltip", "axisInteraction", "hover", "active", false)
			ctx?.setStore("tooltip", "itemInteraction", "hover", "active", false)
		})
		if (mouseEntered) {
			mouseEntered = false
			ctx?.events.handleExternalEvent(e, props.onMouseLeave)
		}
	}

	/* React's onMouseEnter wrapped both mouseenter + mouseover under one synthetic
	   event. Solid wires native events 1:1, so test helpers calling fireEvent.mouseOver
	   bypass mouseenter and the tooltip never activates. Bind mouseover to the same
	   dispatch path; handleMouseMove is idempotent on identical pointer state. */
	function myOnMouseOver(e: MouseEvent) {
		ctx?.events.handleMouseMove(toHTMLMousePointer(e))
		/* Mirror native mouseenter -> user onMouseEnter handler dispatch.
		   Dedupe so binding both mouseenter+mouseover doesn't double-fire. */
		if (!mouseEntered) {
			mouseEntered = true
			ctx?.events.handleExternalEvent(e, props.onMouseEnter)
		}
	}

	/* Symmetric pair for mouseLeave. mouseout bubbles from descendants too —
	   only dispatch when the pointer actually leaves the wrapper container,
	   matching mouseleave semantics. */
	function myOnMouseOut(e: MouseEvent) {
		const wrapper = e.currentTarget as HTMLElement
		const next = e.relatedTarget as Node | null
		if (next != null && wrapper.contains(next)) {
			return
		}
		batch(() => {
			newCtx?.setState("tooltip", "axisInteraction", "hover", "active", false)
			newCtx?.setState("tooltip", "itemInteraction", "hover", "active", false)
			/* Mirror legacy — symmetric with mouseMoveAction dual-write. */
			ctx?.setStore("tooltip", "axisInteraction", "hover", "active", false)
			ctx?.setStore("tooltip", "itemInteraction", "hover", "active", false)
		})
		if (mouseEntered) {
			mouseEntered = false
			ctx?.events.handleExternalEvent(e, props.onMouseLeave)
		}
	}

	function myOnMouseMove(e: MouseEvent) {
		ctx?.events.handleMouseMove(toHTMLMousePointer(e))
		ctx?.events.handleExternalEvent(e, props.onMouseMove)
	}

	function onFocusIn() {
		ctx?.events.handleFocus()
	}

	function onFocusOut() {
		ctx?.events.handleBlur()
	}

	function onKeyDown(e: KeyboardEvent) {
		ctx?.events.handleKeyDown(e.key)
	}

	function myOnContextMenu(e: MouseEvent) {
		ctx?.events.handleExternalEvent(e, props.onContextMenu)
	}

	function myOnDoubleClick(e: MouseEvent) {
		ctx?.events.handleExternalEvent(e, props.onDoubleClick)
	}

	function myOnMouseDown(e: MouseEvent) {
		ctx?.events.handleExternalEvent(e, props.onMouseDown)
	}

	function myOnMouseUp(e: MouseEvent) {
		ctx?.events.handleExternalEvent(e, props.onMouseUp)
	}

	function myOnTouchStart(e: TouchEvent) {
		ctx?.events.handleExternalEvent(e, props.onTouchStart)
	}

	/*
	 * onTouchMove is special because it behaves different from mouse events.
	 * Mouse events have 'enter' + 'leave' combo that notify us when the mouse is over
	 * a certain element. Touch events don't have that; touch only gives us
	 * start (finger down), end (finger up) and move (finger moving).
	 * So we need to figure out which element the user is touching
	 * ourselves. Fortunately, there's a convenient method for that:
	 * https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
	 */
	function myOnTouchMove(e: TouchEvent) {
		const dispatchTouchEvents = props.dispatchTouchEvents ?? true
		if (dispatchTouchEvents) {
			ctx?.events.handleTouchMove(e)
		}
		ctx?.events.handleExternalEvent(e, props.onTouchMove)
	}

	function myOnTouchEnd(e: TouchEvent) {
		ctx?.events.handleExternalEvent(e, props.onTouchEnd)
	}

	/* eslint-disable-next-line solid/reactivity -- props.responsive determines wrapper component once at mount; stable structural check */
	const WrapperDiv = getWrapperDivComponent(props.responsive)

	return (
		<TooltipPortalContext.Provider value={tooltipPortal}>
			<LegendPortalContext.Provider value={legendPortal}>
				<WrapperDiv
					width={width() ?? props.style?.width}
					height={height() ?? props.style?.height}
					class={clsx("recharts-wrapper", props.class)}
					style={{
						cursor: "default",
						height:
							typeof height() === "number" ? `${height()}px` : (height() as string | undefined),
						position: "relative",
						width: typeof width() === "number" ? `${width()}px` : (width() as string | undefined),
						...props.style,
					}}
					onClick={myOnClick}
					onContextMenu={myOnContextMenu}
					onDblClick={myOnDoubleClick}
					onFocusIn={onFocusIn}
					onFocusOut={onFocusOut}
					onKeyDown={onKeyDown}
					onMouseDown={myOnMouseDown}
					onMouseEnter={myOnMouseEnter}
					onMouseLeave={myOnMouseLeave}
					onMouseMove={myOnMouseMove}
					onMouseOver={myOnMouseOver}
					onMouseOut={myOnMouseOut}
					onMouseUp={myOnMouseUp}
					onTouchEnd={myOnTouchEnd}
					onTouchMove={myOnTouchMove}
					onTouchStart={myOnTouchStart}
					ref={innerRef}
				>
					<EventSynchronizer />
					{props.children}
				</WrapperDiv>
			</LegendPortalContext.Provider>
		</TooltipPortalContext.Provider>
	)
}
