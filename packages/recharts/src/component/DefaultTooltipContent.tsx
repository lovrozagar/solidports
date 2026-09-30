/* eslint-disable import/no-cycle */
/**
 * @fileOverview Default Tooltip Content
 */

import { For, Show, type JSX } from "solid-js"
import sortBy from "es-toolkit/compat/sortBy"
import { clsx } from "clsx"
import { isNullish, isNumOrStr } from "../util/DataUtils"
import type { DataKey } from "../util/types"
import type { TooltipPayload, TooltipPayloadEntry } from "../state/tooltipSlice"

function defaultFormatter(value: ValueType | undefined): string | ValueType | undefined {
	return Array.isArray(value) && isNumOrStr(value[0]) && isNumOrStr(value[1])
		? value.join(" ~ ")
		: value
}

export type TooltipType = "none"
export type ValueType = number | string | ReadonlyArray<number | string>
export type NameType = number | string
export type Formatter<TValue extends ValueType = ValueType, TName extends NameType = NameType> = (
	value: TValue | undefined,
	name: TName | undefined,
	item: Payload<TValue, TName>,
	index: number,
	payload: ReadonlyArray<Payload<TValue, TName>>,
) => [JSX.Element, TName] | JSX.Element

export interface Payload<TValue extends ValueType = ValueType, TName extends NameType = NameType> {
	type?: TooltipType
	color?: string
	formatter?: Formatter<TValue, TName>
	name?: TName
	value?: TValue
	unit?: JSX.Element
	fill?: string
	dataKey?: DataKey<unknown>
	nameKey?: DataKey<unknown>
	payload?: unknown
	chartType?: string
	stroke?: string
	strokeDasharray?: string | number
	strokeWidth?: number | string
	className?: string
	hide?: boolean
	/**
	 * The id of the graphical item that the data point belongs to
	 */
	graphicalItemId: string
}

/**
 * @inline
 */
export type TooltipItemSorter<
	TValue extends ValueType = ValueType,
	TName extends NameType = NameType,
> = "dataKey" | "value" | "name" | ((item: Payload<TValue, TName>) => number | string | undefined)

export interface Props<TValue extends ValueType = ValueType, TName extends NameType = NameType> {
	separator?: string
	wrapperClassName?: string
	labelClassName?: string
	formatter?: Formatter<TValue, TName>
	contentStyle?: JSX.CSSProperties
	itemStyle?: JSX.CSSProperties
	labelStyle?: JSX.CSSProperties
	labelFormatter?: (
		label: JSX.Element,
		payload: ReadonlyArray<Payload<TValue, TName>>,
	) => JSX.Element
	label?: JSX.Element
	payload?: ReadonlyArray<Payload<TValue, TName>>
	itemSorter?: TooltipItemSorter<TValue, TName>
	accessibilityLayer?: boolean
}

export const defaultDefaultTooltipContentProps = {
	accessibilityLayer: false,
	contentStyle: {
		"background-color": "#fff",
		border: "1px solid #ccc",
		margin: 0,
		padding: "10px",
		"white-space": "nowrap",
	},
	itemStyle: {
		color: "#000",
		display: "block",
		"padding-bottom": "4px",
		"padding-top": "4px",
	},
	labelStyle: {},
	separator: " : ",
} as const satisfies Partial<Props>

function lodashLikeSortBy<T>(
	array: ReadonlyArray<T>,
	itemSorter: TooltipItemSorter | undefined,
): ReadonlyArray<T> {
	if (itemSorter == null) {
		return array
	}
	return sortBy(array, itemSorter as (item: T) => string | number | undefined)
}

/**
 * This component is by default rendered inside the {@link Tooltip} component. You would not use it directly.
 *
 * You can use this component to customize the content of the tooltip,
 * or you can provide your own completely independent content.
 */
export const DefaultTooltipContent = (props: Props): JSX.Element | null => {
	const separator = () => props.separator ?? defaultDefaultTooltipContentProps.separator
	const labelStyle = () => props.labelStyle ?? defaultDefaultTooltipContentProps.labelStyle
	const accessibilityLayer = () =>
		props.accessibilityLayer ?? defaultDefaultTooltipContentProps.accessibilityLayer

	const renderContent = (): JSX.Element | null => {
		if (props.payload && props.payload.length) {
			const listStyle: JSX.CSSProperties = { margin: 0, padding: 0 }

			const sortedPayload: TooltipPayload = lodashLikeSortBy(props.payload, props.itemSorter)

			return (
				<ul class="recharts-tooltip-item-list" style={listStyle}>
					<For each={sortedPayload as TooltipPayloadEntry[]}>
						{(entry, i) => {
							if (entry.type === "none") {
								return null
							}

							const finalFormatter = entry.formatter ?? props.formatter ?? defaultFormatter
							const { value, name } = entry
							/* formatter can return string/number/ReactElement — JSX slot accepts all */
							let finalValue: unknown = value
							let finalName: unknown = name
							if (finalFormatter) {
								/* eslint-disable-next-line solid/reactivity -- i() is the <For> index accessor; this callback IS a tracked scope */
								const formatted = finalFormatter(value, name, entry, i(), props.payload ?? [])
								if (Array.isArray(formatted)) {
									;[finalValue, finalName] = formatted
								} else if (formatted != null) {
									finalValue = formatted
								} else {
									return null
								}
							}

							const finalItemStyle = (): JSX.CSSProperties => ({
								...defaultDefaultTooltipContentProps.itemStyle,
								color: entry.color || defaultDefaultTooltipContentProps.itemStyle.color,
								...props.itemStyle,
							})

							return (
								<li class="recharts-tooltip-item" style={finalItemStyle()}>
									<Show when={isNumOrStr(finalName)}>
										<span class="recharts-tooltip-item-name">{finalName as JSX.Element}</span>
										<span class="recharts-tooltip-item-separator">{separator()}</span>
									</Show>
									<span class="recharts-tooltip-item-value">{finalValue as JSX.Element}</span>
									<span class="recharts-tooltip-item-unit">{entry.unit || ""}</span>
								</li>
							)
						}}
					</For>
				</ul>
			)
		}

		return null
	}

	const finalStyle = (): JSX.CSSProperties => ({
		...defaultDefaultTooltipContentProps.contentStyle,
		...props.contentStyle,
	})
	const finalLabelStyle = (): JSX.CSSProperties => ({
		margin: 0,
		...labelStyle(),
	})
	const hasLabel = () => !isNullish(props.label)
	const finalLabel = (): JSX.Element => {
		if (
			hasLabel() &&
			props.labelFormatter &&
			props.payload !== undefined &&
			props.payload !== null
		) {
			return props.labelFormatter(props.label, props.payload)
		}
		return hasLabel() ? props.label : ""
	}
	const wrapperCN = () => clsx("recharts-default-tooltip", props.wrapperClassName)
	const labelCN = () => clsx("recharts-tooltip-label", props.labelClassName)

	const accessibilityAttributes = () =>
		accessibilityLayer()
			? {
					"aria-live": "assertive" as const,
					role: "status" as const,
				}
			: {}

	return (
		<div class={wrapperCN()} style={finalStyle()} {...accessibilityAttributes()}>
			<p class={labelCN()} style={finalLabelStyle()}>
				{typeof finalLabel() === "object" ? finalLabel() : `${finalLabel()}`}
			</p>
			{renderContent()}
		</div>
	)
}
