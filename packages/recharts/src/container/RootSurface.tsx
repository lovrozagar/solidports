/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { createMemo, Show } from "solid-js"
import { useChartHeight, useChartWidth } from "../context/chartLayoutContext"
import { useAccessibilityLayer } from "../context/accessibilityContext"
import { useIsPanorama } from "../context/PanoramaContext"
import { Surface } from "./Surface"
import { useChartStore } from "../state/RechartsStoreContext"
import { selectBrushDimensions } from "../state/selectors/brushSelectors"
import { isPositiveNumber } from "../util/isWellBehavedNumber"
import { AllZIndexPortals } from "../zIndex/ZIndexPortal"

type RootSurfaceProps = {
	children: JSX.Element
	title: string | undefined
	desc: string | undefined
	otherAttributes: Record<string, unknown> | null
	ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
}

const FULL_WIDTH_AND_HEIGHT = {
	display: "block",
	height: "100%",
	/*
	 * display: block is necessary here because the default for an SVG is display: inline,
	 * which in some browsers (Chrome) adds a little bit of extra space above and below the SVG
	 * to make space for the descender of letters like "g" and "y". This throws off the height calculation
	 * and causes the container to grow indefinitely on each render with responsive=true.
	 * Display: block removes that extra space.
	 *
	 * Interestingly, Firefox does not have this problem, but it doesn't hurt to add the style anyway.
	 */
	width: "100%",
}

function MainChartSurface(props: RootSurfaceProps) {
	/* All hooks bare T (GOTCHA-011). Arrow-thunk pattern preserves callsite shape. */
	const width = () => useChartWidth()
	const height = () => useChartHeight()
	const hasAccessibilityLayer = () => useAccessibilityLayer()

	const tabIndex = (): number | undefined => {
		if (props.otherAttributes != null) {
			if (typeof props.otherAttributes.tabIndex === "number") {
				return props.otherAttributes.tabIndex
			}
			return hasAccessibilityLayer() ? 0 : undefined
		}
		return undefined
	}

	const role = (): JSX.HTMLAttributes<HTMLElement>["role"] => {
		if (props.otherAttributes != null) {
			if (typeof props.otherAttributes.role === "string") {
				return props.otherAttributes.role as JSX.HTMLAttributes<HTMLElement>["role"]
			}
			return hasAccessibilityLayer() ? "application" : undefined
		}
		return undefined
	}

	const ready = createMemo(() => isPositiveNumber(width()) && isPositiveNumber(height()))

	return (
		<Show when={ready()}>
			<Surface
				{...props.otherAttributes}
				title={props.title}
				desc={props.desc}
				role={role()}
				tabIndex={tabIndex()}
				width={width() ?? 0}
				height={height() ?? 0}
				style={FULL_WIDTH_AND_HEIGHT}
				ref={props.ref}
			>
				{props.children}
			</Surface>
		</Show>
	)
}

function BrushPanoramaSurface(props: { children: JSX.Element }) {
	const ctx = useChartStore()
	const brushDimensions = () => (ctx ? selectBrushDimensions(ctx.store) : undefined)

	return (
		<Show when={brushDimensions()}>
			{(dims) => (
				<Surface width={dims().width} height={dims().height} x={dims().x} y={dims().y}>
					{props.children}
				</Surface>
			)}
		</Show>
	)
}

export function RootSurface(props: RootSurfaceProps) {
	const isPanorama = useIsPanorama()

	return (
		<Show
			when={isPanorama === false}
			fallback={
				<BrushPanoramaSurface>
					<AllZIndexPortals isPanorama>{props.children}</AllZIndexPortals>
				</BrushPanoramaSurface>
			}
		>
			<MainChartSurface
				ref={props.ref}
				title={props.title}
				desc={props.desc}
				otherAttributes={props.otherAttributes}
			>
				<AllZIndexPortals isPanorama={false}>{props.children}</AllZIndexPortals>
			</MainChartSurface>
		</Show>
	)
}
