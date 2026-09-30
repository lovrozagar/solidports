/* eslint-disable import/no-cycle */
import { clsx } from "clsx"
import {
	createContext,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
	useContext,
	type JSX,
} from "solid-js"
import throttle from "es-toolkit/compat/throttle"
import { isNumber, noop } from "../util/DataUtils"
import { warn } from "../util/LogUtils"
import {
	calculateChartDimensions,
	defaultResponsiveContainerProps,
	getDefaultWidthAndHeight,
	getInnerDivStyle,
} from "./responsiveContainerUtils"
import type { Percent, Size } from "../util/types"
import { isPositiveNumber } from "../util/isWellBehavedNumber"

export interface Props {
	/**
	 * width / height. If specified, the height will be calculated by width / aspect.
	 */
	aspect?: number
	/**
	 * The width of chart container.
	 * Can be a number or a percent string like "100%".
	 * @default '100%'
	 */
	width?: Percent | number
	/**
	 * The height of chart container.
	 * Can be a number or a percent string like "100%".
	 * @default '100%'
	 */
	height?: Percent | number
	/**
	 * The minimum width of the container.
	 * @default 0
	 */
	minWidth?: string | number
	/**
	 * The minimum height of the container.
	 */
	minHeight?: string | number
	/**
	 * The initial width and height of the container.
	 * @default {"width":-1,"height":-1}
	 */
	initialDimension?: {
		width: number
		height: number
	}
	/** The maximum height of the container. It can be a number. */
	maxHeight?: number
	/**
	 * The content of the container.
	 * It can contain multiple charts, and then they will all share the same dimensions.
	 */
	children: JSX.Element
	/**
	 * If specified a positive number, debounced function will be used to handle the resize event.
	 * @default 0
	 */
	debounce?: number
	/**
	 * Unique identifier of this component.
	 * Used as an HTML attribute `id`.
	 */
	id?: string | number
	/** The HTML element's class name */
	className?: string | number
	/** The style of the container. */
	style?: JSX.CSSProperties
	/**
	 * If specified provides a callback providing the updated chart width and height values.
	 */
	onResize?: (width: number, height: number) => void
	/**
	 * Ref callback for the container div.
	 */
	ref?: (el: HTMLDivElement) => void
}

const ResponsiveContainerContext = createContext<Size>(
	defaultResponsiveContainerProps.initialDimension,
)

function isAcceptableSize(size: {
	width: number | undefined
	height: number | undefined
}): size is Size {
	return isPositiveNumber(size.width) && isPositiveNumber(size.height)
}

function ResponsiveContainerContextProvider(props: {
	children: JSX.Element
	width: number | undefined
	height: number | undefined
}) {
	const size = createMemo(() => ({ height: props.height, width: props.width }))
	/* Solid context value is captured once at JSX time; reactive getters expose live size to consumers that destructure or read fields multiple times. */
	const reactiveSize: Size = {
		get height() {
			return (size().height ?? -1) as number
		},
		get width() {
			return (size().width ?? -1) as number
		},
	}
	return (
		<Show when={isAcceptableSize(size())} fallback={null}>
			<ResponsiveContainerContext.Provider value={reactiveSize}>
				{props.children}
			</ResponsiveContainerContext.Provider>
		</Show>
	)
}

export const useResponsiveContainerContext = () => useContext(ResponsiveContainerContext)

function SizeDetectorContainer(props: Props) {
	let containerRef: HTMLDivElement | undefined

	const aspect = () => props.aspect
	const initialDimension = () =>
		props.initialDimension ?? defaultResponsiveContainerProps.initialDimension
	const width = () => props.width
	const height = () => props.height
	const minWidth = () => props.minWidth ?? defaultResponsiveContainerProps.minWidth
	const minHeight = () => props.minHeight
	const maxHeight = () => props.maxHeight
	const debounce = () => props.debounce ?? defaultResponsiveContainerProps.debounce

	const [sizes, setSizes] = createSignal({
		containerHeight: initialDimension().height,
		containerWidth: initialDimension().width,
	})

	const setContainerSize = (newWidth: number, newHeight: number) => {
		const roundedWidth = Math.round(newWidth)
		const roundedHeight = Math.round(newHeight)
		setSizes((prevState) => {
			if (
				prevState.containerWidth === roundedWidth &&
				prevState.containerHeight === roundedHeight
			) {
				return prevState
			}
			return { containerHeight: roundedHeight, containerWidth: roundedWidth }
		})
	}

	createEffect(() => {
		if (containerRef == null || typeof ResizeObserver === "undefined") {
			return noop
		}
		let callback = (entries: ResizeObserverEntry[]) => {
			const entry = entries[0]
			if (entry == null) {
				return
			}
			const { width: containerWidth, height: containerHeight } = entry.contentRect
			setContainerSize(containerWidth, containerHeight)
			props.onResize?.(containerWidth, containerHeight)
		}
		if (debounce() > 0) {
			/* eslint-disable-next-line solid/reactivity -- callback is a local let, not a reactive signal; reassignment inside createEffect is safe */
			callback = throttle(callback, debounce(), {
				leading: false,
				trailing: true,
			})
		}
		const observer = new ResizeObserver(callback)

		const { width: containerWidth, height: containerHeight } = containerRef.getBoundingClientRect()
		setContainerSize(containerWidth, containerHeight)

		observer.observe(containerRef)

		onCleanup(() => {
			observer.disconnect()
		})
	})

	const containerWidth = () => sizes().containerWidth
	const containerHeight = () => sizes().containerHeight

	/* eslint-disable-next-line solid/reactivity -- dev-only validation call at setup; stale warn on aspect change is acceptable */
	warn(!aspect() || (aspect() ?? 0) > 0, "The aspect(%s) must be greater than zero.", aspect())

	const dimensions = createMemo(() =>
		calculateChartDimensions(containerWidth(), containerHeight(), {
			aspect: aspect(),
			height: height(),
			maxHeight: maxHeight(),
			width: width(),
		}),
	)

	const calculatedWidth = () => dimensions().calculatedWidth
	const calculatedHeight = () => dimensions().calculatedHeight

	/* Skip warn until initial -1 placeholder has been replaced by a real measurement.
	   React useState defers component-body-warn until after first useEffect runs;
	   Solid runs the body sync so we'd otherwise emit on every chart's first paint. */
	createEffect(() => {
		if (containerWidth() === -1 && containerHeight() === -1) return
		warn(
			(calculatedWidth() != null && (calculatedWidth() ?? 0) > 0) ||
				(calculatedHeight() != null && (calculatedHeight() ?? 0) > 0),
			`The width(%s) and height(%s) of chart should be greater than 0,
       please check the style of container, or the props width(%s) and height(%s),
       or add a minWidth(%s) or minHeight(%s) or use aspect(%s) to control the
       height and width.`,
			calculatedWidth(),
			calculatedHeight(),
			width(),
			height(),
			minWidth(),
			minHeight(),
			aspect(),
		)
	})

	return (
		<div
			id={props.id ? `${props.id}` : undefined}
			class={clsx("recharts-responsive-container", props.className)}
			style={{
				...props.style,
				height: typeof height() === "number" ? `${height()}px` : (height() as string | undefined),
				"max-height": maxHeight() ? `${maxHeight()}px` : undefined,
				"min-height":
					typeof minHeight() === "number"
						? `${minHeight()}px`
						: (minHeight() as string | undefined),
				"min-width":
					typeof minWidth() === "number" ? `${minWidth()}px` : (minWidth() as string | undefined),
				width: typeof width() === "number" ? `${width()}px` : (width() as string | undefined),
			}}
			ref={(el) => {
				containerRef = el
				if (typeof props.ref === "function") {
					props.ref(el)
				}
			}}
		>
			<div style={getInnerDivStyle({ height: height(), width: width() })}>
				<ResponsiveContainerContextProvider width={calculatedWidth()} height={calculatedHeight()}>
					{props.children}
				</ResponsiveContainerContextProvider>
			</div>
		</div>
	)
}

/**
 * The `ResponsiveContainer` component is a container that adjusts its width and height based on the size of its parent element.
 * It is used to create responsive charts that adapt to different screen sizes.
 *
 * This component uses the {@link https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver ResizeObserver} API to monitor changes to the size of its parent element.
 * If you need to support older browsers that do not support this API, you may need to include a polyfill.
 *
 * @see {@link https://recharts.github.io/en-US/guide/sizes/ Chart size guide}
 *
 * @provides ResponsiveContainerContext
 */
export function ResponsiveContainer(props: Props) {
	const responsiveContainerContext = useResponsiveContainerContext()
	if (
		isPositiveNumber(responsiveContainerContext.width) &&
		isPositiveNumber(responsiveContainerContext.height)
	) {
		/*
		 * If we detect that we are already inside another ResponsiveContainer,
		 * we do not attempt to add another layer of responsiveness.
		 */
		return <>{props.children}</>
	}

	/* eslint-disable solid/reactivity -- initial sizing pass; these pure-fn results are fixed at mount (ResponsiveContainer design intent) */
	const { width, height } = getDefaultWidthAndHeight({
		aspect: props.aspect,
		height: props.height,
		width: props.width,
	})

	/*
	 * Let's try to get the calculated dimensions without having the div container set up.
	 * Sometimes this does produce fixed, positive dimensions. If so, we can skip rendering the div and monitoring its size.
	 */
	const { calculatedWidth, calculatedHeight } = calculateChartDimensions(undefined, undefined, {
		aspect: props.aspect,
		height,
		maxHeight: props.maxHeight,
		width,
	})
	/* eslint-enable solid/reactivity */

	if (isNumber(calculatedWidth) && isNumber(calculatedHeight)) {
		/*
		 * If it just so happens that the combination of width, height, and aspect ratio
		 * results in fixed dimensions, then we don't need to monitor the container's size.
		 * We can just provide these fixed dimensions to the context.
		 *
		 * Note that here we are not checking for positive numbers;
		 * if the user provides a zero or negative width/height, we will just pass that along
		 * as whatever size we detect won't be helping anyway.
		 */
		return (
			<ResponsiveContainerContextProvider width={calculatedWidth} height={calculatedHeight}>
				{props.children}
			</ResponsiveContainerContextProvider>
		)
	}
	/*
	 * Static analysis did not produce fixed dimensions,
	 * so we need to render a special div and monitor its size.
	 */
	return <SizeDetectorContainer {...props} width={width} height={height} />
}
