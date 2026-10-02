/* eslint-disable import/no-cycle, sort-keys */
import { createMemo, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { clsx } from "clsx"
import { Dot, type Props as DotProps } from "../shape/Dot"
import { Layer } from "../container/Layer"
import type { DataKey, DotItemDotProps, DotType } from "../util/types"
import { cloneJsxNodeWithProps, isClipDot, isJsxNode } from "../util/ReactUtils"
import { svgPropertiesAndEventsFromUnknown } from "../util/svgPropertiesAndEvents"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

export interface DotPoint {
	readonly x: number | null
	readonly y: number | null
	readonly value?: unknown
	readonly payload?: unknown
}

type DotItemProps = {
	option: DotType
	dotProps: DotItemDotProps
	className: string
}

function DotItem(props: DotItemProps): JSX.Element {
	return <>{renderDotItem(props)}</>
}

/* Runs inside DotItem's JSX expression so every reactive read is tracked. */
function renderDotItem(props: DotItemProps) {
	/* eslint-disable solid/reactivity -- option/dotProps types are structural (stable at mount); conditional branches run once intentionally */
	if (typeof props.option === "function") {
		return (props.option as (p: DotItemDotProps) => JSX.Element)(props.dotProps)
	}
	if (isJsxNode(props.option)) {
		return cloneJsxNodeWithProps(
			props.option,
			props.dotProps as unknown as Record<string, unknown>,
		) as unknown as JSX.Element
	}
	/* eslint-enable solid/reactivity */

	const finalClassName = () => {
		if (typeof props.option === "boolean") {
			return props.className
		}
		const optObj =
			typeof props.option === "object" && props.option != null ? props.option : undefined
		const optClassName = optObj && "className" in optObj ? String(optObj.className) : ""
		return clsx(props.className, optClassName)
	}
	/* eslint-disable-next-line solid/reactivity -- dotProps is stable; destructure captured once for spread into Dot */
	const { points: _p, ...restDotProps } = props.dotProps ?? {}
	return <Dot {...restDotProps} class={finalClassName()} />
}

function shouldRenderDots(points: ReadonlyArray<DotPoint> | undefined, dot: DotType): boolean {
	if (points == null) {
		return false
	}
	if (dot) {
		return true
	}
	return points.length === 1
}

export type DotsDotProps = Omit<
	DotProps,
	"cx" | "cy" | "key" | "index" | "dataKey" | "value" | "payload"
>

interface DotsProps extends ZIndexable {
	/**
	 * Points to render dots for
	 */
	points: ReadonlyArray<DotPoint>
	/**
	 * Dot configuration - boolean, JSX.Element, function, or props object
	 */
	dot: DotType
	/**
	 * Base class name for the dots layer (e.g., 'recharts-area-dots')
	 */
	className: string
	/**
	 * Base class name for individual dot (e.g., 'recharts-area-dot')
	 */
	dotClassName: string
	/**
	 * DataKey for the data
	 */
	dataKey: DataKey<unknown> | undefined
	/**
	 * Base props to spread onto each dot (from parent component).
	 * Except some properties that the Dots component manages itself.
	 */
	baseProps: DotsDotProps
	/**
	 * Whether clipping is needed (cartesian only)
	 */
	needClip?: boolean
	/**
	 * Clip path ID (cartesian only)
	 */
	clipPathId?: string
}

export function Dots(props: DotsProps) {
	const zIndex = () => props.zIndex ?? DefaultZIndexes.scatter
	const clipDot = createMemo(() => isClipDot(props.dot))
	const customDotProps = createMemo(() => svgPropertiesAndEventsFromUnknown(props.dot))
	const layerClipPath = () => {
		if (props.needClip && props.clipPathId != null) {
			return `url(#clipPath-${clipDot() ? "" : "dots-"}${props.clipPathId})`
		}
		return undefined
	}

	return (
		<Show when={shouldRenderDots(props.points, props.dot)}>
			{(() => {
				return (
					<ZIndexLayer zIndex={zIndex()}>
						<Layer class={props.className} clip-path={layerClipPath()}>
							<For each={props.points as DotPoint[]}>
								{(entry, i) => {
									const dotItemProps = (): DotItemDotProps => ({
										r: 3,
										...props.baseProps,
										...customDotProps(),
										index: i(),
										cx: entry.x ?? undefined,
										cy: entry.y ?? undefined,
										dataKey: props.dataKey,
										value: entry.value,
										payload: entry.payload,
										points: props.points,
									})

									return (
										<DotItem
											option={props.dot}
											dotProps={dotItemProps()}
											className={props.dotClassName}
										/>
									)
								}}
							</For>
						</Layer>
					</ZIndexLayer>
				)
			})()}
		</Show>
	)
}
