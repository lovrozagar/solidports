/* eslint-disable import/no-cycle, sort-keys */
import { createEffect, onCleanup, Show, type JSX } from "solid-js"
import { BarePortal } from "../util/BarePortal"
import { useLegendPortal } from "../context/legendPortalContext"
import {
	type ContentType,
	DefaultLegendContent,
	type LegendPayload,
	type Props as DefaultLegendContentProps,
	type VerticalAlignmentType,
} from "./DefaultLegendContent"

import type { LayoutType, Margin, Size } from "../util/types"
import { getUniqPayload, type UniqueOption } from "../util/payload/getUniqPayload"
import { useLegendPayload } from "../context/legendPayloadContext"
import { type ElementOffset, useElementOffset } from "../util/useElementOffset"
import { useChartHeight, useChartWidth, useMargin } from "../context/chartLayoutContext"
import type { LegendSettings } from "../state/legendSlice"
import { useOptionalChartState } from "../state/useChartState"
import { resolveDefaultProps } from "../util/resolveDefaultProps"

function defaultUniqBy(entry: LegendPayload) {
	return entry.value
}

type ContentProps = Props & {
	margin: Margin | undefined
	chartWidth: number
	chartHeight: number
	contextPayload: ReadonlyArray<LegendPayload>
}

function LegendContent(props: ContentProps) {
	const finalPayload = () =>
		getUniqPayload(props.contextPayload, props.payloadUniqBy, defaultUniqBy)

	/* eslint-disable solid/reactivity -- content type is structural (stable); user render-fn receives snapshot — reactive updates flow via parent re-render */
	if (typeof props.content === "function") {
		/* user-supplied render fn — pass full props + resolved payload */
		const contentFn = props.content as (p: Props) => JSX.Element
		return contentFn(Object.assign({}, props, { payload: finalPayload() }) as Props)
	}

	if (props.content != null) {
		return props.content as JSX.Element
	}
	/* eslint-enable solid/reactivity */

	return <DefaultLegendContent {...props} payload={finalPayload()} />
}

type PositionInput = {
	layout?: Props["layout"]
	align?: Props["align"]
	verticalAlign?: Props["verticalAlign"]
}

/* CSS strings — Solid (DOM `style.x = val`) silently drops unit-less numbers for
   length properties (`left: 5` is invalid CSS, only `left: 5px` is). Upstream React
   inferred `px` from numeric style values; Solid does not. */
function px(n: number): string {
	return `${n}px`
}

/* Solid serializes JSX style props verbatim — `backgroundColor: "red"` becomes the
   literal attribute `backgroundColor:red`, not `background-color: red`. Upstream React
   normalized to kebab-case; the port must mirror that for `wrapperStyle` since the
   public API accepts React-style camelCase keys. */
function kebabizeKey(key: string): string {
	return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function kebabizeStyle(style: JSX.CSSProperties | undefined): Record<string, string | number> {
	if (style == null) {
		return {}
	}
	const out: Record<string, string | number> = {}
	for (const key of Object.keys(style)) {
		const v = (style as Record<string, string | number | undefined>)[key]
		if (v == null) continue
		out[kebabizeKey(key)] = v
	}
	return out
}

function getDefaultPosition(
	style: JSX.CSSProperties | undefined,
	positionProps: PositionInput,
	margin: Margin | undefined,
	chartWidth: number,
	chartHeight: number,
	box: ElementOffset,
) {
	const { layout, align, verticalAlign } = positionProps
	let hPos: Record<string, string> | undefined
	let vPos: Record<string, string> | undefined

	if (
		!style ||
		((style.left === undefined || style.left === null) &&
			(style.right === undefined || style.right === null))
	) {
		if (align === "center" && layout === "vertical") {
			hPos = { left: px(((chartWidth || 0) - box.width) / 2) }
		} else {
			hPos =
				align === "right"
					? { right: px((margin && margin.right) || 0) }
					: { left: px((margin && margin.left) || 0) }
		}
	}

	if (
		!style ||
		((style.top === undefined || style.top === null) &&
			(style.bottom === undefined || style.bottom === null))
	) {
		if (verticalAlign === "middle") {
			vPos = { top: px(((chartHeight || 0) - box.height) / 2) }
		} else {
			vPos =
				verticalAlign === "bottom"
					? { bottom: px((margin && margin.bottom) || 0) }
					: { top: px((margin && margin.top) || 0) }
		}
	}

	return { ...hPos, ...vPos }
}

export type LegendItemSorter = "value" | "dataKey" | ((item: LegendPayload) => number | string)

export type Props = Omit<DefaultLegendContentProps, "payload" | "ref" | "verticalAlign"> & {
	/**
	 * Renders the content of the legend.
	 *
	 * This should return HTML elements, not SVG elements.
	 *
	 * - If not set, the {@link DefaultLegendContent} component is used.
	 * - If set to a JSX element, that element will be rendered.
	 * - If set to a function, the function will be called and should return HTML elements.
	 *
	 * @example <Legend content={CustomizedLegend} />
	 * @example <Legend content={renderLegend} />
	 */
	content?: ContentType
	/**
	 * CSS styles to be applied to the wrapper `div` element.
	 */
	wrapperStyle?: JSX.CSSProperties
	/**
	 * Width of the legend.
	 * Accept CSS style string values like `100%` or `fit-content`, or number values like `400`.
	 */
	width?: number | string
	/**
	 * Height of the legend.
	 * Accept CSS style string values like `100%` or `fit-content`, or number values like `400`.
	 */
	height?: number | string
	payloadUniqBy?: UniqueOption<LegendPayload>
	onBBoxUpdate?: (box: ElementOffset | null) => void
	/**
	 * If portal is defined, then Legend will use this element as a target
	 * for rendering using Solid Portal.
	 *
	 * If this is undefined then Legend renders inside the recharts-wrapper element.
	 */
	portal?: HTMLElement | null
	/**
	 * Sorts Legend items. Defaults to `value` which means it will sort alphabetically
	 * by the label.
	 *
	 * If `null` is provided then the payload is not sorted. Be aware that without sort,
	 * the order of items may change between renders!
	 *
	 * @defaultValue value
	 */
	itemSorter?: LegendItemSorter | null
	/**
	 * The alignment of the whole Legend container:
	 *
	 * - `bottom`: shows the Legend below chart, and chart height reduces automatically to make space for it.
	 * - `top`: shows the Legend above chart, and chart height reduces automatically.
	 * - `middle`:  shows the Legend in the middle of chart, covering other content, and chart height remains unchanged.
	 * The exact behavior changes depending on `align` prop.
	 *
	 * @defaultValue bottom
	 */
	verticalAlign?: VerticalAlignmentType
}

function LegendSettingsDispatcher(props: LegendSettings): null {
	const newCtx = useOptionalChartState()
	createEffect(() => {
		const s = { align: props.align, itemSorter: props.itemSorter, layout: props.layout, verticalAlign: props.verticalAlign }
		newCtx?.setState("legend", "settings", s)
	})
	return null
}

function LegendSizeDispatcher(props: Size): null {
	const newCtx = useOptionalChartState()
	createEffect(() => {
		const s = { height: props.height, width: props.width }
		newCtx?.setState("legend", "size", s)
		onCleanup(() => {
			newCtx?.setState("legend", "size", { height: 0, width: 0 })
		})
	})
	return null
}

function getWidthOrHeight(
	layout: LayoutType | undefined,
	height: number | string | undefined,
	width: number | string | undefined,
	maxWidth: number,
): null | { height?: number | string; width?: number | string } {
	if (layout === "vertical" && height != null) {
		return {
			height,
		}
	}
	if (layout === "horizontal") {
		return {
			width: width || maxWidth,
		}
	}

	return null
}

export const legendDefaultProps = {
	align: "center",
	iconSize: 14,
	inactiveColor: "#ccc",
	itemSorter: "value",
	layout: "horizontal",
	verticalAlign: "bottom",
} as const satisfies Partial<Props>

/**
 * @consumes CartesianChartContext
 * @consumes PolarChartContext
 */
export function Legend(outsideProps: Props) {
	const props = resolveDefaultProps(outsideProps, legendDefaultProps)
	/* All non-portal hooks bare T (GOTCHA-011). Arrow-thunk pattern keeps
	   `()` callsites valid; legendPortalFromContext stays Accessor (portal context). */
	/* legacy useLegendPayload() goes through selectLegendPayload which applies itemSorter */
	/* — keep this path until Phase 6 hooks port unifies the merge semantics */
	const contextPayload = () => useLegendPayload()
	const legendPortalFromContext = useLegendPortal()
	const margin = () => useMargin()
	const [lastBoundingBox, updateBoundingBox] = useElementOffset(() => [contextPayload()])
	const chartWidth = () => useChartWidth()
	const chartHeight = () => useChartHeight()

	return (
		<Show
			when={
				chartWidth() != null &&
				chartHeight() != null &&
				(props.portal ?? legendPortalFromContext()) != null &&
				contextPayload() != null
			}
		>
			{(() => {
				const cw = () => chartWidth() ?? 0
				const ch = () => chartHeight() ?? 0
				const maxWidth = () => cw() - (margin()?.left || 0) - (margin()?.right || 0)
				const widthOrHeight = () =>
					getWidthOrHeight(props.layout, props.height, props.width, maxWidth())
				const legendPortal = () => props.portal ?? legendPortalFromContext()

				/* if the user supplies their own portal, only use their defined wrapper styles */
				const outerStyle = (): JSX.CSSProperties => {
					if (props.portal) {
						return kebabizeStyle(props.wrapperStyle) as JSX.CSSProperties
					}
					const wh = widthOrHeight()
					let heightPx: string
					if (wh?.height) {
						heightPx = `${wh.height}px`
					} else if (props.height) {
						heightPx = `${props.height}px`
					} else {
						heightPx = "auto"
					}
					let widthPx: string
					if (wh?.width) {
						widthPx = `${wh.width}px`
					} else if (props.width) {
						widthPx = `${props.width}px`
					} else {
						widthPx = "auto"
					}
					/* Property order is load-bearing — upstream React asserts the inline
					   style attribute string verbatim. Solid serializes CSS in insertion
					   order, so position → width → height → defaults → user must match. */
					return {
						position: "absolute",
						width: widthPx,
						height: heightPx,
						...getDefaultPosition(
							props.wrapperStyle,
							props,
							margin(),
							cw(),
							ch(),
							lastBoundingBox(),
						),
						...kebabizeStyle(props.wrapperStyle),
					}
				}

				return (
					<BarePortal mount={legendPortal() ?? undefined}>
						<div class="recharts-legend-wrapper" style={outerStyle()} ref={updateBoundingBox}>
							<LegendSettingsDispatcher
								layout={props.layout}
								align={props.align}
								verticalAlign={props.verticalAlign}
								itemSorter={props.itemSorter}
							/>
							<Show when={!props.portal}>
								<LegendSizeDispatcher
									width={lastBoundingBox().width}
									height={lastBoundingBox().height}
								/>
							</Show>
							<LegendContent
								{...props}
								{...widthOrHeight()}
								margin={margin()}
								chartWidth={cw()}
								chartHeight={ch()}
								contextPayload={contextPayload() ?? []}
							/>
						</div>
					</BarePortal>
				)
			})()}
		</Show>
	)
}

Legend.displayName = "Legend"
